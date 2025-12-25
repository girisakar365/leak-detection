import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

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
   * @returns {Promise<Object>} { nodes: [], pipes: [], total_nodes, total_pipes, timestamp, system_status }
   */
  async getNetworkData() {
    const response = await this.axiosInstance.get('/api/network');
    return response.data;
  }

  /**
   * Get leak predictions
   * @returns {Promise<Object>} { leak_x: [], leak_y: [], leak_size_lps: [] }
   */
  async getLeakPredictions() {
    const response = await this.axiosInstance.get('/api/leak-predictions');
    return response.data;
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
