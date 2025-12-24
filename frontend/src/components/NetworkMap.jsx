import { useRef, useEffect, useState } from 'react';
import './NetworkMap.css';

function NetworkMap({ networkData, selectedNode, onNodeSelect }) {
  const canvasRef = useRef(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  // Zoom limits
  const MIN_SCALE = 0.2;
  const MAX_SCALE = 40; // increased max zoom to allow much closer inspection
  // Exponent controlling how fast node radius shrinks when zooming in.
  // Higher value -> nodes shrink faster as scale increases.
  const RADIUS_EXPONENT = 4; // increase from 2 to 3 for stronger shrink effect

  useEffect(() => {
    if (!networkData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply transformations
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    // Draw pipes first (so they're behind nodes)
    drawPipes(ctx, networkData.pipes, networkData.nodes);

    // Draw nodes
    drawNodes(ctx, networkData.nodes);

    ctx.restore();
  }, [networkData, selectedNode, hoveredNode, scale, offset]);

  // Set up wheel event listener with passive: false
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheelEvent = (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setScale(prev => Math.max(MIN_SCALE, Math.min(MAX_SCALE, prev * delta)));
    };

    canvas.addEventListener('wheel', handleWheelEvent, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', handleWheelEvent, { passive: false });
    };
  }, []);

  const drawPipes = (ctx, pipes, nodes) => {
    const canvas = canvasRef.current;
    const height = canvas ? canvas.height : 800;
    
    pipes.forEach(pipe => {
      const fromNode = nodes.find(n => n.id === pipe.from_node);
      const toNode = nodes.find(n => n.id === pipe.to_node);

      if (!fromNode || !toNode) return;

      // Invert Y coordinates
      const fromY = height / scale - fromNode.coordinates.y;
      const toY = height / scale - toNode.coordinates.y;

      ctx.beginPath();
      ctx.moveTo(fromNode.coordinates.x, fromY);
      ctx.lineTo(toNode.coordinates.x, toY);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  };

  const drawNodes = (ctx, nodes) => {
    const canvas = canvasRef.current;
    const height = canvas ? canvas.height : 800;
    
    nodes.forEach(node => {
      const x = node.coordinates.x;
      // Invert Y coordinate
      const y = height / scale - node.coordinates.y;
      const isSelected = node.id === selectedNode;
      const isHovered = node.id === hoveredNode;

      // Make node radius shrink as we zoom in so pipes remain visible.
      // World-space radius scales as base / (scale^2) so on-screen radius ~= base/scale.
      // But cap the world radius so when zoomed OUT (scale < 1) nodes don't grow unbounded.
      const baseRadius = isSelected ? 10 : 8;
      const minWorldRadius = 2;
      const maxWorldRadius = baseRadius; // don't allow world radius to exceed base radius on zoom out
      // stronger shrink: divide by scale^RADIUS_EXPONENT
      const computedRadius = baseRadius / Math.pow(scale, RADIUS_EXPONENT);
      const worldRadius = Math.max(minWorldRadius, Math.min(maxWorldRadius, computedRadius));
      const glowBase = 20;
      const computedGlow = glowBase / Math.pow(scale, RADIUS_EXPONENT);
      const worldGlow = Math.max(4, Math.min(glowBase, computedGlow));

      // Node color based on risk level
      let color = '#10b981'; // green (none/low)
      if (node.leak_risk === 'high') color = '#ef4444';
      else if (node.leak_risk === 'medium') color = '#f59e0b';
      else if (node.leak_risk === 'low') color = '#eab308';

      // Draw node glow for selected/hovered (use worldGlow)
      if (isSelected || isHovered) {
        ctx.beginPath();
        ctx.arc(x, y, worldGlow, 0, Math.PI * 2);
        ctx.fillStyle = `${color}40`;
        ctx.fill();
      }

      // Draw node (use worldRadius so final pixel radius reduces as we zoom)
      ctx.beginPath();
      ctx.arc(x, y, worldRadius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Draw node border
      ctx.strokeStyle = isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.5)';
      // Keep border thin in world units so it doesn't overpower pipes after scaling
      // Also cap stroke width so it doesn't become huge when zoomed out
      const strokeWidth = isSelected ? Math.max(1, 3 / (scale)) : Math.max(0.6, 2 / (scale));
      ctx.lineWidth = Math.min(strokeWidth, 6);
      ctx.stroke();

      // Draw node label
      if (isSelected || isHovered) {
        ctx.fillStyle = '#ffffff';
        // use world-space font size so labels scale with zoom naturally
        ctx.font = `${Math.max(8, 12 / scale)}px Inter`;
        ctx.textAlign = 'center';
        ctx.fillText(node.id, x, y - (worldRadius + 8 / scale));
        
        // Draw risk level
        ctx.font = `${Math.max(7, 10 / scale)}px Inter`;
        ctx.fillStyle = color;
        ctx.fillText(node.leak_risk.toUpperCase(), x, y + (worldRadius + 10 / scale));
      }
    });
  };

  const getNodeAtPosition = (x, y) => {
    if (!networkData) return null;

    const canvas = canvasRef.current;
    const height = canvas ? canvas.height : 800;

    // Transform coordinates
    const transformedX = (x - offset.x) / scale;
    const transformedY = (y - offset.y) / scale;

    return networkData.nodes.find(node => {
      // Invert Y coordinate for hit detection
      const nodeY = height / scale - node.coordinates.y;
      const dx = node.coordinates.x - transformedX;
      const dy = nodeY - transformedY;
      // compute world-space radius used when drawing (same formula and caps as above)
      const baseRadiusNode = node.id === selectedNode ? 10 : 8;
      const minWorldRadiusNode = 2;
      const maxWorldRadiusNode = baseRadiusNode;
      const nodeWorldRadius = Math.max(minWorldRadiusNode, Math.min(maxWorldRadiusNode, baseRadiusNode / (scale * scale)));
      // hit threshold: use world radius plus a small buffer (in world units)
      const hitThreshold = Math.max(8, nodeWorldRadius + 6);
      return Math.sqrt(dx * dx + dy * dy) < hitThreshold;
    }) || null;
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isDragging) {
      setOffset({
        x: x - dragStart.x,
        y: y - dragStart.y,
      });
      return;
    }

    const node = getNodeAtPosition(x, y);
    setHoveredNode(node ? node.id : null);
    canvas.style.cursor = node ? 'pointer' : 'grab';
  };

  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const node = getNodeAtPosition(x, y);
    if (node) {
      onNodeSelect(node.id);
      return;
    }

    setIsDragging(true);
    setDragStart({
      x: x - offset.x,
      y: y - offset.y,
    });
    canvas.style.cursor = 'grabbing';
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (canvasRef.current) {
      canvasRef.current.style.cursor = hoveredNode ? 'pointer' : 'grab';
    }
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => Math.max(MIN_SCALE, Math.min(MAX_SCALE, prev * delta)));
  };

  const handleReset = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const handleMouseEnter = () => {
    // Disable page scroll when mouse enters canvas
    document.body.style.overflow = 'hidden';
  };

  const handleMouseLeaveCanvas = () => {
    // Re-enable page scroll when mouse leaves canvas
    document.body.style.overflow = 'auto';
  };

  return (
    <div className="network-map">
      <div className="map-header">
        <h3>Water Supply Network Map</h3>
        <div className="map-controls">
          <button className="btn btn-secondary" onClick={() => setScale(s => Math.min(MAX_SCALE, s * 1.3))}>
            Zoom In
          </button>
          <button className="btn btn-secondary" onClick={() => setScale(s => Math.max(MIN_SCALE, s * 0.8))}>
            Zoom Out
          </button>
          <button className="btn btn-secondary" onClick={handleReset}>
            Reset View
          </button>
        </div>
      </div>

      <div className="map-legend">
        <div className="legend-item">
          <span className="legend-dot" style={{ background: '#ef4444' }}></span>
          <span>High Risk</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: '#f59e0b' }}></span>
          <span>Medium Risk</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: '#eab308' }}></span>
          <span>Low Risk</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: '#10b981' }}></span>
          <span>No Risk</span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="map-canvas"
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={(e) => {
          handleMouseUp(e);
          handleMouseLeaveCanvas();
        }}
      />

      {selectedNode && (
        <div className="selected-node-info">
          <strong>Selected Node:</strong> {selectedNode}
        </div>
      )}
    </div>
  );
}

export default NetworkMap;
