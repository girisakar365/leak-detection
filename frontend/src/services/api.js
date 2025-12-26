/**
 * API Service for Water Supply Leak Detection System
 * Centralizes all backend API calls
 */

const API_BASE_URL = 'http://localhost:8000/api';

/**
 * Fetch network topology (nodes and pipes)
 */
export async function fetchNetwork() {
  const response = await fetch(`${API_BASE_URL}/network`);
  if (!response.ok) {
    throw new Error(`Failed to fetch network: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Fetch observation nodes (nodes that can be monitored)
 */
export async function fetchObservationNodes() {
  const response = await fetch(`${API_BASE_URL}/observation-nodes`);
  if (!response.ok) {
    throw new Error(`Failed to fetch observation nodes: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Run monitoring simulation and get leak predictions
 * @param {Object} params - Monitoring parameters
 * @param {string} params.node_id - Node ID to simulate leak at
 * @param {number} params.emitter_coefficient - Leak emitter coefficient
 * @param {number} params.duration_hours - Leak duration in hours
 * @param {number} params.start_time - Start time (1-24 user-friendly format)
 */
export async function runMonitoring(params) {
  const response = await fetch(`${API_BASE_URL}/run-monitoring`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Monitoring failed: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get leak predictions from existing data
 */
export async function fetchLeakPredictions() {
  const response = await fetch(`${API_BASE_URL}/leak-predictions`);
  if (!response.ok) {
    throw new Error(`Failed to fetch predictions: ${response.statusText}`);
  }
  return response.json();
}
