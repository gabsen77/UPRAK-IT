import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Analytics from './pages/Analytics';
import './App.css';

function App() {
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
            <NavLink to="/students">Students</NavLink>
            <NavLink to="/analytics">Analytics</NavLink>
          </div>
        </nav>
        <div className="content">
          <Routes>
            <Route path="/"          element={<Dashboard />} />
            <Route path="/students"  element={<Students />} />
            <Route path="/analytics" element={<Analytics />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;