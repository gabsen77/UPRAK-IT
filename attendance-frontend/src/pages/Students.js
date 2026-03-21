import React, { useState, useEffect } from 'react';
import api from '../api/axiosConfig';

const Students = () => {
  const [students,     setStudents]     = useState([]);
  const [todayStatus,  setTodayStatus]  = useState([]);
  const [uid,          setUid]          = useState('');
  const [name,         setName]         = useState('');
  const [studentClass, setStudentClass] = useState('');
  const [phone,        setPhone]        = useState('');
  const [message,      setMessage]      = useState('');
  const [msgType,      setMsgType]      = useState('');
  const [editId,       setEditId]       = useState(null);
  const [searchName,   setSearchName]   = useState('');
  const [searchClass,  setSearchClass]  = useState('');

const fetchAll = async () => {
  const [s, t] = await Promise.all([
    api.get('/students'),
    api.get('/students/today'),
  ]);
  setStudents(s.data);
  setTodayStatus(t.data);
};

  useEffect(() => { fetchAll(); }, []);

  const getStatus = (studentUid) => {
    return todayStatus.find(t => t.uid === studentUid) || null;
  };

  const kelasList = [...new Set(todayStatus.map(s => s.class))].sort();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!uid || !name || !studentClass) {
      setMessage('UID, nama, dan kelas harus diisi');
      setMsgType('error');
      return;
    }
    try {
      if (editId) {
        await api.put(`/students/${editId}`, { uid, name, class: studentClass, phone });
        setMessage(`Data ${name} berhasil diupdate!`);
      } else {
        await api.post('/students', { uid, name, class: studentClass, phone });
        setMessage(`Siswa ${name} berhasil ditambahkan!`);
      }
      setMsgType('success');
      setUid(''); setName(''); setStudentClass(''); setPhone(''); setEditId(null);
      fetchAll();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Gagal menyimpan data');
      setMsgType('error');
    }
  };

  const handleEdit = (s) => {
    setEditId(s.id);
    setUid(s.uid);
    setName(s.name);
    setStudentClass(s.class);
    setPhone(s.phone || '');
    setMessage('');
    window.scrollTo(0, 0);
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setUid(''); setName(''); setStudentClass(''); setPhone('');
    setMessage('');
  };

  const handleDelete = async (id, studentName) => {
    if (!window.confirm(`Yakin hapus ${studentName}?`)) return;
    try {
      await api.delete(`/students/${id}`);
      setMessage(`${studentName} berhasil dihapus.`);
      setMsgType('success');
      fetchAll();
    } catch (err) {
      setMessage('Gagal menghapus siswa.');
      setMsgType('error');
    }
  };

  const sendWAManual = async (s) => {
    if (!s.phone) { alert('Nomor WA tidak ada!'); return; }
    const status = getStatus(s.uid);
    const msg = status
      ? `Halo ${s.name}, absensi kamu sudah tercatat pada ${status.scan_time} dengan status ${status.attendance_status === 'tepat_waktu' ? 'Tepat Waktu' : 'Telat'}.`
      : `Halo ${s.name}, kamu BELUM absen hari ini. Segera lakukan absensi! ⚠️`;
    try {
      await api.post('/notify/whatsapp', { phone: s.phone, message: msg });
      alert(`Pesan WA berhasil dikirim ke ${s.phone}`);
    } catch (err) {
      alert('Gagal kirim WA: ' + (err.response?.data?.error || err.message));
    }
  };

  // Filter dengan nama DAN kelas terpisah
  const filtered = todayStatus.filter(s => {
    const matchName  = !searchName  || s.name.toLowerCase().includes(searchName.toLowerCase());
    const matchClass = !searchClass || s.class === searchClass;
    return matchName && matchClass;
  });

  const sudahHadir = todayStatus.filter(s => s.hadir || s.sudah_pulang).length;
  const belumHadir = todayStatus.filter(s => !s.hadir && !s.sudah_pulang).length;

  return (
    <div>
      <div className="page-header">
        <h2>Manajemen Siswa</h2>
        <p>Kelola data siswa dan pantau kehadiran hari ini</p>
      </div>

      {/* Stat cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 20 }}>
        <div className="stat-card blue">
          <div className="stat-icon">👥</div>
          <div className="stat-info"><h3>{students.length}</h3><p>Total Siswa</p></div>
        </div>
        <div className="stat-card green">
          <div className="stat-icon">✅</div>
          <div className="stat-info"><h3>{sudahHadir}</h3><p>Sudah Absen</p></div>
        </div>
        <div className="stat-card red">
          <div className="stat-icon">⚠️</div>
          <div className="stat-info"><h3>{belumHadir}</h3><p>Belum Absen</p></div>
        </div>
      </div>

      <div className="students-layout">
        {/* Form tambah/edit */}
        <div className="card">
          <div className="card-header">
            <h3>{editId ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}</h3>
            {editId && (
              <button onClick={handleCancelEdit} style={{
                background: '#f1f5f9', border: 'none', padding: '5px 12px',
                borderRadius: '6px', cursor: 'pointer', fontSize: '0.85em'
              }}>Batal</button>
            )}
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>UID Kartu RFID</label>
                <input type="text" value={uid}
                  onChange={e => setUid(e.target.value)}
                  placeholder="Contoh: D5 32 86 46"/>
              </div>
              <div className="form-group">
                <label>Nama Lengkap</label>
                <input type="text" value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Nama siswa"/>
              </div>
              <div className="form-group">
                <label>Kelas</label>
                <input type="text" value={studentClass}
                  onChange={e => setStudentClass(e.target.value)}
                  placeholder="Contoh: XII6-03"/>
              </div>
              <div className="form-group">
                <label>Nomor WhatsApp</label>
                <input type="text" value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="Contoh: 628123456789"/>
              </div>
              <button type="submit" className="btn-primary">
                {editId ? '💾 Simpan Perubahan' : '+ Tambah Siswa'}
              </button>
            </form>
            {message && (
              <div className={`alert alert-${msgType === 'success' ? 'success' : 'error'}`}>
                {message}
              </div>
            )}
          </div>
        </div>

        {/* Tabel siswa */}
        <div className="card">
          <div className="card-header">
            <h3>Daftar Siswa</h3>
            <span style={{ fontSize: '0.85em', color: '#718096' }}>
              {filtered.length} / {todayStatus.length} siswa
            </span>
          </div>

          {/* Filter terpisah */}
          <div style={{
            padding: '12px 16px',
            display: 'flex',
            gap: 10,
            borderBottom: '1px solid #f1f5f9'
          }}>
            {/* Filter nama */}
            <input
              type="text"
              placeholder="🔍 Cari nama..."
              value={searchName}
              onChange={e => setSearchName(e.target.value)}
              style={{
                flex: 1, padding: '8px 12px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px', fontSize: '0.88em',
                outline: 'none',
              }}
            />

            {/* Filter kelas dropdown */}
            <select
              value={searchClass}
              onChange={e => setSearchClass(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px', fontSize: '0.88em',
                outline: 'none', minWidth: 130,
              }}
            >
              <option value="">Semua Kelas</option>
              {kelasList.map(k => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>

            {/* Reset filter */}
            {(searchName || searchClass) && (
              <button
                onClick={() => { setSearchName(''); setSearchClass(''); }}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px', fontSize: '0.88em',
                  cursor: 'pointer', background: '#f8fafc',
                  color: '#718096',
                }}
              >✕</button>
            )}
          </div>

          <div style={{ padding: 0 }}>
            {filtered.length === 0 ? (
              <div className="empty-state">
                <div style={{ fontSize: '2em' }}>👤</div>
                <p>Tidak ada siswa yang cocok</p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Status Hari Ini</th>
                    <th>Nama</th>
                    <th>Kelas</th>
                    <th>UID</th>
                    <th>WA</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => {
                    return (
                      <tr key={s.id} style={{
                        background: !s.hadir && !s.sudah_pulang ? '#fff9f0' : 'inherit'
                      }}>
                <td>
                  {s.sudah_pulang ? (
                    <div>
                      <span className="badge badge-blue">Pulang</span>
                      <div style={{ fontSize: '0.75em', color: '#a0aec0', marginTop: 2 }}>
                        {s.pulang_time}
                      </div>
                    </div>
                  ) : s.hadir ? (
                    <div>
                      <span className={`badge ${
                        s.attendance_status === 'tepat_waktu' ? 'badge-green' : 'badge-yellow'
                      }`}>
                        {s.attendance_status === 'tepat_waktu' ? 'Tepat Waktu' : 'Telat'}
                      </span>
                      <div style={{ fontSize: '0.75em', color: '#a0aec0', marginTop: 2 }}>
                        {s.scan_time}
                      </div>
                    </div>
                  ) : (
                    <span className="badge badge-red">Belum Absen</span>
                  )}
                </td>
                        <td style={{ fontWeight: 600 }}>{s.name}</td>
                        <td>{s.class}</td>
                        <td><span className="uid-tag">{s.uid}</span></td>
                        <td style={{ fontSize: '0.82em', color: '#718096' }}>
                          {s.phone || <span style={{ color: '#e2e8f0' }}>-</span>}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => handleEdit(s)} style={{
                              background: '#eff6ff', color: '#1e40af',
                              border: '1px solid #bfdbfe', padding: '4px 8px',
                              borderRadius: '5px', fontSize: '0.78em',
                              fontWeight: 600, cursor: 'pointer',
                            }}>Edit</button>
                            <button onClick={() => sendWAManual(s)} style={{
                              background: s.phone ? '#f0fdf4' : '#f8fafc',
                              color: s.phone ? '#166534' : '#a0aec0',
                              border: `1px solid ${s.phone ? '#bbf7d0' : '#e2e8f0'}`,
                              padding: '4px 8px', borderRadius: '5px',
                              fontSize: '0.78em', fontWeight: 600,
                              cursor: s.phone ? 'pointer' : 'not-allowed',
                            }}>WA</button>
                            <button onClick={() => handleDelete(s.id, s.name)} style={{
                              background: '#fef2f2', color: '#dc2626',
                              border: '1px solid #fecaca', padding: '4px 8px',
                              borderRadius: '5px', fontSize: '0.78em',
                              fontWeight: 600, cursor: 'pointer',
                            }}>Hapus</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Students;