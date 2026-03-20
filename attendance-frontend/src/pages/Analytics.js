import React, { useState, useEffect } from 'react';
import api from '../api/axiosConfig';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement,
  Title, Tooltip, Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const Analytics = () => {
  const [weatherData, setWeatherData] = useState(null);
  const [dailyData,   setDailyData]   = useState(null);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [w, d] = await Promise.all([
          api.get('/analytics/weather'),
          api.get('/analytics/daily'),
        ]);

        // Weather chart
        const labels   = [...new Set(w.data.map(r => r.weather))];
        const telat     = labels.map(l => {
          const e = w.data.find(r => r.weather === l && r.attendance_status === 'telat');
          return e ? Number(e.total) : 0;
        });
        const tepat = labels.map(l => {
          const e = w.data.find(r => r.weather === l && r.attendance_status === 'tepat_waktu');
          return e ? Number(e.total) : 0;
        });

        setWeatherData({
          labels,
          datasets: [
            { label: 'Telat',        data: telat, backgroundColor: '#fbbf24' },
            { label: 'Tepat Waktu',  data: tepat, backgroundColor: '#34d399' },
          ],
        });

        // Daily chart
        const days = d.data.slice(0, 7).reverse();
        setDailyData({
          labels: days.map(r => r.date),
          datasets: [
            { label: 'Tepat Waktu', data: days.map(r => Number(r.tepat_waktu) || 0), backgroundColor: '#34d399' },
            { label: 'Telat',       data: days.map(r => Number(r.telat) || 0),       backgroundColor: '#fbbf24' },
            { label: 'Pulang',      data: days.map(r => Number(r.pulang) || 0),      backgroundColor: '#60a5fa' },
          ],
        });

      } catch (err) {
        console.error('Failed to fetch analytics', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const chartOptions = {
    responsive: true,
    plugins: { legend: { position: 'bottom' } },
    scales: { x: { grid: { display: false } } },
  };

  if (loading) return <div className="loading">Memuat data analytics...</div>;

  return (
    <div>
      <div className="page-header">
        <h2>Analytics</h2>
        <p>Analisis data kehadiran dan korelasi cuaca</p>
      </div>

      <div className="chart-grid">
        <div className="card">
          <div className="card-header">
            <h3>Kehadiran 7 Hari Terakhir</h3>
          </div>
          <div className="card-body">
            {dailyData
              ? <Bar data={dailyData} options={chartOptions} />
              : <div className="empty-state"><p>Belum ada data harian</p></div>
            }
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Korelasi Cuaca vs Keterlambatan</h3>
          </div>
          <div className="card-body">
            {weatherData
              ? <Bar data={weatherData} options={chartOptions} />
              : <div className="empty-state"><p>Belum ada data cuaca</p></div>
            }
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;