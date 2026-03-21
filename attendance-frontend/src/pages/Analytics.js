import React, { useState, useEffect } from 'react';
import api from '../api/axiosConfig';
import { Pie, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement,
  ArcElement, Title, Tooltip, Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const getTodayStr = () => {
  const now = new Date();
  const d = now.getDate().toString().padStart(2, '0');
  const m = (now.getMonth() + 1).toString().padStart(2, '0');
  const y = now.getFullYear();
  return `${d}/${m}/${y}`;
};

const Analytics = () => {
  const [weatherData, setWeatherData] = useState(null);
  const [dailyData,   setDailyData]   = useState(null);
  const [todayPie,    setTodayPie]    = useState(null);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [w, d, att] = await Promise.all([
          api.get('/analytics/weather'),
          api.get('/analytics/daily'),
          api.get('/attendance'),
        ]);

        // ---- Pie chart: status kehadiran hari ini ----
        const today = att.data.filter(r => r.date === getTodayStr());

        const tepat  = today.filter(r => r.attendance_status === 'tepat_waktu').length;
        const telat  = today.filter(r => r.attendance_status === 'telat').length;
        const pulang = today.filter(r => r.attendance_status === 'pulang').length;

        setTodayPie({
          labels: ['Tepat Waktu', 'Telat', 'Pulang'],
          datasets: [{
            data: [tepat, telat, pulang],
            backgroundColor: ['#34d399', '#fbbf24', '#60a5fa'],
            borderColor:     ['#10b981', '#f59e0b', '#3b82f6'],
            borderWidth: 2,
          }]
        });

        // ---- Pie chart: korelasi cuaca ----
        const labels  = [...new Set(w.data.map(r => r.weather))];
        const telatW  = labels.map(l => {
          const e = w.data.find(r => r.weather === l && r.attendance_status === 'telat');
          return e ? Number(e.total) : 0;
        });
        const tepatW  = labels.map(l => {
          const e = w.data.find(r => r.weather === l && r.attendance_status === 'tepat_waktu');
          return e ? Number(e.total) : 0;
        });

        setWeatherData({
          labels,
          datasets: [
            { label: 'Telat',       data: telatW, backgroundColor: '#fbbf24' },
            { label: 'Tepat Waktu', data: tepatW, backgroundColor: '#34d399' },
          ],
        });

        // ---- Bar chart: 7 hari terakhir ----
        const days = d.data.slice(0, 7).reverse();
        setDailyData({
          labels: days.map(r => r.date),
          datasets: [
            { label: 'Tepat Waktu', data: days.map(r => Number(r.tepat_waktu) || 0), backgroundColor: '#34d399' },
            { label: 'Telat',       data: days.map(r => Number(r.telat)       || 0), backgroundColor: '#fbbf24' },
            { label: 'Pulang',      data: days.map(r => Number(r.pulang)      || 0), backgroundColor: '#60a5fa' },
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

  const pieOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'bottom' },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.label}: ${ctx.raw} siswa`
        }
      }
    }
  };

  const barOptions = {
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

      {/* Row 1: 2 Pie chart */}
      <div className="chart-grid">
        <div className="card">
          <div className="card-header">
            <h3>Status Kehadiran Hari Ini</h3>
          </div>
          <div className="card-body" style={{ maxWidth: 320, margin: '0 auto' }}>
            {todayPie && (todayPie.datasets[0].data.some(v => v > 0)) ? (
              <Pie data={todayPie} options={pieOptions} />
            ) : (
              <div className="empty-state">
                <div style={{ fontSize: '2em' }}>📊</div>
                <p>Belum ada data hari ini</p>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Korelasi Cuaca vs Keterlambatan</h3>
          </div>
          <div className="card-body">
            {weatherData ? (
              <Bar data={weatherData} options={barOptions} />
            ) : (
              <div className="empty-state">
                <div style={{ fontSize: '2em' }}>🌤️</div>
                <p>Belum ada data cuaca</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Bar chart 7 hari */}
      <div className="card">
        <div className="card-header">
          <h3>Kehadiran 7 Hari Terakhir</h3>
        </div>
        <div className="card-body">
          {dailyData ? (
            <Bar data={dailyData} options={barOptions} />
          ) : (
            <div className="empty-state">
              <div style={{ fontSize: '2em' }}>📅</div>
              <p>Belum ada data harian</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Analytics;