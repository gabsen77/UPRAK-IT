import React, { useState, useEffect } from 'react';
import api from '../api/axiosConfig';

const statusBadge = (status) => {
  const map = {
    tepat_waktu: { class: 'badge-green',  label: 'Tepat Waktu' },
    telat:       { class: 'badge-yellow', label: 'Telat' },
    pulang:      { class: 'badge-blue',   label: 'Pulang' },
    unknown:     { class: 'badge-red',    label: 'Unknown' },
    ga_masuk:    { class: 'badge-gray',   label: 'Tidak Masuk' },
  };
  const s = map[status] || { class: 'badge-gray', label: status };
  return <span className={`badge ${s.class}`}>{s.label}</span>;
};

const weatherIcon = (w) => {
  const map = { hujan: '🌧️', lembab: '🌥️', panas: '☀️', normal: '⛅' };
  return <span className="weather-badge">{map[w] || '⛅'} {w}</span>;
};

const Dashboard = () => {
  const [attendance, setAttendance] = useState([]);
  const [error, setError]           = useState('');

  const fetchAttendance = async () => {
    try {
      const res = await api.get('/attendance');
      setAttendance(res.data);
      setError('');
    } catch (err) {
      setError('Gagal mengambil data. Apakah server menyala?');
    }
  };

  useEffect(() => {
    fetchAttendance();
    const interval = setInterval(fetchAttendance, 5000);
    return () => clearInterval(interval);
  }, []);

  const today = attendance.filter(r =>
    new Date(r.scanned_at).toDateString() === new Date().toDateString()
  );

  const stats = {
    total:       today.filter(r => r.status === 'present').length,
    tepat_waktu: today.filter(r => r.attendance_status === 'tepat_waktu').length,
    telat:       today.filter(r => r.attendance_status === 'telat').length,
    unknown:     today.filter(r => r.status === 'unknown').length,
  };

  return (
    <div>
      <div className="page-header">
        <h2>Dashboard Kehadiran</h2>
        <p>Data absensi real-time siswa hari ini</p>
      </div>

      {/* Stat Cards */}
      <div className="stats-grid">
        <div className="stat-card blue">
          <div className="stat-icon">👥</div>
          <div className="stat-info">
            <h3>{stats.total}</h3>
            <p>Total Hadir Hari Ini</p>
          </div>
        </div>
        <div className="stat-card green">
          <div className="stat-icon">✅</div>
          <div className="stat-info">
            <h3>{stats.tepat_waktu}</h3>
            <p>Tepat Waktu</p>
          </div>
        </div>
        <div className="stat-card yellow">
          <div className="stat-icon">⏰</div>
          <div className="stat-info">
            <h3>{stats.telat}</h3>
            <p>Telat</p>
          </div>
        </div>
        <div className="stat-card red">
          <div className="stat-icon">❓</div>
          <div className="stat-info">
            <h3>{stats.unknown}</h3>
            <p>Kartu Tidak Dikenal</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-header">
          <h3>Log Absensi</h3>
          <div className="live-badge">
            <span className="live-dot"></span> Live
          </div>
        </div>

        {error && <div className="alert alert-error" style={{margin:'16px 20px'}}>{error}</div>}

        <div className="table-wrapper">
          {attendance.length === 0 ? (
            <div className="empty-state">
              <div style={{fontSize:'2em'}}>📋</div>
              <p>Belum ada data absensi</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>UID Kartu</th>
                  <th>Nama</th>
                  <th>Kelas</th>
                  <th>Waktu</th>
                  <th>Tanggal</th>
                  <th>Status</th>
                  <th>Cuaca</th>
                  <th>Suhu</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map((r, i) => (
                  <tr key={r.id}>
                    <td style={{color:'#a0aec0', fontSize:'0.85em'}}>{i + 1}</td>
                    <td><span className="uid-tag">{r.uid}</span></td>
                    <td style={{fontWeight: 600}}>{r.name}</td>
                    <td>{r.class}</td>
                    <td style={{fontFamily:'monospace'}}>{r.time || '--:--'}</td>
                    <td>{r.date || new Date(r.scanned_at).toLocaleDateString('id-ID')}</td>
                    <td>{statusBadge(r.attendance_status || r.status)}</td>
                    <td>{weatherIcon(r.weather)}</td>
                    <td>{r.temperature ? `${r.temperature}°C` : '-'}</td>
                  </tr>
                ))}
                
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;