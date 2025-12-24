import math
import time
import random
from pathlib import Path
import numpy as np
import pandas as pd
import wntr
from wntr.epanet.toolkit import ENepanet
from wntr.epanet.util import EN

EMITTER_CHOICES = [0.01389, 0.02778, 0.1389, 0.2778, 0.4167, 0.5556]

EPANET_OUT_DIR = Path("epanet_runs")
EPANET_OUT_DIR.mkdir(exist_ok=True)

def get_leak_nodes_from_inp(inp_path: str, exclude_ids: list[str]) -> list[str]:
    #Get all the junctions in the inp file as a possible leak nodes expect for the specified ones
    wn = wntr.network.WaterNetworkModel(inp_path)

    exclude = set(exclude_ids)

    # Use junctions only (emitters are meaningful at junctions)
    leak_nodes = []
    for name, node in wn.junctions():
        if name not in exclude:
            leak_nodes.append(name)

    leak_nodes.sort()
    return leak_nodes

def get_all_nodes_from_inp(inp_path: str) -> list[str]:
    wn = wntr.network.WaterNetworkModel(inp_path)
    names = []

    # Junctions
    for name, _ in wn.junctions():
        names.append(name)
    # Tanks
    for name, _ in wn.tanks():
        names.append(name)
    # Reservoirs
    for name, _ in wn.reservoirs():
        names.append(name)

    names.sort()
    return names

def _get_emitter_exponent(wn) -> float:
    exp = getattr(getattr(wn.options, "hydraulic", None), "emitter_exponent", None)
    return float(exp) if exp is not None else 0.5

def _get_flow_unit(wn) -> str | None:
    hyd = getattr(wn.options, "hydraulic", None)
    for attr in ("inpfile_units", "units", "flow_units"):
        if hyd is not None and hasattr(hyd, attr):
            u = getattr(hyd, attr)
            if u:
                return str(u).upper()
    return None

def _flow_to_lps_factor(flow_unit: str | None) -> float:
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

def _aggregate_to_hourly(pressure_df: pd.DataFrame, total_hours: int) -> pd.DataFrame:
    df = pressure_df.copy()
    df.index = df.index.astype(int)
    df["hour_index"] = df.index // 3600
    hourly = df.groupby("hour_index").mean(numeric_only=True)
    return hourly.reindex(range(total_hours))

def _EN(name: str) -> int:
    # robust constant getter across WNTR versions
    if hasattr(EN, name):
        return getattr(EN, name)
    if hasattr(EN, "EN_" + name):
        return getattr(EN, "EN_" + name)
    raise AttributeError(f"Cannot find EPANET constant {name} in wntr.epanet.util.EN")
