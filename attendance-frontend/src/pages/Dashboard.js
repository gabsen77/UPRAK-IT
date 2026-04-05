import React, { useState, useEffect } from 'react';
import api from '../api/axiosConfig';

const getTodayStr = () => {
  const now = new Date();
  const d = now.getDate().toString().padStart(2, '0');
  const m = (now.getMonth() + 1).toString().padStart(2, '0');
  const y = now.getFullYear();
  return `${d}/${m}/${y}`;
};

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
  const [attendance,    setAttendance]    = useState([]);
  const [error,         setError]         = useState('');
  const [search,        setSearch]        = useState('');
  const [filterClass,   setFilterClass]   = useState('');
  const [filterStatus,  setFilterStatus]  = useState('');
  const [showUnknown,   setShowUnknown]   = useState(false);
  const [filterDate, setFilterDate] = useState('');
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearType, setClearType]           = useState('today'); // 'today', 'range', 'all'
  const [clearStart, setClearStart]         = useState('');
  const [clearEnd, setClearEnd]             = useState('');


  const fetchAttendance = async () => {
    try {
      const res = await api.get('/attendance');
      setAttendance(res.data);
      setError('');
    } catch (err) {
      setError('Gagal mengambil data. Apakah server menyala?');
    }
  };

  const openClearModal = () => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user?.role !== 'admin') {
      alert('Hanya admin yang dapat menghapus log!');
      return;
    }
    setShowClearModal(true);
  };

  const executeClearLogs = async () => {
    let url = '/attendance/clear';
    let confirmMsg = '';

    if (clearType === 'today') {
      url += `?date=${getTodayStr()}`;
      confirmMsg = `Yakin hapus data HARI INI (${getTodayStr()})?`;
    } else if (clearType === 'range') {
      if (!clearStart || !clearEnd) {
        alert('Harap pilih Tanggal Awal dan Tanggal Akhir!');
        return;
      }
      url += `?startDate=${clearStart}&endDate=${clearEnd}`;
      confirmMsg = `Yakin hapus data dari tanggal ${clearStart} sampai ${clearEnd}?`;
    } else if (clearType === 'all') {
      confirmMsg = `⚠️ PERINGATAN FATAL!\n\nYakin ingin menghapus SELURUH DATA? Data tidak bisa dikembalikan!`;
    }

    if (window.confirm(confirmMsg)) {
      try {
        const res = await api.delete(url);
        alert(`Berhasil menghapus ${res.data.deleted} data absensi.`);
        setShowClearModal(false);
        fetchAttendance(); // Refresh tabel
      } catch (err) {
        alert("Gagal menghapus log: " + (err.response?.data?.error || err.message));
      }
    }
  };

  useEffect(() => {
    fetchAttendance();
    const interval = setInterval(fetchAttendance, 5000);

    // Cek pergantian hari, reload halaman
    const checkMidnight = setInterval(() => {
      const now = new Date();
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        window.location.reload();
      }
    }, 60000); // cek tiap 1 menit

    return () => {
      clearInterval(interval);
      clearInterval(checkMidnight);
    };
  }, []);

  const today = attendance.filter(r => r.date === getTodayStr());

  const stats = {
    total:       today.filter(r => r.status === 'present').length,
    tepat_waktu: today.filter(r => r.attendance_status === 'tepat_waktu').length,
    telat:       today.filter(r => r.attendance_status === 'telat').length,
    unknown:     today.filter(r => r.status === 'unknown').length,
  };

  // Ambil list kelas unik untuk filter dropdown
  const kelasList = [...new Set(
    attendance.filter(r => r.class && r.class !== 'Unknown').map(r => r.class)
  )].sort();

  // Filter data
  const filtered = attendance.filter(r => {
  if (!showUnknown && r.status === 'unknown') return false;
  if (search && !r.name?.toLowerCase().includes(search.toLowerCase())) return false;
  if (filterClass && r.class !== filterClass) return false;
  if (filterStatus && r.attendance_status !== filterStatus) return false;
  if (filterDate) {
  const [y, m, d] = filterDate.split('-');
  const formatted = `${d}/${m}/${y}`;
  if (r.date !== formatted) return false;
  }
  return true;
  });

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
        <div className="stat-card red"
          onClick={() => setShowUnknown(!showUnknown)}
          style={{ cursor: 'pointer' }}
          title="Klik untuk toggle tampilan unknown"
        >
          <div className="stat-icon">❓</div>
          <div className="stat-info">
            <h3>{stats.unknown}</h3>
            <p>Kartu Tidak Dikenal {showUnknown ? '(ditampilkan)' : '(disembunyikan)'}</p>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="card-body" style={{
          display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center'
        }}>
          {/* Search nama */}
          <input
            type="text"
            placeholder="🔍 Cari nama siswa..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1, minWidth: '200px',
              padding: '9px 14px',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '0.9em',
              outline: 'none',
            }}
          />

          <input
            type="date"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            style={{
              padding: '9px 14px',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '0.9em',
              outline: 'none',
            }}
          />

          {/* Filter kelas */}
          <select
            value={filterClass}
            onChange={e => setFilterClass(e.target.value)}
            style={{
              padding: '9px 14px',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '0.9em',
              outline: 'none',
              minWidth: '150px',
            }}
          >
            <option value="">Semua Kelas</option>
            {kelasList.map(k => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>

          {/* Filter status */}
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            style={{
              padding: '9px 14px',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '0.9em',
              outline: 'none',
              minWidth: '160px',
            }}
          >
            <option value="">Semua Status</option>
            <option value="tepat_waktu">Tepat Waktu</option>
            <option value="telat">Telat</option>
            <option value="pulang">Pulang</option>
          </select>

          {/* Toggle unknown */}
          <button
            onClick={() => setShowUnknown(!showUnknown)}
            style={{
              padding: '9px 14px',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '0.9em',
              cursor: 'pointer',
              background: showUnknown ? '#fef2f2' : '#f8fafc',
              color: showUnknown ? '#dc2626' : '#718096',
              fontWeight: 500,
            }}
          >
            {showUnknown ? '🚫 Sembunyikan Unknown' : '👁️ Tampilkan Unknown'}
          </button>

          {/* Reset filter */}
          {(search || filterClass || filterStatus) && (
            <button
              onClick={() => { setSearch(''); setFilterClass(''); setFilterStatus(''); }}
              style={{
                padding: '9px 14px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '0.9em',
                cursor: 'pointer',
                background: '#f8fafc',
                color: '#718096',
              }}
            >✕ Reset Filter</button>
          )}

          <span style={{ fontSize: '0.85em', color: '#a0aec0', marginLeft: 'auto' }}>
            {filtered.length} data ditampilkan
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h3 style={{ margin: 0 }}>Log Absensi</h3>
            <div className="live-badge">
              <span className="live-dot"></span> Live
            </div>
          </div>

          {/* Tombol Clear Log hanya muncul jika login sebagai admin */}
          {JSON.parse(localStorage.getItem('user'))?.role === 'admin' && (
            <button 
              onClick={openClearModal}
              style={{
                background: '#fef2f2',
                color: '#dc2626',
                border: '1px solid #fecaca',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.85em',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              🗑️ Clear Log
            </button>
          )}

        </div>

        {error && (
          <div className="alert alert-error" style={{ margin: '16px 20px' }}>{error}</div>
        )}

        <div className="table-wrapper">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <div style={{ fontSize: '2em' }}>📋</div>
              <p>Tidak ada data yang sesuai</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nama</th>
                  <th>Kelas</th>
                  <th>UID Kartu</th>
                  <th>Waktu</th>
                  <th>Tanggal</th>
                  <th>Status</th>
                  <th>Cuaca</th>
                  <th>Suhu</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.id} style={{
                    background: r.status === 'unknown' ? '#fff5f5' : 'inherit'
                  }}>
                    <td style={{ color: '#a0aec0', fontSize: '0.85em' }}>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{r.name}</td>
                    <td>{r.class}</td>
                    <td><span className="uid-tag">{r.uid}</span></td>
                    <td style={{ fontFamily: 'monospace' }}>{r.time || '--:--'}</td>
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
      
    {/* MODAL CLEAR LOG */}
      {showClearModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'white', padding: '24px', borderRadius: '12px',
            width: '100%', maxWidth: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px', color: '#1e293b' }}>🗑️ Hapus Log Absensi</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="radio" name="cleartype" value="today" 
                  checked={clearType === 'today'} onChange={() => setClearType('today')} />
                Hanya Hari Ini ({getTodayStr()})
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="radio" name="cleartype" value="range" 
                  checked={clearType === 'range'} onChange={() => setClearType('range')} />
                Rentang Tanggal (Range)
              </label>

              {/* Input Tanggal muncul kalau pilih Range */}
              {clearType === 'range' && (
                <div style={{ display: 'flex', gap: '10px', marginLeft: '24px', padding: '10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.8em', color: '#64748b', marginBottom: '4px' }}>Dari Tanggal</div>
                    <input type="date" value={clearStart} onChange={e => setClearStart(e.target.value)}
                      style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.8em', color: '#64748b', marginBottom: '4px' }}>Sampai Tanggal</div>
                    <input type="date" value={clearEnd} onChange={e => setClearEnd(e.target.value)}
                      style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  </div>
                </div>
              )}

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#dc2626', fontWeight: 600 }}>
                <input type="radio" name="cleartype" value="all" 
                  checked={clearType === 'all'} onChange={() => setClearType('all')} />
                Hapus Semua Data (Reset Total)
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setShowClearModal(false)} style={{
                padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1',
                background: '#f8fafc', color: '#475569', cursor: 'pointer', fontWeight: 600
              }}>Batal</button>
              
              <button onClick={executeClearLogs} style={{
                padding: '8px 16px', borderRadius: '6px', border: 'none',
                background: '#ef4444', color: 'white', cursor: 'pointer', fontWeight: 600
              }}>Hapus Data</button>
            </div>
          </div>
        </div>
      )}
      {/* END MODAL */}

    </div> // INI ADALAH PENUTUP </div> UTAMA COMPONENT ANDA
  );
};
export default Dashboard;