import React, { useState, useEffect } from 'react';
import api from '../api/axiosConfig';

const BASE_URL = 'https://uprak-it-production.up.railway.app/api';

const Settings = () => {
  const now = new Date();

  // -------- PASSWORD STATE --------
  const [currentPw,  setCurrentPw]  = useState('');
  const [newPw,      setNewPw]      = useState('');
  const [confirmPw,  setConfirmPw]  = useState('');
  const [pwMsg,      setPwMsg]      = useState('');
  const [pwType,     setPwType]     = useState('');

  // -------- SCHEDULE STATE --------
  const [schedule,   setSchedule]   = useState({
    jam_masuk_h: 6,  jam_masuk_m: 30,
    jam_telat_h: 6,  jam_telat_m: 30,
    jam_pulang_h: 15, jam_pulang_m: 20,
  });
  const [schedMsg,   setSchedMsg]   = useState('');
  const [schedType,  setSchedType]  = useState('');

  // -------- EXPORT STATE --------
  const [startDate,    setStartDate]    = useState('');
  const [endDate,      setEndDate]      = useState('');
  const [exportMsg,    setExportMsg]    = useState('');
  const [exportMsgType,setExportMsgType]= useState('');

  // -------- FETCH SCHEDULE --------
  useEffect(() => {
    api.get('/schedule/today').then(res => {
      setSchedule({
        jam_masuk_h:  res.data.jam_masuk_h  ?? 6,
        jam_masuk_m:  res.data.jam_masuk_m  ?? 30,
        jam_telat_h:  res.data.jam_telat_h  ?? 6,
        jam_telat_m:  res.data.jam_telat_m  ?? 30,
        jam_pulang_h: res.data.jam_pulang_h ?? 15,
        jam_pulang_m: res.data.jam_pulang_m ?? 20,
      });
    }).catch(() => {});
  }, []);

  // -------- HANDLERS --------

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (newPw !== confirmPw) {
      setPwMsg('Password baru tidak cocok'); setPwType('error'); return;
    }
    if (newPw.length < 6) {
      setPwMsg('Password minimal 6 karakter'); setPwType('error'); return;
    }
    try {
      await api.put('/auth/password', {
        currentPassword: currentPw,
        newPassword:     newPw,
      });
      setPwMsg('Password berhasil diubah!');
      setPwType('success');
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
      setSchedType('success');
      setTimeout(() => setSchedMsg(''), 3000);
    } catch (err) {
      setSchedMsg('Gagal menyimpan jadwal');
      setSchedType('error');
    }
  };

  const handleExportExcel = async () => {
    try {
      setExportMsg('Mengunduh Excel...');
      setExportMsgType('success');
      const token = localStorage.getItem('token');
      let url = `${BASE_URL}/export/excel`;
      if (startDate && endDate) url += `?startDate=${startDate}&endDate=${endDate}`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const err = await response.json();
        setExportMsg('Gagal: ' + (err.error || 'Unknown error'));
        setExportMsgType('error');
        return;
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `laporan${startDate ? `-${startDate}-sd-${endDate}` : '-semua'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
      setExportMsg('Excel berhasil diunduh!');
      setExportMsgType('success');
    } catch (err) {
      setExportMsg('Gagal export Excel: ' + err.message);
      setExportMsgType('error');
    }
  };

  const handleExportPDF = async () => {
    try {
      setExportMsg('Mengunduh PDF...');
      setExportMsgType('success');
      const token = localStorage.getItem('token');
      let url = `${BASE_URL}/export/pdf`;
      if (startDate && endDate) url += `?startDate=${startDate}&endDate=${endDate}`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const err = await response.json();
        setExportMsg('Gagal: ' + (err.error || 'Unknown error'));
        setExportMsgType('error');
        return;
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `laporan${startDate ? `-${startDate}-sd-${endDate}` : '-semua'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
      setExportMsg('PDF berhasil diunduh!');
      setExportMsgType('success');
    } catch (err) {
      setExportMsg('Gagal export PDF: ' + err.message);
      setExportMsgType('error');
    }
  };

  // -------- STYLES --------

  const inputStyle = {
    width: '100%', padding: '10px 14px',
    border: '1px solid #e2e8f0', borderRadius: 8,
    fontSize: '0.95em', outline: 'none',
    boxSizing: 'border-box',
  };

  const numberInputStyle = {
    width: 72, padding: '8px 10px',
    border: '1px solid #e2e8f0', borderRadius: 6,
    fontSize: '0.9em', outline: 'none',
    textAlign: 'center',
  };

  const scheduleRows = [
    { label: 'Jam Masuk',   hKey: 'jam_masuk_h',  mKey: 'jam_masuk_m'  },
    { label: 'Batas Telat', hKey: 'jam_telat_h',  mKey: 'jam_telat_m'  },
    { label: 'Jam Pulang',  hKey: 'jam_pulang_h', mKey: 'jam_pulang_m' },
  ];

  // -------- RENDER --------

  return (
    <div>
      <div className="page-header">
        <h2>Pengaturan</h2>
        <p>Kelola password, jadwal, dan export data</p>
      </div>

      <div className="settings-grid" style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 24,
      }}>

        {/* ---- GANTI PASSWORD ---- */}
        <div className="card">
          <div className="card-header"><h3>Ganti Password</h3></div>
          <div className="card-body">
            <form onSubmit={handlePasswordChange}>
              <div className="form-group">
                <label>Password Lama</label>
                <input
                  type="password" value={currentPw}
                  onChange={e => setCurrentPw(e.target.value)}
                  placeholder="Password saat ini"
                  style={inputStyle}
                />
              </div>
              <div className="form-group">
                <label>Password Baru</label>
                <input
                  type="password" value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  style={inputStyle}
                />
              </div>
              <div className="form-group">
                <label>Konfirmasi Password Baru</label>
                <input
                  type="password" value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  placeholder="Ulangi password baru"
                  style={inputStyle}
                />
              </div>
              <button type="submit" className="btn-primary">
                Simpan Password
              </button>
            </form>
            {pwMsg && (
              <div className={`alert alert-${pwType === 'success' ? 'success' : 'error'}`}
                style={{ marginTop: 12 }}>
                {pwMsg}
              </div>
            )}
          </div>
        </div>

        {/* ---- JADWAL HARI INI ---- */}
        <div className="card">
          <div className="card-header">
            <h3>Edit Jam Masuk Hari Ini</h3>
          </div>
          <div className="card-body">
            <form onSubmit={handleScheduleSave}>
              {scheduleRows.map(({ label, hKey, mKey }) => (
                <div className="form-group" key={hKey}>
                  <label>{label}</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="number" min="0" max="23"
                      value={schedule[hKey]}
                      onChange={e => setSchedule({ ...schedule, [hKey]: Number(e.target.value) })}
                      style={numberInputStyle}
                    />
                    <span style={{ color: '#718096', fontWeight: 700, fontSize: '1.1em' }}>:</span>
                    <input
                      type="number" min="0" max="59"
                      value={schedule[mKey]}
                      onChange={e => setSchedule({ ...schedule, [mKey]: Number(e.target.value) })}
                      style={numberInputStyle}
                    />
                    <span style={{
                      color: '#a0aec0', fontSize: '0.85em',
                      background: '#f8fafc', padding: '4px 10px',
                      borderRadius: 6, border: '1px solid #e2e8f0',
                      fontFamily: 'monospace',
                    }}>
                      {String(schedule[hKey]).padStart(2, '0')}:{String(schedule[mKey]).padStart(2, '0')} WIB
                    </span>
                  </div>
                </div>
              ))}

              <button type="submit" className="btn-primary">
                Simpan Jadwal Hari Ini
              </button>

              {schedMsg && (
                <div className={`alert alert-${schedType === 'success' ? 'success' : 'error'}`}
                  style={{ marginTop: 12 }}>
                  {schedMsg}
                </div>
              )}
            </form>

            <div style={{
              marginTop: 16, padding: '10px 12px',
              background: '#f8fafc', borderRadius: 8,
              border: '1px solid #e2e8f0', fontSize: '0.82em', color: '#718096'
            }}>
              Jadwal ini hanya berlaku untuk hari ini. ESP32 akan otomatis mengambil jadwal terbaru setiap 1 menit.
            </div>
          </div>
        </div>

        {/* ---- EXPORT LAPORAN ---- */}
        <div className="card">
          <div className="card-header"><h3>Export Laporan</h3></div>
          <div className="card-body">
            <div className="form-group">
              <label>Dari Tanggal</label>
              <input
                type="date" value={startDate}
                onChange={e => setStartDate(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div className="form-group">
              <label>Sampai Tanggal</label>
              <input
                type="date" value={endDate}
                onChange={e => setEndDate(e.target.value)}
                style={inputStyle}
              />
            </div>

            <p style={{ fontSize: '0.82em', color: '#a0aec0', marginBottom: 16 }}>
              Kosongkan tanggal untuk export semua data
            </p>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleExportExcel} className="btn-primary" style={{ flex: 1 }}>
                ⬇️ Excel (.xlsx)
              </button>
              <button onClick={handleExportPDF} style={{
                flex: 1, padding: '11px',
                background: '#dc2626', color: 'white',
                border: 'none', borderRadius: 8,
                fontSize: '0.95em', fontWeight: 600,
                cursor: 'pointer',
              }}>
                📄 PDF
              </button>
            </div>

            {exportMsg && (
              <div className={`alert alert-${exportMsgType === 'success' ? 'success' : 'error'}`}
                style={{ marginTop: 12 }}>
                {exportMsg}
              </div>
            )}
          </div>
        </div>

        {/* ---- INFO ---- */}
        <div className="card">
          <div className="card-header"><h3>Info Sistem</h3></div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              <div style={{
                padding: '12px 14px', background: '#f0fdf4',
                borderRadius: 8, border: '1px solid #bbf7d0'
              }}>
                <div style={{ fontWeight: 600, fontSize: '0.88em', color: '#065f46', marginBottom: 4 }}>
                  Backend
                </div>
                <div style={{ fontSize: '0.82em', color: '#047857', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  uprak-it-production.up.railway.app
                </div>
              </div>

              <div style={{
                padding: '12px 14px', background: '#eff6ff',
                borderRadius: 8, border: '1px solid #bfdbfe'
              }}>
                <div style={{ fontWeight: 600, fontSize: '0.88em', color: '#1e40af', marginBottom: 4 }}>
                  Database
                </div>
                <div style={{ fontSize: '0.82em', color: '#1d4ed8' }}>
                  Neon PostgreSQL (cloud)
                </div>
              </div>

              <div style={{
                padding: '12px 14px', background: '#fefce8',
                borderRadius: 8, border: '1px solid #fde68a'
              }}>
                <div style={{ fontWeight: 600, fontSize: '0.88em', color: '#92400e', marginBottom: 4 }}>
                  WA Notifikasi
                </div>
                <div style={{ fontSize: '0.82em', color: '#b45309' }}>
                  Fonnte API — auto kirim saat scan
                </div>
              </div>

              <div style={{
                padding: '12px 14px', background: '#fdf4ff',
                borderRadius: 8, border: '1px solid #e9d5ff'
              }}>
                <div style={{ fontWeight: 600, fontSize: '0.88em', color: '#6b21a8', marginBottom: 4 }}>
                  Hardware
                </div>
                <div style={{ fontSize: '0.82em', color: '#7e22ce' }}>
                  ESP32 + RFID RC522 + DHT22 + OLED
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Settings;