# p  
def run_one_scenario_epanet_toolkit(
    inp_path: str,
    obs_nodes: list[str],
    sample_minutes: int,
    duration_days: int,
    leak_node: str | None = None,
    emitter_coeff: float | None = None,
    emitter_exponent: float | None = None,
    leak_start_hr: float | None = None,
    leak_duration_hr: float | None = None,
) -> dict:
    # Load WN for metadata + setting time options cleanly
    wn = wntr.network.WaterNetworkModel(inp_path)

    if emitter_exponent is not None:
        wn.options.hydraulic.emitter_exponent = float(emitter_exponent)

    step_s = int(sample_minutes * 60)
    wn.options.time.duration = int(duration_days * 24 * 3600)
    wn.options.time.hydraulic_timestep = step_s
    wn.options.time.report_timestep = step_s
    wn.options.time.report_start = 0

    total_hours = int(duration_days * 24)

    # Validate observation nodes exist in the INP to fail early with a clear message
    # Use node_name_list to avoid KeyError from get_node
    missing_obs = [n for n in obs_nodes if n not in getattr(wn, "node_name_list", [])]
    if len(missing_obs) > 0:
        raise ValueError(f"The following observation nodes are not defined in {inp_path}: {missing_obs}")

    # Validate leak node if provided
    if leak_node is not None and leak_node not in getattr(wn, "node_name_list", []):
        raise ValueError(f"Leak node '{leak_node}' is not defined in {inp_path}")

    # Leak timing (seconds)
    leak_x = leak_y = None
    leak_start_s = leak_end_s = None

    if leak_node is not None:
        if emitter_coeff is None:
            raise ValueError("leak_node provided but emitter_coeff is None")
        if leak_start_hr is None or leak_duration_hr is None:
            raise ValueError("leak_node provided but leak_start_hr/leak_duration_hr not set")

        j = wn.get_node(leak_node)
        if getattr(j, "coordinates", None) is not None:
            leak_x, leak_y = j.coordinates

        leak_start_s = int(float(leak_start_hr) * 3600)
        leak_end_s = int(leak_start_s + float(leak_duration_hr) * 3600)

        # IMPORTANT: start OFF in the INP
        j.emitter_coefficient = 0.0

    # Write a clean INP for EPANET engine
    inp_tmp = EPANET_OUT_DIR / "tmp.inp"
    rpt_tmp = EPANET_OUT_DIR / "tmp.rpt"
    out_tmp = EPANET_OUT_DIR / "tmp.bin"
    wntr.network.io.write_inpfile(wn, inp_tmp)

    # Open EPANET engine
    en = ENepanet()
    en.ENopen(str(inp_tmp), str(rpt_tmp), str(out_tmp))
    try:
        # Map node names -> EPANET indices
        node_index = {}
        for n in obs_nodes:
            node_index[n] = en.ENgetnodeindex(n)

        leak_idx = en.ENgetnodeindex(leak_node) if leak_node is not None else None

        # Set leak emitter OFF initially (again, to be safe)
        if leak_idx is not None:
            en.ENsetnodevalue(leak_idx, _EN("EMITTER"), 0.0)

        # Force EPANET engine timesteps (don’t rely only on the INP)
        en.ENsettimeparam(_EN("DURATION"), duration_days * 24 * 3600)
        en.ENsettimeparam(_EN("HYDSTEP"), step_s)
        en.ENsettimeparam(_EN("REPORTSTEP"), step_s)
        en.ENsettimeparam(_EN("REPORTSTART"), 0)    

        # Init hydraulics
        en.ENopenH()
        en.ENinitH(0)

        # Collect pressures at each report step
        pressures = []
        times = []

        # Collect leak-node pressure during leak window for leak_size calculation
        leak_press_series = []

        t = 0
        started = False
        ended = False
        while True:
            # Toggle emitter exactly at the time
            if leak_idx is not None:
                if (not started) and (t >= leak_start_s):
                    en.ENsetnodevalue(leak_idx, _EN("EMITTER"), float(emitter_coeff))
                    started = True
                if (not ended) and (t >= leak_end_s):
                    en.ENsetnodevalue(leak_idx, _EN("EMITTER"), 0.0)
                    ended = True

            t = en.ENrunH()  # current time (seconds)

            # Read pressures for observation nodes
            row = {}
            for n in obs_nodes:
                p = en.ENgetnodevalue(node_index[n], _EN("PRESSURE"))
                p = float(p)

                if not math.isfinite(p):
                    fail_time_s = int(t)
                    fail_node = n
                    print(f"[NONFINITE] t={fail_time_s}s node={fail_node} leak_node={leak_node} C={emitter_coeff}")
                    break
                row[n] = float(p)
            pressures.append(row)
            times.append(int(t))

            # Leak node pressure
            if leak_idx is not None:
                pL = float(en.ENgetnodevalue(leak_idx, _EN("PRESSURE")))
                leak_press_series.append((int(t), pL))

            tstep = en.ENnextH()
            if tstep <= 0:
                break
        en.ENcloseH()

    finally:
        en.ENclose()

    # Build pressure dataframe: index=time_s, columns=nodes
    minute_press = pd.DataFrame(pressures, index=pd.Index(times, name="time_s"))

    hourly_press = _aggregate_to_hourly(minute_press, total_hours=total_hours)

    # Leak size from emitter law (mean Q during leak window)
    leak_size_lps = ""
    leak_node_pressure_head = ""
    if leak_node is not None:
        exp = float(emitter_exponent if emitter_exponent is not None else wn.options.hydraulic.emitter_exponent)

        flow_unit = _get_flow_unit(wn)
        factor_to_lps = _flow_to_lps_factor(flow_unit)

        leak_press = pd.Series(
            data=[p for _, p in leak_press_series],
            index=[t for t, _ in leak_press_series],
            name="pressure",
            dtype=float
        ).clip(lower=0.0)

        mask = (leak_press.index >= leak_start_s) & (leak_press.index < leak_end_s)
        if mask.any():
            q = float(emitter_coeff) * (leak_press[mask] ** exp)
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
            "emitter_coeff": float(emitter_coeff),
            "leak_start_hr": float(leak_start_hr),
            "leak_duration_hr": float(leak_duration_hr),
        })

    for nid in obs_nodes:
        for h in range(total_hours):
            val = hourly_press.loc[h, nid]
            row[f"{nid}_Hour{h}"] = float(val) if pd.notna(val) else ""

    return row


