import React, { useState, useEffect } from 'react';
import api from '../api/axiosConfig';

const getTodayStr = () => {
  const now = new Date();
  const d = now.getDate().toString().padStart(2, '0');
  const m = (now.getMonth() + 1).toString().padStart(2, '0');
  const y = now.getFullYear();
  return `${d}/${m}/${y}`;
};

const getTodayTime = () => {
  const now = new Date();
  const hh = now.getHours().toString().padStart(2, '0');
  const mm = now.getMinutes().toString().padStart(2, '0');
  const ss = now.getSeconds().toString().padStart(2, '0');
  return `${hh}.${mm}.${ss}`;
};

const statusOptions = [
  { value: 'tepat_waktu', label: 'Tepat Waktu', cls: 'badge-green' },
  { value: 'telat',       label: 'Telat',        cls: 'badge-yellow' },
  { value: 'pulang',      label: 'Pulang',        cls: 'badge-blue' },
];

const statusBadge = (status) => {
  const map = {
    tepat_waktu: { cls: 'badge-green',  label: 'Tepat Waktu' },
    telat:       { cls: 'badge-yellow', label: 'Telat' },
    pulang:      { cls: 'badge-blue',   label: 'Pulang' },
    manual:      { cls: 'badge-gray',   label: 'Manual' },
  };
  const s = map[status] || { cls: 'badge-gray', label: status };
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
};

