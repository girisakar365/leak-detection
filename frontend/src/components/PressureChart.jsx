import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { apiService } from '../services/api';
import './PressureChart.css';

function PressureChart({ nodeId }) {
  const [loading, setLoading] = useState(true);

const data = [{timestamp: '2025-12-22T19:57:57.473717', pressure: 56.03},
{timestamp: '2025-12-22T20:57:57.473752', pressure: 59.97},
{timestamp: '2025-12-22T21:57:57.473768', pressure: 61.37},
{timestamp: '2025-12-22T22:57:57.473782', pressure: 60.88},
{timestamp: '2025-12-22T23:57:57.473793', pressure: 61.94},
{timestamp: '2025-12-23T00:57:57.473804', pressure: 57.73},
{timestamp: '2025-12-23T01:57:57.473817', pressure: 55.66},
{timestamp: '2025-12-23T02:57:57.473828', pressure: 52.81},
{timestamp: '2025-12-23T03:57:57.473867', pressure: 53.7},
{timestamp: '2025-12-23T04:57:57.473881', pressure: 51.05},
{timestamp: '2025-12-23T05:57:57.473893', pressure: 53.53},
{timestamp: '2025-12-23T06:57:57.473907', pressure: 53.23},
{timestamp: '2025-12-23T07:57:57.473917', pressure: 55.73},
{timestamp: '2025-12-23T08:57:57.473929', pressure: 57.73},
{timestamp: '2025-12-23T09:57:57.473939', pressure: 58.11},
{timestamp: '2025-12-23T10:57:57.473949', pressure: 61.83},
{timestamp: '2025-12-23T11:57:57.473961', pressure: 61.45},
{timestamp: '2025-12-23T12:57:57.473973', pressure: 59.93},
{timestamp: '2025-12-23T13:57:57.473985', pressure: 58.75},
{timestamp: '2025-12-23T14:57:57.473996', pressure: 58.06},
{timestamp: '2025-12-23T15:57:57.474008', pressure: 52.99},
{timestamp: '2025-12-23T16:57:57.474019', pressure: 52.42},
{timestamp: '2025-12-23T17:57:57.474031', pressure: 50.42},
{timestamp: '2025-12-23T18:57:57.474042', pressure: 51.71}]

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // const response = await apiService.getPressureData(nodeId, 24);
        // setData(response.data);
        // console.log('Pressure data response:', response);
      } catch (error) {
        console.error('Error fetching pressure data:', error);
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
          <p className="value" style={{ color: '#3b82f6' }}>
            Pressure: {payload[0].value.toFixed(2)} psi
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="pressure-chart">
      <div className="chart-header">
        <h3>Pressure Over Time</h3>
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
              label={{ value: 'Pressure (psi)', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ fontSize: '0.875rem', color: '#cbd5e1' }}
            />
            <Line 
              type="monotone" 
              dataKey="pressure" 
              stroke="#3b82f6" 
              strokeWidth={2}
              dot={false}
              name="Pressure"
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default PressureChart;