def build_dataset(
    inp_path: str,
    obs_nodes: list[str],
    leak_nodes: list[str],
    sample_minutes: int = 10,
    duration_days: int = 1,
    leak_duration_hr: float = 4.0,
    emitter_choices: list[float] = EMITTER_CHOICES,
    emitter_exponent: float | None = None,
    random_seed: int | None = 42,
    leak_start_hr_min: int = 0,
    leak_start_hr_max: int = 19,  # for 4h leak within 24h
) -> pd.DataFrame:
    rng = random.Random(random_seed)
    rows = []
    scenario_id = 0

    # Baseline
    scenario_id += 1
    start_time = time.time()
    r = run_one_scenario_epanet_toolkit(
    inp_path=inp_path,
    obs_nodes=obs_nodes,
    sample_minutes=sample_minutes,
    duration_days=duration_days,
    emitter_exponent=emitter_exponent,
    leak_node=None,
    )

    r["scenario_id"] = scenario_id
    rows.append(r)
    print(f"Baseline Scenario {scenario_id} took {time.time() - start_time:.2f} seconds to collect data.")
    batch_start = time.time()
    # Leak scenarios: different random start times, same 4h duration
    for ln in leak_nodes:
        for emitter_c in emitter_choices:
            scenario_id += 1

            start_hr = rng.randint(leak_start_hr_min, leak_start_hr_max)

            r = run_one_scenario_epanet_toolkit(
                inp_path=inp_path,
                obs_nodes=obs_nodes,
                sample_minutes=sample_minutes,
                duration_days=duration_days,
                leak_node=ln,
                emitter_coeff=float(emitter_c),
                emitter_exponent=emitter_exponent,
                leak_start_hr=float(start_hr),
                leak_duration_hr=float(leak_duration_hr),
            )
            r["scenario_id"] = scenario_id
            rows.append(r)

            if (scenario_id % 20 == 0):
                print(f"Processed {scenario_id} scenarios – last 20 took {time.time() - batch_start:.2f}s")
                batch_start = time.time()

    df = pd.DataFrame(rows)
    cols = ["scenario_id"] + [c for c in df.columns if c != "scenario_id"]
    return df.loc[:, cols]

# if __name__ == "__main__":
    # --- EDIT THESE ---

