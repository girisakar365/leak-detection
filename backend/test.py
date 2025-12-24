from pathlib import Path

from .epanet_parser import EPANETParser

file = Path(__file__).parent.parent / "PATTERN.inp"

ep = EPANETParser(str(file))

print(
    ep.get_network_topology()
)