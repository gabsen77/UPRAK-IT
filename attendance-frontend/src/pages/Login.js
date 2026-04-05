import React, { useState } from 'react';
import axios from 'axios';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Username dan password harus diisi');
      return;
    }
    setLoading(true);
    setError('');
    try {
        const res = await axios.post('https://uprak-it-production.up.railway.app/api/auth/login', {
        username, password
      });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user',  JSON.stringify(res.data.user));
      onLogin(res.data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Login gagal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1e3a8a, #1a56db)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '40px',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img 
            src="/logo.png" 
            alt="Logo Sekolah" 
            style={{
              width: '80px', 
              height: '80px', 
              objectFit: 'contain',
              marginBottom: '12px'
            }} 
          />
          <h1 style={{ fontSize: '1.6em', fontWeight: '700', color: '#1e3a8a' }}>NASI</h1>
          <p style={{ color: '#718096', fontSize: '0.9em', marginTop: '4px' }}>
            Attendance System — Login
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block', fontSize: '0.85em',
              fontWeight: '600', color: '#4a5568', marginBottom: '6px'
            }}>Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Masukkan username"
              style={{
                width: '100%', padding: '11px 14px',
                border: '1px solid #e2e8f0', borderRadius: '8px',
                fontSize: '0.95em', outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block', fontSize: '0.85em',
              fontWeight: '600', color: '#4a5568', marginBottom: '6px'
            }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Masukkan password"
              style={{
                width: '100%', padding: '11px 14px',
                border: '1px solid #e2e8f0', borderRadius: '8px',
                fontSize: '0.95em', outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {error && (
            <div style={{
              background: '#fef2f2', color: '#991b1b',
              padding: '10px 14px', borderRadius: '8px',
              fontSize: '0.88em', marginBottom: '16px',
            }}>{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '12px',
              background: loading ? '#93c5fd' : '#1a56db',
              color: 'white', border: 'none',
              borderRadius: '8px', fontSize: '1em',
              fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Loading...' : 'Login'}
          </button>
        </form>

      </div>
    </div>
  );
};

export default Login;