INP = "PATTERN.inp"
# OBS_NODES=[
#  "NODE_1383","NODE_319", "NODE_9014", "NODE_434",
#  "NODE_1119", "NODE_657", "NODEIN_3801", 
#  "NODE_472", "NODE_504", "NODE_433", 
#  "NODE_460", "NODE_470", "NODE_1185", 
#   "NODE_446", "NODE_1433", 
#  "NODE_1124", "NODE_501", "NODE_635", 
#  "NODE_444", "NODE_430", "NODE_1162"
# ]
# EXCLUDE_LEAK_NODE_IDS = [
#  "NODE_467", "NODE_468", "NODE_469", 
#  "NODE_470", "NODE_471", "NODE_472", 
#  "NODE_474", "NODE_475", "NODE_480", 
#  "NODE_327", "NODE_501", "NODE_502", 
#  "NODE_504", "NODE_633", " NODE_657",
#  "NODE_963", "NODE_1101", "NODE_1102", 
#  "NODE_1119", "NODE_1120", "NODE_1122",
#  "NODE_1123", "NODE_1124", "NODE_1159",
#  "NODE_1160", "NODE_1162", "NODE_1185",
#  "NODE_1186", "NODE_1195", "NODE_1198",
#  "NODE_1207", "NODE_1209", "NODE_1210",
#  "NODE_1233", "NODE_1234", "NODE_1235",
#  "NODE_1236", "NODE_1237", "NODE_1238", 
#  "NODE_1239", "NODE_1252", "NODE_333",
#  "NODE_1253", "NODE_1254", "NODE_1257",
#  "NODE_1362", "NODE_1364", "NODE_1365",
#  "NODE_1366", "NODE_1367", "NODE_1369",
#  "NODE_1370", "NODE_1371", "NODE_1373",
#  "NODE_1381", "NODE_1382", "NODE_1383",
#  "NODE_1392", "NODE_1393", "NODE_1394",
#  "NODE_1395", "NODE_1398", "NODE_1419",
#  "NODE_1420", "NODE_1421", "NODE_1422",
#  " NODE_1432       ", " NODE_1433       ", " NODE_1434       ", " NODE_1435       ", " NODE_1436       ", " NODE_1437       ", " NODE_1467       ", " NODE_1475       ", " NODE_1476       ", " NODE_1477       ", " NODE_1478       ", " NODE_1482       ", " NODE_1483       ", " NODE_343        ", " NODE_318        ", " NODE_348        ", " NODE_350        ", " NODE_352        ", " NODE_319        ", " NODE_320        ", " NODE_374        ", " NODE_395        ", " NODE_423        ", " NODE_430        ", " NODE_433        ", " NODE_434        ", " NODE_444        ", " NODE_445        ", " NODE_446        ", " NODE_324        ", " NODE_458        ", " NODE_460        ", " NODE_9000       ", " NODE_9001       ", " NODE_9002       ", " NODE_9003       ", " NODE_9004       ", " NODE_9005       ", " NODE_9006       ", " NODE_9007       ", " NODE_9008       ", " NODE_9009       ", " NODE_9010       ", " NODE_9011       ", " NODE_9012       ", " NODE_9013       ", " NODE_9014       ", " NODE_9015       ", " NODE_9016       ", " NODE_9017       ", " NODE_9018       ", " NODE_9019       ", " NODE_9020       ", " NODE_9021       ", " NODE_9022       ", " NODE_9023       ", " NODE_9025       ", " NODE_9026       "
# ]

# # Clean node lists (strip whitespace) and validate
# OBS_NODES = [s.strip() for s in OBS_NODES if s and s.strip()]
# EXCLUDE_LEAK_NODE_IDS = [s.strip() for s in EXCLUDE_LEAK_NODE_IDS if s and s.strip()]

# # Quick validation: make sure observation nodes are present in the INP
# wn_check = wntr.network.WaterNetworkModel(INP)
# missing_obs = [n for n in OBS_NODES if n not in getattr(wn_check, "node_name_list", [])]
# if missing_obs:
#     print(f"Warning: the following OBS_NODES are not defined in {INP} and will be ignored: {missing_obs}")
#     OBS_NODES = [n for n in OBS_NODES if n in getattr(wn_check, "node_name_list", [])]
#     if len(OBS_NODES) == 0:
#         raise ValueError(f"No valid OBS_NODES remain after filtering. Check {INP} or OBS_NODES list.")

# # Build leak candidate list excluding blocked nodes
# cleaned_excludes = [s.strip() for s in EXCLUDE_LEAK_NODE_IDS if s and s.strip()]
# LEAK_NODES = get_leak_nodes_from_inp(INP, cleaned_excludes)

# df = build_dataset(
#     inp_path=INP,
#     obs_nodes=OBS_NODES,
#     leak_nodes=LEAK_NODES,
#     sample_minutes=10,       # customize sampling rate
#     duration_days=1,         # several days
#     leak_duration_hr=4.0,    # duration in hours
#     emitter_choices=EMITTER_CHOICES,
#     emitter_exponent=1,  # typical EPANET default
#     random_seed=40,
# )

# df.to_csv("pattern_dataset.csv", index=False)
# print("Wrote pattern_dataset.csv")