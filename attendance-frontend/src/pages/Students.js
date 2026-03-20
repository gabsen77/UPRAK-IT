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
  const [search,       setSearch]       = useState('');

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
    const s = todayStatus.find(t => t.uid === studentUid);
    return s || null;
  };

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

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Yakin hapus ${name}?`)) return;
    try {
      await api.delete(`/students/${id}`);
      setMessage(`${name} berhasil dihapus.`);
      setMsgType('success');
      fetchAll();
    } catch (err) {
      setMessage('Gagal menghapus siswa.');
      setMsgType('error');
    }
  };

  const sendWA = async (s) => {
    if (!s.phone) { alert('Nomor WA tidak ada!'); return; }
    const status = getStatus(s.uid);
    const msg = status
      ? `Halo, ${s.name} sudah absen pada ${status.scan_time} dengan status ${status.attendance_status === 'tepat_waktu' ? 'Tepat Waktu' : 'Telat'}.`
      : `Halo, ${s.name} BELUM absen hari ini. Mohon segera hadir.`;
    try {
      await api.post('/notify/whatsapp', { phone: s.phone, message: msg });
      alert(`Pesan WA berhasil dikirim ke ${s.phone}`);
    } catch (err) {
      alert('Gagal kirim WA');
    }
  };

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.class.toLowerCase().includes(search.toLowerCase())
  );

  const sudahHadir  = todayStatus.filter(s => s.hadir).length;
  const belumHadir  = students.length - sudahHadir;

  return (
    <div>
      <div className="page-header">
        <h2>Manajemen Siswa</h2>
        <p>Kelola data siswa dan pantau kehadiran hari ini</p>
      </div>

      {/* Summary hari ini */}
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
        {/* Form */}
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
                <input type="text" value={uid} onChange={e => setUid(e.target.value)} placeholder="Contoh: D5 32 86 46"/>
              </div>
              <div className="form-group">
                <label>Nama Lengkap</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Nama siswa"/>
              </div>
              <div className="form-group">
                <label>Kelas</label>
                <input type="text" value={studentClass} onChange={e => setStudentClass(e.target.value)} placeholder="Contoh: XII6-03"/>
              </div>
              <div className="form-group">
                <label>Nomor WhatsApp</label>
                <input type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Contoh: 628123456789"/>
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

        {/* List */}
        <div className="card">
          <div className="card-header">
            <h3>Daftar Siswa</h3>
            <span style={{ fontSize: '0.85em', color: '#718096' }}>{students.length} siswa</span>
          </div>
          <div className="card-body" style={{ padding: '12px 16px' }}>
            <input
              type="text"
              placeholder="🔍 Cari nama atau kelas..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px', marginBottom: 12,
                border: '1px solid #e2e8f0', borderRadius: '8px',
                fontSize: '0.9em', outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>
          <div style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Nama</th>
                  <th>Kelas</th>
                  <th>UID</th>
                  <th>WA</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const status = getStatus(s.uid);
                  return (
                    <tr key={s.id} style={{ background: !status ? '#fff9f0' : 'inherit' }}>
                      <td>
                        {status ? (
                          <span className={`badge ${status.attendance_status === 'tepat_waktu' ? 'badge-green' : 'badge-yellow'}`}>
                            {status.attendance_status === 'tepat_waktu' ? 'Tepat Waktu' : 'Telat'} {status.scan_time}
                          </span>
                        ) : (
                          <span className="badge badge-red">Belum Absen</span>
                        )}
                      </td>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td>{s.class}</td>
                      <td><span className="uid-tag">{s.uid}</span></td>
                      <td style={{ fontSize: '0.82em', color: '#718096' }}>{s.phone || '-'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => handleEdit(s)} style={{
                            background: '#eff6ff', color: '#1e40af',
                            border: '1px solid #bfdbfe', padding: '4px 8px',
                            borderRadius: '5px', fontSize: '0.78em',
                            fontWeight: 600, cursor: 'pointer',
                          }}>Edit</button>
                          <button onClick={() => sendWA(s)} style={{
                            background: '#f0fdf4', color: '#166534',
                            border: '1px solid #bbf7d0', padding: '4px 8px',
                            borderRadius: '5px', fontSize: '0.78em',
                            fontWeight: 600, cursor: 'pointer',
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default Students;