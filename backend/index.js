const express = require('express');
const pool    = require('./db');
const cors    = require('cors');
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const app     = express();
const cron = require('node-cron');
const xlsx = require('xlsx');
const axiosLib = require('axios');

app.use(express.json());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'PUT'],
}));

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Akses ditolak. Admin only.' });
  }
  next();
};

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token      = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Token tidak ada' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token tidak valid' });
    req.user = user;
    next();
  });
};

// Reset attendance setiap hari jam 00:00
// Hanya hapus data 'present', unknown tetap tersimpan
cron.schedule('0 0 * * *', async () => {
  console.log('Auto reset attendance...');
  // Data tidak dihapus, hanya log saja
  // Karena sudah ada filter DATE(scanned_at) = CURRENT_DATE
  // Jadi otomatis reset sendiri setiap hari baru
  console.log('Reset done - new day started');
}, {
  timezone: "Asia/Jakarta"
});

// -------- CRON: REMINDER BELUM ABSEN (tiap jam 07:30 WIB) --------
// Jalankan 1 jam setelah batas jam masuk (06:30 + 1 jam = 07:30)
// Ubah jadwal sesuai kebutuhan: '30 7 * * 1-6' = jam 07:30, Senin-Sabtu
cron.schedule('30 7 * * 1-6', async () => {
  console.log('Running late reminder cron...');
  try {
    // Ambil semua siswa yang BELUM absen hari ini
    const result = await pool.query(`
      SELECT s.* FROM students s
      WHERE s.phone IS NOT NULL
      AND s.uid NOT IN (
        SELECT uid FROM attendance
        WHERE DATE(scanned_at) = CURRENT_DATE
        AND status = 'present'
      )
    `);

    const today = new Date().toLocaleDateString('id-ID', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });

    for (const student of result.rows) {
      const message = `⚠️ Halo ${student.name}, kamu BELUM ABSEN hari ini (${today})!\n\nSegera lakukan absensi atau hubungi guru jika ada kendala. 🙏`;
      await sendWA(student.phone, message);
      // Delay 1 detik antar pesan agar tidak spam
      await new Promise(r => setTimeout(r, 1000));
    }

    console.log(`Late reminder sent to ${result.rows.length} students`);
  } catch (err) {
    console.error('Cron error:', err.message);
  }
}, {
  timezone: 'Asia/Jakarta'
});

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

// -------- LOGIN --------
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1', [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }

    const user  = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------- REGISTER --------
