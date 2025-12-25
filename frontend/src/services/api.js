import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

// helper that returns a promise that rejects after ms
const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms));

class APIService {
  constructor() {
    this.axiosInstance = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Get network topology data (nodes and pipes)
   * Returns a normalized object so the frontend can render quickly even on partial responses
   */
  async getNetworkData() {
    try {
      const p = this.axiosInstance.get('/api/network');
      const response = await Promise.race([p, timeout(8000)]);
      const d = response.data || {};
      return {
        nodes: d.nodes || [],
        pipes: d.pipes || [],
        total_nodes: d.total_nodes ?? (d.nodes ? d.nodes.length : 0),
        total_pipes: d.total_pipes ?? (d.pipes ? d.pipes.length : 0),
        system_status: d.system_status || 'unknown',
        timestamp: d.timestamp || new Date().toISOString(),
      };
    } catch (err) {
      console.error('getNetworkData error', err.message || err);
      return { nodes: [], pipes: [], total_nodes: 0, total_pipes: 0, system_status: 'error', timestamp: new Date().toISOString() };
    }
  }

  /**
   * Get leak predictions
   * Normalize to { leak_x, leak_y, leak_size_lps, node_id }
   */
  async getLeakPredictions() {
    try {
      const p = this.axiosInstance.get('/api/leak-predictions');
      const response = await Promise.race([p, timeout(8000)]);
      let preds = response.data;

      // Backend may return array or object. Take first if array.
      if (Array.isArray(preds) && preds.length > 0) preds = preds[0];
      preds = preds || {};

      return {
        leak_x: preds.leak_x || [],
        leak_y: preds.leak_y || [],
        leak_size_lps: preds.leak_size_lps || [],
        node_id: preds.node_id || preds.nodeId || null,
        timestamp: preds.timestamp || new Date().toISOString()
      };
    } catch (err) {
      console.error('getLeakPredictions error', err.message || err);
      return { leak_x: [], leak_y: [], leak_size_lps: [], node_id: null, timestamp: new Date().toISOString() };
    }
  }

  /**
   * Generate simulation data for a specific node
   * @param {Object} params - Query parameters
   * @param {string} params.nodeId - Node identifier (required)
   * @param {number} params.emitterCof - Emitter coefficient (default: 0.5)
   * @param {number} params.collectionStartHour - Collection start hour (default: 0)
   * @param {number} params.leakStartMin - Leak start minute (default: 60)
   * @param {number} params.leakDurationHours - Leak duration in hours (default: 4)
   * @returns {Promise<Object>} Complex object with pressure_history, demand_history, average_pressure, etc.
   */
  async generateData(params = {}) {
    const {
      nodeId,
      emitterCof = 0.5,
      collectionStartHour = 0,
      leakStartMin = 60,
      leakDurationHours = 4
    } = params;

    const response = await this.axiosInstance.get('/api/generate_data', {
      params: {
        node_id: nodeId,
        emitter_cof: emitterCof,
        collection_start_hour: collectionStartHour,
        leak_start_min: leakStartMin,
        leak_duration_hours: leakDurationHours
      },
    });
    return response.data;
  }

  /**
   * Health check endpoint
   * @returns {Promise<Object>} { status, service, version }
   */
  async healthCheck() {
    const response = await this.axiosInstance.get('/');
    return response.data;
  }

  // Note: The following endpoints are currently COMMENTED OUT in the backend (main.py)
  // and are NOT available:
  // - /api/pressure-data/{nodeId}
  // - /api/demand-data/{nodeId}
  // - /api/affected-nodes/{nodeId}
  // - /api/statistics
  //
  // If you need these endpoints, uncomment them in backend/main.py first.
}

export const apiService = new APIService();
