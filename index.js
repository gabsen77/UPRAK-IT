const express = require('express');
const pool    = require('./db');
const app     = express();

app.use(express.json());

// -------------------------------------------------------
// JAM MASUK & PULANG (server side)
// Sesuaikan dengan jam di ESP32
// -------------------------------------------------------
const JAM_MASUK  = { h: 6,  m: 30 };
const JAM_TELAT  = { h: 6,  m: 30 };
const JAM_PULANG = { h: 15, m: 20 };

function getAttendanceLabel(status) {
  if (status === "tepat_waktu") return "Tepat Waktu";
  if (status === "telat")       return "Telat";
  if (status === "pulang")      return "Pulang";
  if (status === "ga_masuk")    return "Tidak Masuk";
  return status;
}

app.post('/api/attendance', async (req, res) => {
  const { uid, temperature, humidity, time, date, status, weather } = req.body;
  console.log(`UID: ${uid} | Status: ${status} | Cuaca: ${weather} | Temp: ${temperature} | Hum: ${humidity}`);

  try {
    const studentResult = await pool.query(
      'SELECT * FROM students WHERE uid = $1',
      [uid]
    );

    // UID tidak dikenal
    if (studentResult.rows.length === 0) {
      await pool.query(
        `INSERT INTO attendance (uid, name, class, status, attendance_status, weather, temperature, humidity, time, date, scanned_at)
         VALUES ($1, 'Unknown', 'Unknown', 'unknown', 'unknown', $2, $3, $4, $5, $6, NOW())`,
        [uid, weather, temperature, humidity, time, date]
      );
      return res.json({ status: 'unknown' });
    }

    const student = studentResult.rows[0];

    // Cek apakah sudah absen hari ini
    const alreadyScanned = await pool.query(
      `SELECT * FROM attendance 
       WHERE uid = $1 
       AND DATE(scanned_at) = CURRENT_DATE
       AND status = 'present'`,
      [uid]
    );

    if (alreadyScanned.rows.length > 0) {
      return res.json({
        status: 'already',
        name:   student.name,
        class:  student.class
      });
    }

    // Simpan absensi dengan status kehadiran dan cuaca
    await pool.query(
      `INSERT INTO attendance (uid, name, class, status, attendance_status, weather, temperature, humidity, time, date, scanned_at)
       VALUES ($1, $2, $3, 'present', $4, $5, $6, $7, $8, $9, NOW())`,
      [uid, student.name, student.class, status, weather, temperature, humidity, time, date]
    );

    return res.json({
      status:            'found',
      name:              student.name,
      class:             student.class,
      attendance_status: status
    });

  } catch (err) {
    console.error('DB Error:', err.message);
    res.status(500).json({ status: 'error', error: err.message });
  }
});

app.get('/api/attendance', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM attendance ORDER BY scanned_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------
// DATA ANALYST ENDPOINT
// GET /api/analytics/weather
// Korelasi cuaca dengan kehadiran — berguna saat hujan
// Contoh query: apakah siswa lebih banyak telat saat hujan?
// -------------------------------------------------------
app.get('/api/analytics/weather', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
         weather,
         attendance_status,
         COUNT(*) as total,
         ROUND(AVG(temperature)::numeric, 1) as avg_temp,
         ROUND(AVG(humidity)::numeric, 1)    as avg_humidity
       FROM attendance
       WHERE status = 'present'
       GROUP BY weather, attendance_status
       ORDER BY weather, attendance_status`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------
// DATA ANALYST ENDPOINT
// GET /api/analytics/daily
// Rekap kehadiran per hari
// -------------------------------------------------------
app.get('/api/analytics/daily', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
         date,
         COUNT(*) FILTER (WHERE attendance_status = 'tepat_waktu') as tepat_waktu,
         COUNT(*) FILTER (WHERE attendance_status = 'telat')       as telat,
         COUNT(*) FILTER (WHERE attendance_status = 'pulang')      as pulang,
         ROUND(AVG(temperature)::numeric, 1) as avg_temp,
         ROUND(AVG(humidity)::numeric, 1)    as avg_humidity,
         MODE() WITHIN GROUP (ORDER BY weather) as cuaca_dominan
       FROM attendance
       WHERE status = 'present'
       GROUP BY date
       ORDER BY date DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/students', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM students ORDER BY id ASC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/students', async (req, res) => {
  const { uid, name, class: kelas } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO students (uid, name, class)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [uid, name, kelas]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ success: false, error: 'UID already registered' });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(3000, '0.0.0.0', () => {
  console.log('Server running on port 3000');
  console.log('Endpoints:');
  console.log('  POST /api/attendance');
  console.log('  GET  /api/attendance');
  console.log('  GET  /api/students');
  console.log('  POST /api/students');
  console.log('  GET  /api/analytics/weather  <- korelasi cuaca & kehadiran');
  console.log('  GET  /api/analytics/daily    <- rekap harian');
});