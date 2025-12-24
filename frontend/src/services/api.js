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

  async getNetworkData() {
    const response = await this.axiosInstance.get('/api/network');
    return response.data;
  }

  async getLeakPredictions() {
    const response = await this.axiosInstance.get('/api/leak-predictions');
    return response.data;
  }

  async getPressureData(nodeId, hours = 24) {
    const response = await this.axiosInstance.get(`/api/pressure-data/${nodeId}`, {
      params: { hours },
    });
    return response.data;
  }

  async getDemandData(nodeId) {
    const response = await this.axiosInstance.get(`/api/demand-data/${nodeId}`);
    return response.data;
  }

  async getAffectedNodes(nodeId) {
    const response = await this.axiosInstance.get(`/api/affected-nodes/${nodeId}`);
    return response.data;
  }

  async getStatistics() {
    const response = await this.axiosInstance.get('/api/statistics');
    return response.data;
  }

  async healthCheck() {
    const response = await this.axiosInstance.get('/');
    return response.data;
  }
}

export const apiService = new APIService();
