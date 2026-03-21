import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import Dashboard      from './pages/Dashboard';
import Students       from './pages/Students';
import Analytics      from './pages/Analytics';
import Login          from './pages/Login';
import UserManagement from './pages/UserManagement';
import Settings from './pages/Settings';
import Rekap from './pages/Rekap';
import './App.css';

function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  const handleLogin  = (userData) => setUser(userData);
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (!user) return <Login onLogin={handleLogin} />;

  const isAdmin = user.role === 'admin';

  return (
    <Router>
      <div className="App">
        <nav className="navbar">
          <div className="navbar-brand">
            <div className="logo">N</div>
            <div>
              <h1>NASI</h1>
              <span>Attendance System</span>
            </div>
          </div>
          <div className="nav-links">
            <NavLink to="/">Dashboard</NavLink>
            <NavLink to="/analytics">Analytics</NavLink>
            <NavLink to="/rekap">Rekap</NavLink>
            {/* Hanya admin yang bisa lihat menu ini */}
            {isAdmin && <NavLink to="/students">Students</NavLink>}
            {isAdmin && <NavLink to="/users">Users</NavLink>}
            {isAdmin && <NavLink to="/settings">Settings</NavLink>}

          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.85em', opacity: 0.8 }}>
              👤 {user.username}
              <span style={{
                marginLeft: '6px',
                background: isAdmin ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
                padding: '2px 8px',
                borderRadius: '10px',
                fontSize: '0.8em',
              }}>{user.role}</span>
            </span>
            <button
              onClick={handleLogout}
              style={{
                background: 'rgba(255,255,255,0.15)',
                color: 'white', border: 'none',
                padding: '7px 14px', borderRadius: '6px',
                fontSize: '0.85em', cursor: 'pointer',
              }}
            >Logout</button>
          </div>
        </nav>

        <div className="content">
          <Routes>
            {/* Semua role bisa akses */}
            <Route path="/"          element={<Dashboard />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/rekap" element={<Rekap />} />

            {/* Hanya admin */}
            <Route path="/students"
              element={isAdmin ? <Students /> : <Navigate to="/" />}
            />
            <Route path="/users"
              element={isAdmin ? <UserManagement /> : <Navigate to="/" />}
            />
            <Route path="/settings" element={isAdmin ? <Settings /> : <Navigate to="/" />} 
            />

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;