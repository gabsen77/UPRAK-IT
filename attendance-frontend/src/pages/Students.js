import React, { useState, useEffect } from 'react';
import api from '../api/axiosConfig';

const Students = () => {
  const [students,      setStudents]      = useState([]);
  const [uid,           setUid]           = useState('');
  const [name,          setName]          = useState('');
  const [studentClass,  setStudentClass]  = useState('');
  const [message,       setMessage]       = useState('');
  const [msgType,       setMsgType]       = useState('');

  const fetchStudents = async () => {
    const res = await api.get('/students');
    setStudents(res.data);
  };

  useEffect(() => { fetchStudents(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!uid || !name || !studentClass) {
      setMessage('Semua field harus diisi.');
      setMsgType('error');
      return;
    }
    try {
      await api.post('/students', { uid, name, class: studentClass });
      setMessage(`Siswa ${name} berhasil ditambahkan!`);
      setMsgType('success');
      setUid(''); setName(''); setStudentClass('');
      fetchStudents();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Gagal menambahkan siswa.');
      setMsgType('error');
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Yakin mau hapus ${name}?`)) return;
    try {
      await api.delete(`/students/${id}`);
      setMessage(`${name} berhasil dihapus.`);
      setMsgType('success');
      fetchStudents();
    } catch (err) {
      setMessage('Gagal menghapus siswa.');
      setMsgType('error');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Manajemen Siswa</h2>
        <p>Daftar dan kelola siswa yang terdaftar</p>
      </div>

      <div className="students-layout">

        {/* Form */}
        <div className="card">
          <div className="card-header">
            <h3>Tambah Siswa Baru</h3>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>UID Kartu RFID</label>
                <input
                  type="text"
                  value={uid}
                  onChange={e => setUid(e.target.value)}
                  placeholder="Contoh: D5 32 86 46"
                />
              </div>
              <div className="form-group">
                <label>Nama Lengkap</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Nama siswa"
                />
              </div>
              <div className="form-group">
                <label>Kelas</label>
                <input
                  type="text"
                  value={studentClass}
                  onChange={e => setStudentClass(e.target.value)}
                  placeholder="Contoh: XII6-03"
                />
              </div>
              <button type="submit" className="btn-primary">
                + Tambah Siswa
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
            <h3>Siswa Terdaftar</h3>
            <span style={{fontSize:'0.85em', color:'#718096'}}>{students.length} siswa</span>
          </div>
          <div className="card-body" style={{padding: 0}}>
            {students.length === 0 ? (
              <div className="empty-state">
                <div style={{fontSize:'2em'}}>👤</div>
                <p>Belum ada siswa terdaftar</p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Kelas</th>
                    <th>UID Kartu</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(s => (
                    <tr key={s.id}>
                      <td style={{fontWeight: 600}}>{s.name}</td>
                      <td>{s.class}</td>
                      <td><span className="uid-tag">{s.uid}</span></td>
                      <td>
                        <button
                          onClick={() => handleDelete(s.id, s.name)}
                          style={{
                            background: '#fef2f2',
                            color: '#dc2626',
                            border: '1px solid #fecaca',
                            padding: '5px 12px',
                            borderRadius: '6px',
                            fontSize: '0.82em',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
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