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
import random

from epanet_parser import EPANETParser
from leak_detector import LeakDetector

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
parser = EPANETParser("../PATTERN.inp")
leak_detector = LeakDetector()


# Pydantic models for API responses
class Node(BaseModel):
    id: str
    type: str  # junction, reservoir, tank
    coordinates: Dict[str, float]
    elevation: Optional[float] = None
    leak_risk: str  # "none", "low", "medium", "high"
    risk_score: float  # 0-100


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
    timestamp: str


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
    node_id: str
    leak_probability: float
    risk_level: str
    affected_nodes: List[str]
    timestamp: str


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
            timestamp=datetime.now().isoformat()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading network data: {str(e)}")


@app.get("/api/leak-predictions", response_model=List[LeakPrediction])
async def get_leak_predictions():
    """
    Get real-time leak predictions for all nodes
    Returns nodes with leak probability and risk levels
    """
    try:
        predictions = leak_detector.get_predictions()
        return predictions
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting predictions: {str(e)}")


@app.get("/api/pressure-data/{node_id}")
async def get_pressure_data(node_id: str, hours: int = 24):
    """
    Get historical pressure data for a specific node
    Args:
        node_id: Node identifier
        hours: Number of hours of historical data (default: 24)
    """
    try:
        data = leak_detector.get_pressure_history(node_id, hours)
        return {
            "node_id": node_id,
            "data": data,
            "unit": "psi"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting pressure data: {str(e)}")


@app.get("/api/demand-data/{node_id}")
async def get_demand_data(node_id: str):
    """
    Get base demand vs actual demand comparison for a node
    """
    try:
        data = leak_detector.get_demand_comparison(node_id)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting demand data: {str(e)}")


@app.get("/api/affected-nodes/{node_id}")
async def get_affected_nodes(node_id: str):
    """
    Get list of nodes that would be affected if specified node has a leak
    """
    try:
        affected = parser.get_affected_nodes(node_id)
        return {
            "source_node": node_id,
            "affected_nodes": affected,
            "count": len(affected)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating affected nodes: {str(e)}")


@app.get("/api/statistics")
async def get_statistics():
    """
    Get overall network statistics and summary
    """
    try:
        stats = leak_detector.get_network_statistics()
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting statistics: {str(e)}")


if __name__ == "__main__":
    uvicorn.run(
        "__main__:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
