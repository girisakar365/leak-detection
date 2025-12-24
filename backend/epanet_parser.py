"""
EPANET INP File Parser
Parses .inp files to extract network topology, node coordinates, and pipe connections
"""

import re
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import math


@dataclass
class NodeInfo:
    id: str
    type: str
    x: float
    y: float
    elevation: float = 0.0


@dataclass
class PipeInfo:
    id: str
    from_node: str
    to_node: str
    length: float
    diameter: float


class EPANETParser:
    """Parser for EPANET .inp files"""
    
    def __init__(self, inp_file_path: str):
        self.inp_file = inp_file_path
        self.nodes: Dict[str, NodeInfo] = {}
        self.pipes: Dict[str, PipeInfo] = {}
        self.parse_inp_file()
    
    def parse_inp_file(self):
        """Parse the EPANET .inp file"""
        try:
            with open(self.inp_file, 'r') as f:
                content = f.read()
            
            # Parse different sections
            self._parse_junctions(content)
            self._parse_reservoirs(content)
            self._parse_tanks(content)
            self._parse_pipes(content)
            self._parse_coordinates(content)
            
        except FileNotFoundError:
            print(f"Warning: {self.inp_file} not found. Using mock data.")
            self._generate_mock_data()
    
    def _parse_section(self, content: str, section_name: str) -> List[str]:
        """Extract lines from a specific section"""
        pattern = rf'\[{section_name}\](.*?)(?=\[|\Z)'
        match = re.search(pattern, content, re.DOTALL | re.IGNORECASE)
        
        if not match:
            return []
        
        lines = match.group(1).strip().split('\n')
        # Filter out comments and empty lines
        return [line.split(';')[0].strip() for line in lines 
                if line.strip() and not line.strip().startswith(';')]
    
    def _parse_junctions(self, content: str):
        """Parse junction nodes"""
        lines = self._parse_section(content, 'JUNCTIONS')
        
        for line in lines:
            parts = line.split()
            if len(parts) >= 2:
                node_id = parts[0]
                elevation = float(parts[1]) if len(parts) > 1 else 0.0
                self.nodes[node_id] = NodeInfo(
                    id=node_id,
                    type='junction',
                    x=0.0,
                    y=0.0,
                    elevation=elevation
                )
    
    def _parse_reservoirs(self, content: str):
        """Parse reservoir nodes"""
        lines = self._parse_section(content, 'RESERVOIRS')
        
        for line in lines:
            parts = line.split()
            if len(parts) >= 2:
                node_id = parts[0]
                head = float(parts[1])
                self.nodes[node_id] = NodeInfo(
                    id=node_id,
                    type='reservoir',
                    x=0.0,
                    y=0.0,
                    elevation=head
                )
    
    def _parse_tanks(self, content: str):
        """Parse tank nodes"""
        lines = self._parse_section(content, 'TANKS')
        
        for line in lines:
            parts = line.split()
            if len(parts) >= 2:
                node_id = parts[0]
                elevation = float(parts[1])
                self.nodes[node_id] = NodeInfo(
                    id=node_id,
                    type='tank',
                    x=0.0,
                    y=0.0,
                    elevation=elevation
                )
    
    def _parse_pipes(self, content: str):
        """Parse pipe connections"""
        lines = self._parse_section(content, 'PIPES')
        
        for line in lines:
            parts = line.split()
            if len(parts) >= 5:
                pipe_id = parts[0]
                from_node = parts[1]
                to_node = parts[2]
                length = float(parts[3])
                diameter = float(parts[4])
                
                self.pipes[pipe_id] = PipeInfo(
                    id=pipe_id,
                    from_node=from_node,
                    to_node=to_node,
                    length=length,
                    diameter=diameter
                )
    
    def _parse_coordinates(self, content: str):
        """Parse node coordinates"""
        lines = self._parse_section(content, 'COORDINATES')
        
        for line in lines:
            parts = line.split()
            if len(parts) >= 3:
                node_id = parts[0]
                x = float(parts[1])
                y = float(parts[2])
                
                if node_id in self.nodes:
                    self.nodes[node_id].x = x
                    self.nodes[node_id].y = y
        
        # Normalize coordinates for display
        self._normalize_coordinates()
    
    def _normalize_coordinates(self):
        """Normalize coordinates to a reasonable range for web display"""
        if not self.nodes:
            return
        
        xs = [node.x for node in self.nodes.values()]
        ys = [node.y for node in self.nodes.values()]
        
        if not xs or not ys:
            return
        
        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)
        
        # Avoid division by zero
        range_x = max_x - min_x if max_x != min_x else 1
        range_y = max_y - min_y if max_y != min_y else 1
        
        # Normalize to 0-1000 range for easier display
        for node in self.nodes.values():
            node.x = ((node.x - min_x) / range_x) * 1000
            node.y = ((node.y - min_y) / range_y) * 1000
    
    def _generate_mock_data(self):
        """Generate mock network data for testing"""
        # Create a simple network with 10 nodes and connecting pipes
        for i in range(10):
            node_id = f"J{i+1}"
            self.nodes[node_id] = NodeInfo(
                id=node_id,
                type='junction' if i > 0 else 'reservoir',
                x=100 + (i % 5) * 200,
                y=100 + (i // 5) * 300,
                elevation=100 + i * 5
            )
        
        # Create pipes connecting nodes
        for i in range(9):
            pipe_id = f"P{i+1}"
            self.pipes[pipe_id] = PipeInfo(
                id=pipe_id,
                from_node=f"J{i+1}",
                to_node=f"J{i+2}",
                length=100 + i * 10,
                diameter=150
            )
    
    def get_network_topology(self) -> Dict:
        """Get complete network topology for API response"""
        import random
        
        nodes = []
        # CHANGES TO BE DONE HERE.
        for node in self.nodes.values():
            # Assign risk levels (this would come from ML model in production)
            risk_score = random.uniform(0, 100)
            if risk_score > 70:
                risk_level = "high"
            elif risk_score > 40:
                risk_level = "medium"
            elif risk_score > 20:
                risk_level = "low"
            else:
                risk_level = "none"
            
            nodes.append({
                "id": node.id,
                "type": node.type,
                "coordinates": {"x": node.x, "y": node.y},
                "elevation": node.elevation,
                "leak_risk": risk_level,
                "risk_score": risk_score
            })
        
        pipes = []
        for pipe in self.pipes.values():
            pipes.append({
                "id": pipe.id,
                "from_node": pipe.from_node,
                "to_node": pipe.to_node,
                "length": pipe.length,
                "diameter": pipe.diameter,
                "status": "active"
            })
        
        return {
            "nodes": nodes,
            "pipes": pipes
        }
    
    def get_affected_nodes(self, source_node: str) -> List[str]:
        """
        Calculate nodes that would be affected by a leak at source_node
        Uses simple downstream analysis based on network topology
        """
        if source_node not in self.nodes:
            return []
        
        affected = set()
        to_visit = [source_node]
        visited = set()
        
        while to_visit:
            current = to_visit.pop(0)
            if current in visited:
                continue
            
            visited.add(current)
            
            # Find downstream nodes
            for pipe in self.pipes.values():
                if pipe.from_node == current and pipe.to_node not in visited:
                    affected.add(pipe.to_node)
                    to_visit.append(pipe.to_node)
        
        return list(affected)
