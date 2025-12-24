"""
Leak Detection Module
Interfaces with ML model to provide leak predictions and monitoring data
"""

import random
from datetime import datetime, timedelta
from typing import List, Dict
import math


class LeakDetector:
    """
    Leak detection system that integrates with trained ML model
    Currently uses simulated data - replace with actual model integration
    """
    
    def __init__(self):
        self.last_update = datetime.now()
        # In production, load your trained model here
        # self.model = load_model('path_to_model')
    
    def get_predictions(self) -> List[Dict]:
        """
        Get leak predictions for all nodes
        Replace with actual model predictions
        """
        predictions = []
        
        # Simulate predictions for demonstration
        # In production, this would call your trained model
        node_ids = [f"J{i}" for i in range(1, 11)]
        
        for node_id in node_ids:
            probability = random.uniform(0, 1)
            
            if probability > 0.7:
                risk_level = "high"
            elif probability > 0.4:
                risk_level = "medium"
            elif probability > 0.2:
                risk_level = "low"
            else:
                risk_level = "none"
            
            # Simulate affected nodes
            affected_count = random.randint(0, 5) if probability > 0.3 else 0
            affected_nodes = [f"J{random.randint(1, 10)}" for _ in range(affected_count)]
            
            predictions.append({
                "node_id": node_id,
                "leak_probability": round(probability * 100, 2),
                "risk_level": risk_level,
                "affected_nodes": affected_nodes,
                "timestamp": datetime.now().isoformat()
            })
        
        return predictions
    
    def get_pressure_history(self, node_id: str, hours: int = 24) -> List[Dict]:
        """
        Get historical pressure data for a node
        Returns time series data for the specified number of hours
        """
        data = []
        base_pressure = 50 + random.uniform(-10, 10)
        
        # Generate hourly data points
        for i in range(hours):
            timestamp = datetime.now() - timedelta(hours=hours-i)
            
            # Simulate pressure variation with some noise
            variation = math.sin(i * 0.5) * 5 + random.uniform(-2, 2)
            
            # Add anomaly for leak simulation
            if i > hours * 0.7 and random.random() > 0.8:
                variation -= random.uniform(5, 15)
            
            pressure = max(0, base_pressure + variation)
            
            data.append({
                "timestamp": timestamp.isoformat(),
                "pressure": round(pressure, 2)
            })
        
        return data
    
    def get_demand_comparison(self, node_id: str) -> Dict:
        """
        Get base demand vs actual demand comparison
        Returns recent time series for demand analysis
        """
        data_points = []
        base_demand = 100 + random.uniform(-20, 20)
        
        # Generate 24 hours of data
        for i in range(24):
            timestamp = datetime.now() - timedelta(hours=24-i)
            
            # Simulate demand pattern (higher during day, lower at night)
            hour = timestamp.hour
            time_factor = 1.0 + 0.3 * math.sin((hour - 6) * math.pi / 12)
            
            # Add noise and potential leak indicator
            noise = random.uniform(-5, 5)
            leak_indicator = random.uniform(10, 30) if i > 18 and random.random() > 0.7 else 0
            
            actual = base_demand * time_factor + noise + leak_indicator
            
            data_points.append({
                "timestamp": timestamp.isoformat(),
                "base_demand": round(base_demand * time_factor, 2),
                "actual_demand": round(actual, 2)
            })
        
        return {
            "node_id": node_id,
            "data": data_points,
            "unit": "GPM"
        }
    
    def get_network_statistics(self) -> Dict:
        """
        Get overall network statistics
        """
        return {
            "total_nodes": random.randint(50, 200),
            "active_pipes": random.randint(80, 300),
            "high_risk_nodes": random.randint(2, 10),
            "medium_risk_nodes": random.randint(5, 20),
            "low_risk_nodes": random.randint(10, 30),
            "average_pressure": round(random.uniform(40, 60), 2),
            "total_flow": round(random.uniform(1000, 5000), 2),
            "last_updated": datetime.now().isoformat(),
            "system_status": "operational"
        }