app.post('/api/auth/register', authenticateToken, adminOnly, async (req, res) => {
  const { username, password, role } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (username, password, role)
       VALUES ($1, $2, $3) RETURNING id, username, role`,
      [username, hashed, role || 'admin']
    );
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Username sudah dipakai' });
    }
    res.status(500).json({ error: err.message });
  }
});

// -------- GET ALL USERS --------
app.get('/api/auth/users', authenticateToken, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, role, created_at FROM users ORDER BY id ASC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------- DELETE USER --------
app.delete('/api/auth/users/:id', authenticateToken, adminOnly, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.post('/api/attendance', async (req, res) => {
  const { uid, temperature, humidity, time, date, status, weather } = req.body;
  console.log(`UID: ${uid} | Status: ${status} | Cuaca: ${weather}`);

  try {
    const studentResult = await pool.query(
      'SELECT * FROM students WHERE uid = $1', [uid]
    );

    if (studentResult.rows.length === 0) {
      await pool.query(
        `INSERT INTO attendance (uid, name, class, status, attendance_status, weather, temperature, humidity, time, date, scanned_at)
         VALUES ($1, 'Unknown', 'Unknown', 'unknown', 'unknown', $2, $3, $4, $5, $6, NOW())`,
        [uid, weather, temperature, humidity, time, date]
      );
      return res.json({ status: 'unknown' });
    }

    const student = studentResult.rows[0];

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

    await pool.query(
      `INSERT INTO attendance (uid, name, class, status, attendance_status, weather, temperature, humidity, time, date, scanned_at)
       VALUES ($1, $2, $3, 'present', $4, $5, $6, $7, $8, $9, NOW())`,
      [uid, student.name, student.class, status, weather, temperature, humidity, time, date]
    );

    // -------- KIRIM WA OTOMATIS SETELAH ABSEN --------
    if (student.phone) {
      const statusLabel = status === 'tepat_waktu' ? 'Tepat Waktu' :
                          status === 'telat'        ? 'TELAT'       :
                          status === 'pulang'       ? 'Pulang'      : status;

      const waMessage = status === 'telat'
        ? `Halo ${student.name}, absensi kamu TERCATAT TELAT pada ${time} hari ini (${date}).\n\nHarap segera melapor ke guru piket. 🙏`
        : `Halo ${student.name}, absensi kamu BERHASIL DICATAT!\n\n📋 Detail:\n- Nama: ${student.name}\n- Kelas: ${student.class}\n- Jam: ${time}\n- Tanggal: ${date}\n- Status: ${statusLabel}\n\nTerima kasih! 😊`;

      sendWA(student.phone, waMessage);
    }

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

// DELETE attendance by id
app.delete('/api/attendance/:id', authenticateToken, adminOnly, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM attendance WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/attendance', authenticateToken, async (req, res) => {
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
app.get('/api/analytics/weather', authenticateToken, async (req, res) => {
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
app.get('/api/analytics/daily',   authenticateToken, async (req, res) => {
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

app.get('/api/students',    authenticateToken, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM students ORDER BY id ASC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/students',   authenticateToken, adminOnly, async (req, res) => {
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

app.delete('/api/students/:id', authenticateToken, adminOnly, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM students WHERE id = $1', [id]);
    res.json({ success: true, message: 'Siswa berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------- GANTI PASSWORD --------
app.put('/api/auth/password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE id = $1', [req.user.id]
    );
    const user  = result.rows[0];
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(401).json({ error: 'Password lama salah' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password = $1 WHERE id = $2',
      [hashed, req.user.id]
    );
    res.json({ success: true, message: 'Password berhasil diubah' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------- EDIT STUDENT --------
app.put('/api/students/:id', authenticateToken, adminOnly, async (req, res) => {
  const { id } = req.params;
  const { uid, name, class: kelas, phone } = req.body;
  try {
    const result = await pool.query(
      `UPDATE students SET uid = $1, name = $2, class = $3, phone = $4
       WHERE id = $5 RETURNING *`,
      [uid, name, kelas, phone, id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'UID sudah dipakai siswa lain' });
    }
    res.status(500).json({ error: err.message });
  }
});

// -------- GET SEMUA SISWA + STATUS HADIR HARI INI --------
app.get('/api/students/today', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        s.*,
        a.attendance_status,
        a.time as scan_time,
        a.scanned_at,
        CASE WHEN a.id IS NOT NULL THEN true ELSE false END as hadir
      FROM students s
      LEFT JOIN attendance a 
        ON s.uid = a.uid 
        AND DATE(a.scanned_at) = CURRENT_DATE
        AND a.status = 'present'
      ORDER BY s.name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------- SCHEDULE OVERRIDE --------
app.get('/api/schedule/today', authenticateToken, async (req, res) => {
  try {
    const today = new Date().toLocaleDateString('id-ID', {
      day:'2-digit', month:'2-digit', year:'numeric'
    }).split('/').reverse().join('/');

    const result = await pool.query(
      'SELECT * FROM schedule_override WHERE date = $1', [today]
    );
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.json({
        jam_masuk_h: 6,  jam_masuk_m: 30,
        jam_telat_h: 6,  jam_telat_m: 30,
        jam_pulang_h: 15, jam_pulang_m: 20
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/schedule/today', authenticateToken, adminOnly, async (req, res) => {
  const { jam_masuk_h, jam_masuk_m, jam_telat_h, jam_telat_m, jam_pulang_h, jam_pulang_m } = req.body;
  try {
    const today = new Date().toLocaleDateString('id-ID', {
      day:'2-digit', month:'2-digit', year:'numeric'
    }).split('/').reverse().join('/');

    await pool.query(`
      INSERT INTO schedule_override (date, jam_masuk_h, jam_masuk_m, jam_telat_h, jam_telat_m, jam_pulang_h, jam_pulang_m)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (date) DO UPDATE SET
        jam_masuk_h=$2, jam_masuk_m=$3,
        jam_telat_h=$4, jam_telat_m=$5,
        jam_pulang_h=$6, jam_pulang_m=$7
    `, [today, jam_masuk_h, jam_masuk_m, jam_telat_h, jam_telat_m, jam_pulang_h, jam_pulang_m]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------- EXPORT EXCEL --------
app.get('/api/export/excel', authenticateToken, async (req, res) => {
  const { startDate, endDate } = req.query;
  try {
    let query = `SELECT name, class, uid, attendance_status, weather, temperature, humidity, time, date, scanned_at
                 FROM attendance WHERE status = 'present'`;
    const params = [];

    if (startDate && endDate) {
      query += ` AND date >= $1 AND date <= $2`;
      params.push(startDate, endDate);
    }
    query += ' ORDER BY scanned_at DESC';

    const result = await pool.query(query, params);

    const data = result.rows.map(r => ({
      'Nama':        r.name,
      'Kelas':       r.class,
      'UID Kartu':   r.uid,
      'Status':      r.attendance_status === 'tepat_waktu' ? 'Tepat Waktu' :
                     r.attendance_status === 'telat' ? 'Telat' :
                     r.attendance_status === 'pulang' ? 'Pulang' : r.attendance_status,
      'Cuaca':       r.weather,
      'Suhu (°C)':   r.temperature,
      'Kelembaban %': r.humidity,
      'Jam':         r.time,
      'Tanggal':     r.date,
    }));

    const ws = xlsx.utils.json_to_sheet(data);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Absensi');

    // Auto column width
    const colWidths = Object.keys(data[0] || {}).map(key => ({
      wch: Math.max(key.length, ...data.map(r => String(r[key] || '').length)) + 2
    }));
    ws['!cols'] = colWidths;

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename=laporan-absensi.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------- NOTIFIKASI WHATSAPP (FONNTE) --------
app.post('/api/notify/whatsapp', authenticateToken, async (req, res) => {
  const { phone, message } = req.body;
  try {
    const response = await axiosLib.post('https://api.fonnte.com/send', {
    target:  phone,
    message: message,
  }, {
    headers: {
      'Authorization': process.env.FONNTE_TOKEN
    }
  });
    res.json({ success: true, data: response.data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------- HELPER KIRIM WA --------
const sendWA = async (phone, message) => {
  if (!phone) return;
  try {
    await axiosLib.post('https://api.fonnte.com/send', {
      target:  phone,
      message: message,
    }, {
      headers: { 'Authorization': process.env.FONNTE_TOKEN }
    });
    console.log(`WA sent to ${phone}`);
  } catch (err) {
    console.error(`WA failed to ${phone}:`, err.message);
  }
};

app.listen(3001, '0.0.0.0', () => {
  console.log('Server running on port 3001');
  console.log('Endpoints:');
  console.log('  POST /api/attendance');
  console.log('  GET  /api/attendance');
  console.log('  GET  /api/students');
  console.log('  POST /api/students');
  console.log('  GET  /api/analytics/weather  <- korelasi cuaca & kehadiran');
  console.log('  GET  /api/analytics/daily    <- rekap harian');
});