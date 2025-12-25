import math
import time
import random
from pathlib import Path
import numpy as np
import pandas as pd
import wntr
from wntr.epanet.toolkit import ENepanet
from wntr.epanet.util import EN

EPANET_OUT_DIR = Path("epanet_runs")
EPANET_OUT_DIR.mkdir(exist_ok=True)

RESOLUTION_MAP = {
    10: "TenMin",
    15: "QuarterHour",
    30: "HalfHour",
    60: "Hour"
}

OBS_NODES=[
    "NODE_1383","NODE_319", "NODE_9014", "NODE_434",
    "NODE_1119", "NODE_657", "NODEIN_3801", 
    "NODE_472", "NODE_504", "NODE_433", 
    "NODE_460", "NODE_470", "NODE_1185", 
    "NODE_446", "NODE_1433", 
    "NODE_1124", "NODE_501", "NODE_635", 
    "NODE_444", "NODE_430", "NODE_1162"
]

class DataGenerator():
    def __init__(self, inp_file: str,step_m: int = 10,duration_h: int = 24):
        self.inp_file = inp_file
        self.wn = wntr.network.WaterNetworkModel(self.inp_file)
        self.wn.options.hydraulic.emitter_exponent = float(1.0)
        
        # CONSTANTS
        self.STEP_S = step_m * 60  # simulation time step in seconds
        self.wn.options.time.duration = duration_h * 3600  # total simulation duration in seconds
        self.wn.options.time.hydraulic_timestep = self.STEP_S
        self.wn.options.time.report_timestep = self.STEP_S
        self.wn.options.time.report_start = 0
        self.TOTAL_HOURS  = duration_h  # total hours of data to generate
        self.EMITTER_EXP = 1.0
        
        self.total_steps= (self.TOTAL_HOURS * 3600) // self.STEP_S

        # Write a clean INP for EPANET engine
        inp_tmp = EPANET_OUT_DIR / "tmp.inp"
        rpt_tmp = EPANET_OUT_DIR / "tmp.rpt"
        out_tmp = EPANET_OUT_DIR / "tmp.bin"
        wntr.network.io.write_inpfile(self.wn, inp_tmp)

        self.epnet = ENepanet()
        self.epnet.ENopen(str(inp_tmp), str(rpt_tmp), str(out_tmp))

    def get_resolution_label(self,sample_minutes: int) -> str:
        return RESOLUTION_MAP.get(sample_minutes, f"Min{sample_minutes}")
    
    def _get_flow_unit(self) -> str | None:
        hyd = getattr(self.wn.options, "hydraulic", None)
        for attr in ("inpfile_units", "units", "flow_units"):
            if hyd is not None and hasattr(hyd, attr):
                u = getattr(hyd, attr)
                if u:
                    return str(u).upper()
        return None

    def _flow_to_lps_factor(self, flow_unit: str | None) -> float:
        if flow_unit is None:
            return 1.0

        u = flow_unit.upper()
        if u == "LPS": return 1.0
        if u == "LPM": return 1.0 / 60.0
        if u == "CMH": return 1000.0 / 3600.0
        if u == "CMD": return 1000.0 / 86400.0
        if u == "MLD": return 1_000_000.0 / 86400.0

        if u == "GPM": return 3.785411784 / 60.0
        if u == "CFS": return 28.316846592
        if u == "MGD": return (1_000_000.0 * 3.785411784) / 86400.0
        if u == "AFD": return (43560.0 * 28.316846592) / 86400.0

        return 1.0

    def _aggregate_to_hourly(self, pressure_df: pd.DataFrame, total_hours: int) -> pd.DataFrame:
        df = pressure_df.copy()
        df.index = df.index.astype(int)
        df["hour_index"] = df.index // 3600
        hourly = df.groupby("hour_index").mean(numeric_only=True)
        return hourly.reindex(range(total_hours))

    def _EN(self, name: str) -> int:
        # robust constant getter across WNTR versions
        if hasattr(EN, name):
            return getattr(EN, name)
        if hasattr(EN, "EN_" + name):
            return getattr(EN, "EN_" + name)
        raise AttributeError(f"Cannot find EPANET constant {name} in wntr.epanet.util.EN")

    def generate_data(self,
        leak_node:str,
        emitter_cof:float,
        collection_start_hour:int,
        leak_start_min:int,
        leak_duration_hours:int
    ):
        collection_start_s = int(round(collection_start_hour * 3600.0))
        collection_end_s = int(round(collection_start_hour + self.TOTAL_HOURS) * 3600.0)

        node = self.wn.get_node(leak_node)
        if getattr(node, "coordinates", None) is not None:
            leak_x, leak_y = node.coordinates

        leak_start_s = int(round(collection_start_s + float(leak_start_min) * 60.0))
        leak_end_s = int(leak_start_s + float(leak_duration_hours) * 3600)
        
        node.emitter_coefficient = 0.0 # type: ignore

        try:
            # Map node names -> EPANET indices
            node_index = {}
            for n in OBS_NODES:
                node_index[n] = self.epnet.ENgetnodeindex(n)

            leak_idx = self.epnet.ENgetnodeindex(leak_node) if leak_node is not None else None

            # Set leak emitter OFF initially (again, to be safe)
            if leak_idx is not None:
                self.epnet.ENsetnodevalue(leak_idx, self._EN("EMITTER"), 0.0)

            # Force EPANET engine timesteps (don’t rely only on the INP)
            self.epnet.ENsettimeparam(self._EN("DURATION"), int(collection_end_s))
            self.epnet.ENsettimeparam(self._EN("HYDSTEP"), self.STEP_S)
            self.epnet.ENsettimeparam(self._EN("REPORTSTEP"), self.STEP_S)
            self.epnet.ENsettimeparam(self._EN("REPORTSTART"), 0)    

            # Init hydraulics
            self.epnet.ENopenH()
            self.epnet.ENinitH(0)

            # Collect pressures at each report step
            pressures = []
            times = []

            # Collect leak-node pressure during leak window for leak_size calculation
            leak_press_series = []
            leak_demand_series = []

            t = 0
            started = False
            ended = False
            step_index = 0

            while True:
                t = self.epnet.ENrunH()  # current time (seconds)

                # Toggle emitter exactly at the time
                if leak_idx is not None:
                    if (not started) and (t >= leak_start_s):
                        self.epnet.ENsetnodevalue(leak_idx, self._EN("EMITTER"), float(emitter_cof))
                        started = True
                    if (not ended) and (t >= leak_end_s):
                        self.epnet.ENsetnodevalue(leak_idx, self._EN("EMITTER"), 0.0)
                        ended = True

                # Read pressures for observation nodes if inside collection window
                if collection_start_s <= t < collection_end_s:
                    row = {}
                    for n in OBS_NODES:
                        p = self.epnet.ENgetnodevalue(node_index[n], self._EN("PRESSURE"))
                        p = float(p)

                        if not math.isfinite(p):
                            fail_time_s = int(t)
                            fail_node = n
                            print(f"[NONFINITE] t={fail_time_s}s node={fail_node} leak_node={leak_node} C={emitter_cof}")
                            break
                        row[n] = float(p)
                    pressures.append(row)
                    times.append(step_index)
                    step_index += 1

                # Leak node pressure
                if leak_idx is not None:
                    pL = float(self.epnet.ENgetnodevalue(leak_idx, self._EN("PRESSURE")))
                    dL = float(self.epnet.ENgetnodevalue(leak_idx, self._EN("DEMAND")))
                    leak_press_series.append((int(t), pL))
                    leak_demand_series.append((int(t), dL))

                tstep = self.epnet.ENnextH()
                if tstep <= 0:
                    break
            self.epnet.ENcloseH()

        finally:
            self.epnet.ENclose()

        interval_press = pd.DataFrame(pressures, index=pd.Index(times, name="time_s"))

        # Leak size from emitter law (mean Q during leak window)
        leak_size_lps = ""
        leak_node_pressure_head = ""
        if leak_node is not None:
            exp = float(self.EMITTER_EXP if self.EMITTER_EXP is not None else self.wn.options.hydraulic.emitter_exponent)

            flow_unit = self._get_flow_unit()
            factor_to_lps = self._flow_to_lps_factor(flow_unit)

            leak_press = pd.Series(
                data=[p for _, p in leak_press_series],
                index=[t for t, _ in leak_press_series],
                name="pressure",
                dtype=float
            ).clip(lower=0.0)

            leak_demand = pd.Series(
                data=[d for _, d in leak_demand_series],
                index=[t for t, _ in leak_demand_series],
                name="demand",
                dtype=float
            ).clip(lower=0.0) 

            mask = (leak_press.index >= leak_start_s) & (leak_press.index < leak_end_s)
            if mask.any():
                q = float(emitter_cof) * (leak_press[mask] ** exp)
                leak_size_lps = float((q * factor_to_lps).mean())
                leak_node_pressure_head = float(leak_press[mask].mean())
            else:
                leak_size_lps = 0.0
                leak_node_pressure_head = 0.0

            # Build scenario row
            row = {}
            if leak_node is None:
                row.update({
                    "leak": 0, "leak_node": "", "leak_x": "", "leak_y": "",
                    "leak_size_lps": "", "leak_node_pressure_head": "",
                    "emitter_coeff": "", "leak_start_hr": "", "leak_duration_hr": ""
                })
            else:
                row.update({
                    "leak": 1, "leak_node": leak_node,
                    "leak_x": leak_x if leak_x is not None else "",
                    "leak_y": leak_y if leak_y is not None else "",
                    "leak_size_lps": leak_size_lps,
                    "leak_node_pressure_head": leak_node_pressure_head,
                    "emitter_coeff": float(emitter_cof),
                    "leak_start_min": float(leak_start_min),
                    "leak_duration_hr": float(leak_duration_hours),
                })

            row["collection_start_hr"] = float(collection_start_hour)
            row["collection_duration_hr"] = float(self.TOTAL_HOURS)
            row["leak_demand_time"] = leak_demand.to_dict()
            row["leak_pressure_time"] = leak_press.to_dict()

            label_prefix = self.get_resolution_label(self.STEP_S // 60)

            for nid in OBS_NODES:
                for k in range(self.total_steps):
                    if k < len(interval_press) and nid in interval_press.columns:
                        val = interval_press.loc[k, nid]
                        row[f"{nid}_{label_prefix}{k}"] = float(val) if pd.notna(val) else ""
                    else:
                        row[f"{nid}_{label_prefix}{k}"] = ""
            
            csv_data_path = Path(__file__).parent / "generated_data.csv"
            pd.DataFrame([row]).to_csv(csv_data_path)
            return row

if __name__ == "__main__":
    inp_path = Path(__file__).parent

    gd = DataGenerator(inp_file ="PATTERN.inp", step_m=15, duration_h=6)

    aa = gd.generate_data(
        "NODE_361",
        emitter_cof=0.5,
        collection_start_hour=6,
        leak_start_min=60,
        leak_duration_hours=4
    )
    print(aa)

