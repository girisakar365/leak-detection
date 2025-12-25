/**
 * Coordinate transformation utilities for EPANET to GPS coordinates
 * Transforms normalized coordinates (0-1000) to Kathmandu lat/lng
 */

// Kathmandu city center coordinates
const KATHMANDU_CENTER = {
  lat: 27.7172,
  lng: 85.3240
};

// Scale factor to spread the network over a realistic area
// This represents roughly a 5km x 5km area
const SCALE_FACTOR = 0.02; // degrees per 1000 units

/**
 * Transform EPANET coordinates to GPS coordinates
 * @param {number} x - Normalized x coordinate (0-1000)
 * @param {number} y - Normalized y coordinate (0-1000)
 * @returns {{lat: number, lng: number}} GPS coordinates
 */
export const transformToGPS = (x, y) => {
  // Center the coordinates (0-1000 to -500 to 500)
  const centeredX = x - 500;
  const centeredY = y - 500;
  
  // Transform to lat/lng
  // Y maps to latitude (north-south)
  // X maps to longitude (east-west)
  const lat = KATHMANDU_CENTER.lat + (centeredY / 1000) * SCALE_FACTOR;
  const lng = KATHMANDU_CENTER.lng + (centeredX / 1000) * SCALE_FACTOR;
  
  return { lat, lng };
};

/**
 * Transform GPS coordinates back to EPANET coordinates
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {{x: number, y: number}} EPANET coordinates
 */
export const transformFromGPS = (lat, lng) => {
  const y = ((lat - KATHMANDU_CENTER.lat) / SCALE_FACTOR) * 1000 + 500;
  const x = ((lng - KATHMANDU_CENTER.lng) / SCALE_FACTOR) * 1000 + 500;
  
  return { x, y };
};

/**
 * Get bounds for the network to fit the map view
 * @param {Array} nodes - Array of nodes with coordinates
 * @returns {Array} [[south, west], [north, east]] bounds
 */
export const getNetworkBounds = (nodes) => {
  if (!nodes || nodes.length === 0) {
    return [
      [KATHMANDU_CENTER.lat - 0.01, KATHMANDU_CENTER.lng - 0.01],
      [KATHMANDU_CENTER.lat + 0.01, KATHMANDU_CENTER.lng + 0.01]
    ];
  }
  
  const coords = nodes.map(node => 
    transformToGPS(node.coordinates.x, node.coordinates.y)
  );
  
  const lats = coords.map(c => c.lat);
  const lngs = coords.map(c => c.lng);
  
  return [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)]
  ];
};
