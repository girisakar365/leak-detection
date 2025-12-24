import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { apiService } from '../services/api';
import './PressureChart.css';

function DemandChart({ nodeId }) {
  const data = [
  {timestamp: '2025-12-22T18:53:37.796793', base_demand: 106.36, actual_demand: 103.57},
  {timestamp: '2025-12-22T19:53:37.796831', base_demand: 98.1, actual_demand: 96.34},
  {timestamp: '2025-12-22T20:53:37.796865', base_demand: 90.41, actual_demand: 95.28},
  {timestamp: '2025-12-22T21:53:37.796879', base_demand: 83.8, actual_demand: 80.9},
  {timestamp: '2025-12-22T22:53:37.796896', base_demand: 78.73, actual_demand: 74.55},
  {timestamp: '2025-12-22T23:53:37.796907', base_demand: 75.54, actual_demand: 78.5},
  {timestamp: '2025-12-23T00:53:37.796918', base_demand: 74.45, actual_demand: 72.86},
  {timestamp: '2025-12-23T01:53:37.796929', base_demand: 75.54, actual_demand: 77.76},
  {timestamp: '2025-12-23T02:53:37.796940', base_demand: 78.73, actual_demand: 83.47},
  {timestamp: '2025-12-23T02:53:37.796940', base_demand: 78.73, actual_demand: 83.47},
  {timestamp: '2025-12-23T03:53:37.796952', base_demand: 83.8, actual_demand: 85.03},
  {timestamp: '2025-12-23T04:53:37.796962', base_demand: 90.41, actual_demand: 88.26},
  {timestamp: '2025-12-23T05:53:37.796972', base_demand: 98.1, actual_demand: 94.15},
  {timestamp: '2025-12-23T06:53:37.796982', base_demand: 106.36, actual_demand: 102.91},
  {timestamp: '2025-12-23T07:53:37.796994', base_demand: 114.62, actual_demand: 110.64},
  {timestamp: '2025-12-23T08:53:37.797004', base_demand: 122.32, actual_demand: 122.24},
  {timestamp: '2025-12-23T09:53:37.797013', base_demand: 128.93, actual_demand: 133.37},
  {timestamp: '2025-12-23T10:53:37.797023', base_demand: 134, actual_demand: 137.73},
  {timestamp: '2025-12-23T11:53:37.797033', base_demand: 137.19, actual_demand: 135.9},
  {timestamp: '2025-12-23T12:53:37.797043', base_demand: 138.27, actual_demand: 135.96},
  {timestamp: '2025-12-23T13:53:37.797052', base_demand: 137.19, actual_demand: 133.24},
  {timestamp: '2025-12-23T14:53:37.797066', base_demand: 134, actual_demand: 157.58},
  {timestamp: '2025-12-23T15:53:37.797078', base_demand: 128.93, actual_demand: 132.1},
  {timestamp: '2025-12-23T15:53:37.797078', base_demand: 128.93, actual_demand: 132.1},
  {timestamp: '2025-12-23T16:53:37.797088', base_demand: 122.32, actual_demand: 119.36},
  {timestamp: '2025-12-23T17:53:37.797098', base_demand: 114.62, actual_demand: 127.73}
];
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // const response = await apiService.getDemandData(nodeId);
        // console.log('Demand data response:', response);
        // setData(response.data);
      } catch (error) {
        console.error('Error fetching demand data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [nodeId]);

  const formatXAxis = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="label">{new Date(payload[0].payload.timestamp).toLocaleString()}</p>
          <p className="value" style={{ color: '#10b981' }}>
            Base: {payload[0].value.toFixed(2)} GPM
          </p>
          <p className="value" style={{ color: '#f59e0b' }}>
            Actual: {payload[1].value.toFixed(2)} GPM
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="demand-chart">
      <div className="chart-header">
        <h3>Demand Analysis</h3>
        <span className="node-badge">Node: {nodeId}</span>
      </div>

      {loading ? (
        <div className="chart-loading">
          <div className="spinner"></div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" minHeight={300} height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
            <XAxis 
              dataKey="timestamp" 
              tickFormatter={formatXAxis}
              stroke="#94a3b8"
              style={{ fontSize: '0.75rem' }}
            />
            <YAxis 
              stroke="#94a3b8"
              style={{ fontSize: '0.75rem' }}
              label={{ value: 'Flow (GPM)', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ fontSize: '0.875rem', color: '#cbd5e1' }}
            />
            <Line 
              type="monotone" 
              dataKey="base_demand" 
              stroke="#10b981" 
              strokeWidth={2}
              dot={false}
              name="Base Demand"
              activeDot={{ r: 6 }}
            />
            <Line 
              type="monotone" 
              dataKey="actual_demand" 
              stroke="#f59e0b" 
              strokeWidth={2}
              dot={false}
              name="Actual Demand"
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default DemandChart;
