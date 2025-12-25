"""
FastAPI Backend for Water Supply Leak Detection System
Provides REST API endpoints for EPANET network data, leak predictions, and monitoring
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import uvicorn
from datetime import datetime

from pathlib import Path

from .epanet_parser import EPANETParser
from .leak_detector import LeakDetector
from .generate_data import DataGenerator

app = FastAPI(
    title="Water Supply Leak Detection API",
    description="API for monitoring water supply network and detecting potential leaks",
    version="1.0.0"
)

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize EPANET parser and leak detector
parser = EPANETParser("./backend/main_network.inp")
leak_detector = LeakDetector()


# Pydantic models for API responses
class Node(BaseModel):
    id: str
    type: str  # junction, reservoir, tank
    coordinates: Dict[str, float]
    elevation: Optional[float] = None

class Pipe(BaseModel):
    id: str
    from_node: str
    to_node: str
    length: float
    diameter: float
    status: str  # "active", "closed"

class NetworkData(BaseModel):
    nodes: List[Node]
    pipes: List[Pipe]
    total_nodes: int
    total_pipes: int
    timestamp: str
    system_status: str


class PressureData(BaseModel):
    timestamp: str
    node_id: str
    pressure: float

class DemandData(BaseModel):
    node_id: str
    base_demand: float
    actual_demand: float
    timestamp: str


class LeakPrediction(BaseModel):
    leak_x: List[float]
    leak_y: List[float]
    leak_size_lps: List[float]


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "running",
        "service": "Water Supply Leak Detection API",
        "version": "1.0.0"
    }


@app.get("/api/network", response_model=NetworkData)
async def get_network_data():
    """
    Get complete water supply network topology
    Returns all nodes, pipes, and their properties
    """
    try:
        network = parser.get_network_topology()
        return NetworkData(
            nodes=network["nodes"],
            pipes=network["pipes"],
            total_nodes=len(network["nodes"]),
            total_pipes=len(network["pipes"]),
            system_status = "operational",
            timestamp=datetime.now().isoformat()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading network data: {str(e)}")


@app.get("/api/leak-predictions", response_model=LeakPrediction)
async def get_leak_predictions():
    """
    Get real-time leak predictions for all nodes
    Returns nodes with leak probability and risk levels
    """
    try:
        predictions = leak_detector.get_predictions("./backend/generated_data.csv")
        return predictions
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting predictions: {str(e)}")


# @app.get("/api/pressure-data/{node_id}")
# async def get_pressure_data(node_id: str, hours: int = 24):
#     """
#     Get historical pressure data for a specific node
#     Args:
#         node_id: Node identifier
#         hours: Number of hours of historical data (default: 24)
#     """
#     try:
#         data = leak_detector.get_pressure_history(node_id, hours)
#         return {
#             "node_id": node_id,
#             "data": data,
#             "unit": "psi"
#         }
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Error getting pressure data: {str(e)}")


# @app.get("/api/demand-data/{node_id}")
# async def get_demand_data(node_id: str):
#     """
#     Get base demand vs actual demand comparison for a node
#     """
#     try:
#         data = leak_detector.get_demand_comparison(node_id)
#         return data
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Error getting demand data: {str(e)}")

# @app.get("/api/statistics")
# async def get_statistics():
#     """
#     Get overall network statistics and summary
#     """
#     try:
#         stats = leak_detector.get_network_statistics()
#         return stats
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Error getting statistics: {str(e)}")

@app.get(f"/api/generate_data")
async def generate_data(
    node_id: str,
    emitter_cof:float=0.5,
    collection_start_hour:int=0,
    leak_start_min:int=60,
    leak_duration_hours:int=4
):
    """
    Generate simulated data for testing purposes
    """
    try:
        total_pressure = 0
        sample_minutes = 60
        sample_duration_hours = 24
        inp_path = Path(__file__).parent / "main_network.inp"
        gd = DataGenerator(inp_file = str(inp_path), step_m=sample_minutes, duration_h=sample_duration_hours)
        data = gd.generate_data(

            node_id,
            emitter_cof,
            collection_start_hour,
            leak_start_min,
            leak_duration_hours
        )

        

        # #average_pressure.
        pressureColumns=[key for key in data.keys() if key.startswith("NODE")]
        for column in pressureColumns:
            total_pressure = data[column] + total_pressure
        average_pressure = total_pressure / len(pressureColumns)

        data.update({"average_pressure": average_pressure})

        #pressure_history
        pressure_history_dic= data["leak_pressure_time"]
        data.update({"pressure_history": pressure_history_dic})     

        #demand_history
        demand_dic= data["leak_demand_time"]
        data.update({"demand_history": demand_dic})
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating data: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(
        "__main__:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
