"""
Leak Detection Module
Interfaces with ML model to provide leak predictions and monitoring data
"""

import random
from datetime import datetime, timedelta
from typing import List, Dict
from generate_data import DataGenerator
import math

sample_minutes = 15
sample_duration_hours = 6
gd = DataGenerator(inp_file ="PATTERN.inp", step_m=sample_minutes, duration_h=sample_duration_hours)

label_prefix = gd.get_resolution_label(sample_minutes=sample_minutes)
generated_data = gd.generate_data(
    "NODE_467",
    emitter_cof=0.5,
    collection_start_hour=6,
    leak_start_min=60,
    leak_duration_hours=4
)
total_pressure = 0
pressureColumns=[key for key in generated_data.keys() if key.startswith("NODE")]
for column in pressureColumns:
    total_pressure = generated_data[column] + total_pressure
average_pressure = total_pressure / len(pressureColumns)

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
    
    def get_pressure_history(self, node_id: str) -> List[Dict]:
        """
        Get historical pressure data for a node
        Returns time series data for the specified number of hours
        """
        data=[]
        column_names=[]
        for i in range(int(sample_duration_hours*60/sample_minutes)):
            column_names.append(f"{node_id}_{label_prefix}{i}")

        for column in column_names:
            data.append({
                column: generated_data[column]
            })        
        return data
    
    def get_demand_comparison(self) -> Dict:
        """
        Get base demand vs actual demand comparison
        Returns recent time series for demand analysis
        """
        # to do add base demand logic
        demand_dic= generated_data["leak_demand_time"]

        return demand_dic
    
    
    def get_network_statistics(self) -> Dict:
        """
        Get overall network statistics
        """
        return {
            "total_nodes": random.randint(50, 200),
            "active_pipes": random.randint(80, 300),
            "average_pressure": average_pressure,
            "last_updated": datetime.now().isoformat(),
            "system_status": "operational"
        }
