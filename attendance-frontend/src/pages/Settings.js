import React, { useState, useEffect } from 'react';
import api from '../api/axiosConfig';

const Settings = () => {
  const [currentPw,  setCurrentPw]  = useState('');
  const [newPw,      setNewPw]      = useState('');
  const [confirmPw,  setConfirmPw]  = useState('');
  const [pwMsg,      setPwMsg]      = useState('');
  const [pwType,     setPwType]     = useState('');

  const [schedule,   setSchedule]   = useState({
    jam_masuk_h: 6,  jam_masuk_m: 30,
    jam_telat_h: 6,  jam_telat_m: 30,
    jam_pulang_h: 15, jam_pulang_m: 20,
  });
  const [schedMsg,   setSchedMsg]   = useState('');

  const [startDate,  setStartDate]  = useState('');
  const [endDate,    setEndDate]    = useState('');

  useEffect(() => {
    api.get('/schedule/today').then(res => setSchedule(res.data));
  }, []);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (newPw !== confirmPw) {
      setPwMsg('Password baru tidak cocok'); setPwType('error'); return;
    }
    if (newPw.length < 6) {
      setPwMsg('Password minimal 6 karakter'); setPwType('error'); return;
    }
    try {
      await api.put('/auth/password', { currentPassword: currentPw, newPassword: newPw });
      setPwMsg('Password berhasil diubah!'); setPwType('success');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err) {
      setPwMsg(err.response?.data?.error || 'Gagal mengubah password');
      setPwType('error');
    }
  };

  const handleScheduleSave = async (e) => {
    e.preventDefault();
    try {
      await api.post('/schedule/today', schedule);
      setSchedMsg('Jadwal hari ini berhasil disimpan!');
      setTimeout(() => setSchedMsg(''), 3000);
    } catch (err) {
      setSchedMsg('Gagal menyimpan jadwal');
    }
  };

  const handleExport = () => {
    const token = localStorage.getItem('token');
    let url = 'https://uprak-it-production.up.railway.app/api/export/excel';
    if (startDate && endDate) url += `?startDate=${startDate}&endDate=${endDate}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = 'laporan-absensi.xlsx';
    a.click();
  };

  const inputStyle = {
    width: '80px', padding: '8px 10px',
    border: '1px solid #e2e8f0', borderRadius: '6px',
    fontSize: '0.9em', outline: 'none', textAlign: 'center',
  };

  return (
    <div>
      <div className="page-header">
        <h2>Pengaturan</h2>
        <p>Kelola password, jadwal, dan export data</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

        {/* Ganti Password */}
        <div className="card">
          <div className="card-header"><h3>Ganti Password</h3></div>
          <div className="card-body">
            <form onSubmit={handlePasswordChange}>
              <div className="form-group">
                <label>Password Lama</label>
                <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="Password saat ini"/>
              </div>
              <div className="form-group">
                <label>Password Baru</label>
                <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Minimal 6 karakter"/>
              </div>
              <div className="form-group">
                <label>Konfirmasi Password Baru</label>
                <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Ulangi password baru"/>
              </div>
              <button type="submit" className="btn-primary">Simpan Password</button>
            </form>
            {pwMsg && <div className={`alert alert-${pwType === 'success' ? 'success' : 'error'}`}>{pwMsg}</div>}
          </div>
        </div>

        {/* Jam Masuk Hari Ini */}
        <div className="card">
          <div className="card-header"><h3>Edit Jam Masuk Hari Ini</h3></div>
          <div className="card-body">
            <form onSubmit={handleScheduleSave}>
              {[
                { label: 'Jam Masuk',  hKey: 'jam_masuk_h',  mKey: 'jam_masuk_m' },
                { label: 'Batas Telat', hKey: 'jam_telat_h', mKey: 'jam_telat_m' },
                { label: 'Jam Pulang', hKey: 'jam_pulang_h', mKey: 'jam_pulang_m' },
              ].map(({ label, hKey, mKey }) => (
                <div className="form-group" key={hKey}>
                  <label>{label}</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="number" min="0" max="23"
                      value={schedule[hKey]}
                      onChange={e => setSchedule({ ...schedule, [hKey]: Number(e.target.value) })}
                      style={inputStyle}
                    />
                    <span style={{ color: '#718096', fontWeight: 600 }}>:</span>
                    <input
                      type="number" min="0" max="59"
                      value={schedule[mKey]}
                      onChange={e => setSchedule({ ...schedule, [mKey]: Number(e.target.value) })}
                      style={inputStyle}
                    />
                    <span style={{ color: '#718096', fontSize: '0.85em' }}>
                      {String(schedule[hKey]).padStart(2,'0')}:{String(schedule[mKey]).padStart(2,'0')}
                    </span>
                  </div>
                </div>
              ))}
              <button type="submit" className="btn-primary">Simpan Jadwal Hari Ini</button>
              {schedMsg && <div className="alert alert-success" style={{ marginTop: 12 }}>{schedMsg}</div>}
            </form>
          </div>
        </div>

        {/* Export Excel */}
        <div className="card">
          <div className="card-header"><h3>Export Laporan Excel</h3></div>
          <div className="card-body">
            <div className="form-group">
              <label>Dari Tanggal</label>
              <input
                type="date" value={startDate}
                onChange={e => setStartDate(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.95em', outline: 'none' }}
              />
            </div>
            <div className="form-group">
              <label>Sampai Tanggal</label>
              <input
                type="date" value={endDate}
                onChange={e => setEndDate(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.95em', outline: 'none' }}
              />
            </div>
            <p style={{ fontSize: '0.82em', color: '#a0aec0', marginBottom: 12 }}>
              Kosongkan tanggal untuk export semua data
            </p>
            <button onClick={handleExport} className="btn-primary">
              ⬇️ Download Excel
            </button>
          </div>
        </div>

        {/* Filter Dashboard by tanggal — info card */}
        <div className="card">
          <div className="card-header"><h3>Info</h3></div>
          <div className="card-body">
            <p style={{ fontSize: '0.9em', color: '#4a5568', lineHeight: 1.7 }}>
              Filter by tanggal tersedia di halaman <strong>Dashboard</strong> — gunakan filter tanggal di bagian search bar untuk melihat data hari tertentu.
            </p>
            <br/>
            <p style={{ fontSize: '0.9em', color: '#4a5568', lineHeight: 1.7 }}>
              Notifikasi WhatsApp bisa dikirim manual per siswa dari halaman <strong>Students</strong> dengan klik tombol <strong>WA</strong>.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Settings;