const ManualAttendance = () => {
  const [students,        setStudents]        = useState([]);
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [searchName,      setSearchName]      = useState('');
  const [searchClass,     setSearchClass]     = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [attStatus,       setAttStatus]       = useState('tepat_waktu');
  const [attDate,         setAttDate]         = useState(getTodayStr());
  const [attTime,         setAttTime]         = useState(getTodayTime());
  const [note,            setNote]            = useState('');
  const [message,         setMessage]         = useState('');
  const [msgType,         setMsgType]         = useState('');
  const [loading,         setLoading]         = useState(false);
  const [editId,          setEditId]          = useState(null);
  const [editStatus,      setEditStatus]      = useState('');
  const [editTime,        setEditTime]        = useState('');
  const [editNote,        setEditNote]        = useState('');

  const fetchAll = async () => {
    const [s, a] = await Promise.all([
      api.get('/students'),
      api.get('/attendance'),
    ]);
    setStudents(s.data);

    // Filter pakai kolom date bukan scanned_at
    const todayStr = getTodayStr();
    const today = a.data.filter(r => r.date === todayStr);
    setTodayAttendance(today);
  };

  useEffect(() => { fetchAll(); }, []);

  const kelasList = [...new Set(students.map(s => s.class))].sort();

  const filteredStudents = students.filter(s => {
    const matchName  = !searchName  || s.name.toLowerCase().includes(searchName.toLowerCase());
    const matchClass = !searchClass || s.class === searchClass;
    return matchName && matchClass;
  });

  const getStudentStatus = (uid) => {
    return todayAttendance.find(a => a.uid === uid) || null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStudent) {
      setMessage('Pilih siswa dulu'); setMsgType('error'); return;
    }
    setLoading(true);
    try {
      await api.post('/attendance/manual', {
        student_id:        selectedStudent.id,
        attendance_status: attStatus,
        date:              attDate,
        time:              attTime,
        note,
      });
      setMessage(`Absensi ${selectedStudent.name} berhasil diinput!`);
      setMsgType('success');
      setSelectedStudent(null);
      setNote('');
      setAttTime(getTodayTime());
      fetchAll();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Gagal input absensi');
      setMsgType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (record) => {
    setEditId(record.id);
    setEditStatus(record.attendance_status);
    setEditTime(record.time || '');
    setEditNote(record.note || '');
  };

  const handleEditSave = async (id) => {
    try {
      await api.put(`/attendance/${id}`, {
        attendance_status: editStatus,
        time:              editTime,
        note:              editNote,
      });
      setMessage('Data absensi berhasil diupdate!');
      setMsgType('success');
      setEditId(null);
      fetchAll();
    } catch (err) {
      setMessage('Gagal update absensi');
      setMsgType('error');
    }
  };

  const inputStyle = {
    width: '100%', padding: '9px 12px',
    border: '1px solid #e2e8f0', borderRadius: 8,
    fontSize: '0.9em', outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div>
      <div className="page-header">
        <h2>Absensi Manual</h2>
        <p>Input absensi manual untuk siswa yang bermasalah dengan kartu</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20 }}>

        {/* Form input manual */}
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header"><h3>Input Absensi</h3></div>
            <div className="card-body">
              <form onSubmit={handleSubmit}>

                {/* Cari siswa */}
                <div className="form-group">
                  <label>Cari Siswa</label>
                  <input type="text" placeholder="Ketik nama siswa..."
                    value={searchName}
                    onChange={e => { setSearchName(e.target.value); setSelectedStudent(null); }}
                    style={inputStyle}
                  />
                </div>

                <div className="form-group">
                  <label>Filter Kelas</label>
                  <select value={searchClass} onChange={e => setSearchClass(e.target.value)}
                    style={inputStyle}>
                    <option value="">Semua Kelas</option>
                    {kelasList.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>

                {/* List siswa hasil filter */}
                {(searchName || searchClass) && (
                  <div style={{
                    border: '1px solid #e2e8f0', borderRadius: 8,
                    maxHeight: 180, overflowY: 'auto', marginBottom: 14
                  }}>
                    {filteredStudents.length === 0 ? (
                      <div style={{ padding: 12, color: '#a0aec0', fontSize: '0.88em', textAlign: 'center' }}>
                        Tidak ditemukan
                      </div>
                    ) : filteredStudents.map(s => {
                      const existing   = getStudentStatus(s.uid);
                      const isSelected = selectedStudent?.id === s.id;
                      return (
                        <div key={s.id}
                          onClick={() => setSelectedStudent(s)}
                          style={{
                            padding: '10px 12px', cursor: 'pointer',
                            background: isSelected ? '#eff6ff' : 'inherit',
                            borderBottom: '1px solid #f1f5f9',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.9em' }}>{s.name}</div>
                            <div style={{ fontSize: '0.78em', color: '#718096' }}>{s.class}</div>
                          </div>
                          {existing
                            ? <span className="badge badge-green" style={{ fontSize: '0.72em' }}>Sudah absen</span>
                            : <span className="badge badge-red"   style={{ fontSize: '0.72em' }}>Belum</span>
                          }
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Siswa terpilih */}
                {selectedStudent && (
                  <div style={{
                    padding: '10px 12px', background: '#eff6ff',
                    borderRadius: 8, marginBottom: 14,
                    border: '1px solid #bfdbfe',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9em', color: '#1e40af' }}>
                        {selectedStudent.name}
                      </div>
                      <div style={{ fontSize: '0.78em', color: '#3b82f6' }}>
                        {selectedStudent.class} · {selectedStudent.uid}
                      </div>
                    </div>
                    <button type="button"
                      onClick={() => setSelectedStudent(null)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#93c5fd', fontSize: 18 }}>
                      ×
                    </button>
                  </div>
                )}

                {/* Status */}
                <div className="form-group">
                  <label>Status Kehadiran</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {statusOptions.map(opt => (
                      <button key={opt.value} type="button"
                        onClick={() => setAttStatus(opt.value)}
                        style={{
                          flex: 1, padding: '8px 4px',
                          border: `2px solid ${attStatus === opt.value ? '#1a56db' : '#e2e8f0'}`,
                          borderRadius: 8, cursor: 'pointer', fontSize: '0.82em',
                          fontWeight: attStatus === opt.value ? 600 : 400,
                          background: attStatus === opt.value ? '#eff6ff' : 'white',
                          color: attStatus === opt.value ? '#1e40af' : '#718096',
                          transition: 'all 0.15s',
                        }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tanggal */}
                <div className="form-group">
                  <label>Tanggal</label>
                  <input type="text" value={attDate}
                    onChange={e => setAttDate(e.target.value)}
                    placeholder="DD/MM/YYYY"
                    style={inputStyle}
                  />
                </div>

                {/* Jam */}
                <div className="form-group">
                  <label>Jam</label>
                  <input type="text" value={attTime}
                    onChange={e => setAttTime(e.target.value)}
                    placeholder="HH.MM.SS"
                    style={inputStyle}
                  />
                </div>

                {/* Catatan */}
                <div className="form-group">
                  <label>Catatan (opsional)</label>
                  <textarea value={note} onChange={e => setNote(e.target.value)}
                    placeholder="Alasan input manual..."
                    rows={2}
                    style={{ ...inputStyle, resize: 'vertical' }}
                  />
                </div>

                <button type="submit" className="btn-primary"
                  disabled={loading || !selectedStudent}>
                  {loading ? 'Menyimpan...' : '+ Input Absensi Manual'}
                </button>

              </form>

              {message && (
                <div className={`alert alert-${msgType === 'success' ? 'success' : 'error'}`}
                  style={{ marginTop: 12 }}>
                  {message}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabel absensi hari ini */}
        <div className="card">
          <div className="card-header">
            <h3>Absensi Hari Ini</h3>
            <span style={{ fontSize: '0.85em', color: '#718096' }}>
              {todayAttendance.length} record
            </span>
          </div>

          {todayAttendance.length === 0 ? (
            <div className="empty-state">
              <div style={{ fontSize: '2em' }}>📋</div>
              <p>Belum ada absensi hari ini</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Kelas</th>
                    <th>Jam</th>
                    <th>Status</th>
                    <th>Catatan</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {todayAttendance.map(r => (
                    <tr key={r.id} style={{
                      background: r.weather === 'manual' ? '#fefce8' : 'inherit'
                    }}>
                      <td style={{ fontWeight: 600 }}>{r.name}</td>
                      <td>{r.class}</td>
                      <td>
                        {editId === r.id ? (
                          <input type="text" value={editTime}
                            onChange={e => setEditTime(e.target.value)}
                            style={{ width: 80, padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: '0.85em' }}
                          />
                        ) : (
                          <span style={{ fontFamily: 'monospace' }}>{r.time || '--:--'}</span>
                        )}
                      </td>
                      <td>
                        {editId === r.id ? (
                          <select value={editStatus} onChange={e => setEditStatus(e.target.value)}
                            style={{ padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: '0.85em' }}>
                            {statusOptions.map(o => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        ) : (
                          <div>
                            {statusBadge(r.attendance_status)}
                            {r.weather === 'manual' && (
                              <span style={{
                                marginLeft: 4, fontSize: '0.7em', color: '#92400e',
                                background: '#fef3c7', padding: '1px 5px', borderRadius: 4
                              }}>manual</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: '0.82em', color: '#718096', maxWidth: 140 }}>
                        {editId === r.id ? (
                          <input type="text" value={editNote}
                            onChange={e => setEditNote(e.target.value)}
                            style={{ width: '100%', padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: '0.85em' }}
                          />
                        ) : (
                          <span title={r.note}>
                            {r.note ? r.note.slice(0, 30) + (r.note.length > 30 ? '...' : '') : '-'}
                          </span>
                        )}
                      </td>
                      <td>
                        {editId === r.id ? (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => handleEditSave(r.id)} style={{
                              background: '#ecfdf5', color: '#065f46',
                              border: '1px solid #bbf7d0', padding: '4px 8px',
                              borderRadius: 5, fontSize: '0.78em', fontWeight: 600, cursor: 'pointer'
                            }}>Simpan</button>
                            <button onClick={() => setEditId(null)} style={{
                              background: '#f1f5f9', color: '#718096',
                              border: '1px solid #e2e8f0', padding: '4px 8px',
                              borderRadius: 5, fontSize: '0.78em', cursor: 'pointer'
                            }}>Batal</button>
                          </div>
                        ) : (
                          <button onClick={() => handleEdit(r)} style={{
                            background: '#eff6ff', color: '#1e40af',
                            border: '1px solid #bfdbfe', padding: '4px 8px',
                            borderRadius: 5, fontSize: '0.78em', fontWeight: 600, cursor: 'pointer'
                          }}>Edit</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManualAttendance;