import React, { useState, useEffect } from 'react';
import api from '../api/axiosConfig';

const UserManagement = () => {
  const [users,    setUsers]    = useState([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role,     setRole]     = useState('admin');
  const [message,  setMessage]  = useState('');
  const [msgType,  setMsgType]  = useState('');

  const fetchUsers = async () => {
    const res = await api.get('/auth/users');
    setUsers(res.data);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setMessage('Username dan password harus diisi');
      setMsgType('error');
      return;
    }
    try {
      await api.post('/auth/register', { username, password, role });
      setMessage(`User ${username} berhasil ditambahkan!`);
      setMsgType('success');
      setUsername(''); setPassword(''); setRole('admin');
      fetchUsers();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Gagal menambahkan user');
      setMsgType('error');
    }
  };

  const handleDelete = async (id, name) => {
    const currentUser = JSON.parse(localStorage.getItem('user'));
    if (currentUser.id === id) {
      alert('Tidak bisa hapus akun sendiri!');
      return;
    }
    if (!window.confirm(`Yakin hapus user ${name}?`)) return;
    try {
      await api.delete(`/auth/users/${id}`);
      setMessage(`User ${name} berhasil dihapus`);
      setMsgType('success');
      fetchUsers();
    } catch (err) {
      setMessage('Gagal menghapus user');
      setMsgType('error');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Manajemen User</h2>
        <p>Kelola akun yang bisa akses dashboard</p>
      </div>

      <div className="students-layout">
        {/* Form */}
        <div className="card">
          <div className="card-header"><h3>Tambah User Baru</h3></div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Username</label>
                <input type="text" value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Username" />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input type="password" value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Password" />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select value={role} onChange={e => setRole(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 14px',
                    border: '1px solid #e2e8f0', borderRadius: '8px',
                    fontSize: '0.95em', outline: 'none',
                  }}>
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <button type="submit" className="btn-primary">
                + Tambah User
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
            <h3>Daftar User</h3>
            <span style={{fontSize:'0.85em', color:'#718096'}}>{users.length} user</span>
          </div>
          <div className="card-body" style={{padding: 0}}>
            <table>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Dibuat</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td style={{fontWeight: 600}}>{u.username}</td>
                    <td>
                      <span className={`badge ${u.role === 'admin' ? 'badge-blue' : 'badge-gray'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{fontSize:'0.85em', color:'#718096'}}>
                      {new Date(u.created_at).toLocaleDateString('id-ID')}
                    </td>
                    <td>
                      <button
                        onClick={() => handleDelete(u.id, u.username)}
                        style={{
                          background: '#fef2f2', color: '#dc2626',
                          border: '1px solid #fecaca', padding: '5px 12px',
                          borderRadius: '6px', fontSize: '0.82em',
                          fontWeight: 600, cursor: 'pointer',
                        }}
                      >Hapus</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;