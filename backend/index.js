const express = require('express');
const pool    = require('./db');
const cors    = require('cors');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const cron    = require('node-cron');
const xlsx    = require('xlsx');
const axiosLib = require('axios');
const PDFDocument = require('pdfkit');
const app     = express();

app.use(express.json());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'PUT'],
}));

// -------- MIDDLEWARE --------
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

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Akses ditolak. Admin only.' });
  }
  next();
};

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

// -------- CRON: RESET LOG HARIAN --------
cron.schedule('0 0 * * *', async () => {
  console.log('New day started - attendance auto resets via DATE filter');
}, { timezone: 'Asia/Jakarta' });

// -------- CRON: REMINDER BELUM ABSEN (07:30 WIB) --------
cron.schedule('30 7 * * 1-6', async () => {
  console.log('Running late reminder cron...');
  try {
    const result = await pool.query(`
      SELECT s.* FROM students s
      WHERE s.phone IS NOT NULL
      AND s.uid NOT IN (
        SELECT uid FROM attendance
        WHERE DATE(scanned_at) = CURRENT_DATE
        AND status = 'present'
        AND attendance_status IN ('tepat_waktu', 'telat')
      )
    `);

    const today = new Date().toLocaleDateString('id-ID', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });

    for (const student of result.rows) {
      const message = `⚠️ Halo ${student.name}, kamu BELUM ABSEN hari ini (${today})!\n\nSegera lakukan absensi atau hubungi guru jika ada kendala. 🙏`;
      await sendWA(student.phone, message);
      await new Promise(r => setTimeout(r, 1000));
    }
    console.log(`Late reminder sent to ${result.rows.length} students`);
  } catch (err) {
    console.error('Cron error:', err.message);
  }
}, { timezone: 'Asia/Jakarta' });

// ================================================
// AUTH
// ================================================

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }
    const user  = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Username atau password salah' });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/register', authenticateToken, adminOnly, async (req, res) => {
  const { username, password, role } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (username, password, role) VALUES ($1,$2,$3) RETURNING id, username, role`,
      [username, hashed, role || 'admin']
    );
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Username sudah dipakai' });
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/users', authenticateToken, adminOnly, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, role, created_at FROM users ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/auth/users/:id', authenticateToken, adminOnly, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/auth/password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user   = result.rows[0];
    const valid  = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(401).json({ error: 'Password lama salah' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashed, req.user.id]);
    res.json({ success: true, message: 'Password berhasil diubah' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================================================
// SCHEDULE
// ================================================

app.get('/api/schedule/today/public', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM schedule_override
       WHERE date = TO_CHAR(NOW() AT TIME ZONE 'Asia/Jakarta', 'DD/MM/YYYY')`
    );
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.json({ jam_masuk_h:6, jam_masuk_m:30, jam_telat_h:6, jam_telat_m:30, jam_pulang_h:15, jam_pulang_m:20 });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/schedule/today', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM schedule_override
       WHERE date = TO_CHAR(NOW() AT TIME ZONE 'Asia/Jakarta', 'DD/MM/YYYY')`
    );
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.json({ jam_masuk_h:6, jam_masuk_m:30, jam_telat_h:6, jam_telat_m:30, jam_pulang_h:15, jam_pulang_m:20 });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/schedule/today', authenticateToken, adminOnly, async (req, res) => {
  const { jam_masuk_h, jam_masuk_m, jam_telat_h, jam_telat_m, jam_pulang_h, jam_pulang_m } = req.body;
  try {
    await pool.query(`
      INSERT INTO schedule_override (date, jam_masuk_h, jam_masuk_m, jam_telat_h, jam_telat_m, jam_pulang_h, jam_pulang_m)
      VALUES (TO_CHAR(NOW() AT TIME ZONE 'Asia/Jakarta', 'DD/MM/YYYY'),$1,$2,$3,$4,$5,$6)
      ON CONFLICT (date) DO UPDATE SET
        jam_masuk_h=$1, jam_masuk_m=$2, jam_telat_h=$3,
        jam_telat_m=$4, jam_pulang_h=$5, jam_pulang_m=$6
    `, [jam_masuk_h, jam_masuk_m, jam_telat_h, jam_telat_m, jam_pulang_h, jam_pulang_m]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================================================
// STUDENTS
// ================================================

app.get('/api/students/today', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        s.*,
        masuk.attendance_status,
        masuk.time as scan_time,
        masuk.scanned_at,
        CASE WHEN masuk.id IS NOT NULL THEN true ELSE false END as hadir,
        CASE WHEN pulang.id IS NOT NULL THEN true ELSE false END as sudah_pulang,
        pulang.time as pulang_time
      FROM students s
      LEFT JOIN LATERAL (
        SELECT * FROM attendance
        WHERE uid = s.uid
        AND DATE(scanned_at) = CURRENT_DATE
        AND status = 'present'
        AND attendance_status IN ('tepat_waktu', 'telat')
        LIMIT 1
      ) masuk ON true
      LEFT JOIN LATERAL (
        SELECT * FROM attendance
        WHERE uid = s.uid
        AND DATE(scanned_at) = CURRENT_DATE
        AND status = 'present'
        AND attendance_status = 'pulang'
        LIMIT 1
      ) pulang ON true
      ORDER BY s.name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/students', authenticateToken, adminOnly, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM students ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/students', authenticateToken, adminOnly, async (req, res) => {
  const { uid, name, class: kelas, phone } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO students (uid, name, class, phone) VALUES ($1,$2,$3,$4) RETURNING *`,
      [uid, name, kelas, phone]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ success: false, error: 'UID already registered' });
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/students/:id', authenticateToken, adminOnly, async (req, res) => {
  const { id } = req.params;
  const { uid, name, class: kelas, phone } = req.body;
  try {
    const result = await pool.query(
      `UPDATE students SET uid=$1, name=$2, class=$3, phone=$4 WHERE id=$5 RETURNING *`,
      [uid, name, kelas, phone, id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'UID sudah dipakai siswa lain' });
    res.status(500).json({ error: err.message });
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

// ================================================
// ATTENDANCE
// ================================================

app.post('/api/attendance', async (req, res) => {
  const { uid, temperature, humidity, time, date, status, weather } = req.body;
  console.log(`UID: ${uid} | Status: ${status} | Jam: ${time}`);

  try {
    const studentResult = await pool.query('SELECT * FROM students WHERE uid = $1', [uid]);

    if (studentResult.rows.length === 0) {
      await pool.query(
        `INSERT INTO attendance (uid, name, class, status, attendance_status, weather, temperature, humidity, time, date, scanned_at)
         VALUES ($1,'Unknown','Unknown','unknown','unknown',$2,$3,$4,$5,$6,NOW())`,
        [uid, weather, temperature, humidity, time, date]
      );
      return res.json({ status: 'unknown' });
    }

    const student = studentResult.rows[0];

    // ---- KONDISI PULANG ----
    if (status === 'pulang') {
      const alreadyPulang = await pool.query(
        `SELECT * FROM attendance WHERE uid=$1 AND DATE(scanned_at)=CURRENT_DATE AND attendance_status='pulang'`,
        [uid]
      );
      if (alreadyPulang.rows.length > 0) {
        return res.json({ status: 'already', name: student.name, class: student.class });
      }

      // Cek sudah scan masuk dulu
      const sudahMasuk = await pool.query(
        `SELECT * FROM attendance WHERE uid=$1 AND DATE(scanned_at)=CURRENT_DATE
         AND status='present' AND attendance_status IN ('tepat_waktu','telat')`,
        [uid]
      );
      if (sudahMasuk.rows.length === 0) {
        return res.json({ status: 'belum_masuk', name: student.name, class: student.class });
      }

      await pool.query(
        `INSERT INTO attendance (uid, name, class, status, attendance_status, weather, temperature, humidity, time, date, scanned_at)
         VALUES ($1,$2,$3,'present','pulang',$4,$5,$6,$7,$8,NOW())`,
        [uid, student.name, student.class, weather, temperature, humidity, time, date]
      );

      if (student.phone) {
        sendWA(student.phone, `Halo ${student.name}, kamu sudah PULANG pada ${time}. Sampai jumpa besok! 👋`);
      }

      return res.json({ status: 'found', name: student.name, class: student.class, attendance_status: 'pulang' });
    }

    // ---- KONDISI MASUK / TELAT ----
    const alreadyMasuk = await pool.query(
      `SELECT * FROM attendance WHERE uid=$1 AND DATE(scanned_at)=CURRENT_DATE
       AND status='present' AND attendance_status IN ('tepat_waktu','telat')`,
      [uid]
    );
    if (alreadyMasuk.rows.length > 0) {
      return res.json({ status: 'already', name: student.name, class: student.class });
    }

    await pool.query(
      `INSERT INTO attendance (uid, name, class, status, attendance_status, weather, temperature, humidity, time, date, scanned_at)
       VALUES ($1,$2,$3,'present',$4,$5,$6,$7,$8,$9,NOW())`,
      [uid, student.name, student.class, status, weather, temperature, humidity, time, date]
    );

    if (student.phone) {
      const waMessage = status === 'telat'
        ? `Halo ${student.name}, absensi kamu TERCATAT TELAT pada ${time} (${date}).\n\nSegera melapor ke guru piket. 🙏`
        : `Halo ${student.name}, absensi BERHASIL!\n\n- Jam: ${time}\n- Tanggal: ${date}\n- Status: Tepat Waktu\n\nTerima kasih! 😊`;
      sendWA(student.phone, waMessage);
    }

    return res.json({ status: 'found', name: student.name, class: student.class, attendance_status: status });

  } catch (err) {
    console.error('DB Error:', err.message);
    res.status(500).json({ status: 'error', error: err.message });
  }
});

app.get('/api/attendance', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM attendance ORDER BY scanned_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/attendance/:id', authenticateToken, adminOnly, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM attendance WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/attendance/:id', authenticateToken, adminOnly, async (req, res) => {
  const { id } = req.params;
  const { attendance_status, time, note } = req.body;
  try {
    const result = await pool.query(
      `UPDATE attendance SET attendance_status=$1, time=$2, note=$3 WHERE id=$4 RETURNING *`,
      [attendance_status, time, note, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Data tidak ditemukan' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------- ABSENSI MANUAL --------
app.post('/api/attendance/manual', authenticateToken, adminOnly, async (req, res) => {
  const { student_id, attendance_status, date, time, note } = req.body;
  try {
    const studentResult = await pool.query('SELECT * FROM students WHERE id = $1', [student_id]);
    if (studentResult.rows.length === 0) return res.status(404).json({ error: 'Siswa tidak ditemukan' });

    const student    = studentResult.rows[0];
    const targetDate = date || new Date().toLocaleDateString('id-ID', { day:'2-digit', month:'2-digit', year:'numeric' }).split('/').join('/');
    const targetTime = time || new Date().toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit', second:'2-digit' });

    if (attendance_status !== 'pulang') {
      const alreadyExists = await pool.query(
        `SELECT * FROM attendance WHERE uid=$1 AND date=$2 AND attendance_status IN ('tepat_waktu','telat')`,
        [student.uid, targetDate]
      );
      if (alreadyExists.rows.length > 0) {
        return res.status(400).json({ error: `${student.name} sudah absen masuk pada tanggal ${targetDate}` });
      }
    }

    const result = await pool.query(
      `INSERT INTO attendance (uid, name, class, status, attendance_status, weather, temperature, humidity, time, date, scanned_at, note)
       VALUES ($1,$2,$3,'present',$4,'manual',0,0,$5,$6,NOW(),$7) RETURNING *`,
      [student.uid, student.name, student.class, attendance_status, targetTime, targetDate, note || 'Input manual oleh admin']
    );

    if (student.phone) {
      const statusLabel = attendance_status === 'tepat_waktu' ? 'Tepat Waktu' :
                          attendance_status === 'telat'       ? 'Telat' :
                          attendance_status === 'pulang'      ? 'Pulang' : attendance_status;
      sendWA(student.phone,
        `Halo ${student.name}, absensi kamu telah diinput MANUAL oleh admin.\n\n` +
        `- Status: ${statusLabel}\n- Jam: ${targetTime}\n- Tanggal: ${targetDate}\n\n` +
        `Hubungi guru jika ada pertanyaan. 🙏`
      );
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Manual attendance error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ================================================
// ANALYTICS
// ================================================

app.get('/api/analytics/weather', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT weather, attendance_status,
        COUNT(*) as total,
        ROUND(AVG(temperature)::numeric,1) as avg_temp,
        ROUND(AVG(humidity)::numeric,1)    as avg_humidity
      FROM attendance WHERE status='present'
      GROUP BY weather, attendance_status
      ORDER BY weather, attendance_status
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/analytics/daily', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT date,
        COUNT(*) FILTER (WHERE attendance_status='tepat_waktu') as tepat_waktu,
        COUNT(*) FILTER (WHERE attendance_status='telat')       as telat,
        COUNT(*) FILTER (WHERE attendance_status='pulang')      as pulang,
        ROUND(AVG(temperature)::numeric,1) as avg_temp,
        ROUND(AVG(humidity)::numeric,1)    as avg_humidity,
        MODE() WITHIN GROUP (ORDER BY weather) as cuaca_dominan
      FROM attendance WHERE status='present'
      GROUP BY date ORDER BY date DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================================================
// REKAP
// ================================================

app.get('/api/rekap/summary', authenticateToken, async (req, res) => {
  const { month, year } = req.query;
  try {
    let dateFilter = '';
    const params   = [];

    if (month && year) {
      dateFilter = `AND EXTRACT(MONTH FROM a.scanned_at)=$1 AND EXTRACT(YEAR FROM a.scanned_at)=$2`;
      params.push(month, year);
    }

    const result = await pool.query(`
      SELECT
        s.id, s.name, s.class, s.uid, s.phone,
        COUNT(a.id) FILTER (WHERE a.attendance_status='tepat_waktu') as tepat_waktu,
        COUNT(a.id) FILTER (WHERE a.attendance_status='telat')       as telat,
        COUNT(a.id) FILTER (WHERE a.attendance_status='pulang')      as pulang,
        COUNT(a.id) FILTER (WHERE a.status='present' AND a.attendance_status!='pulang') as total_hadir,
        MAX(a.scanned_at) as last_scan
      FROM students s
      LEFT JOIN attendance a ON s.uid=a.uid AND a.status='present' ${dateFilter}
      GROUP BY s.id, s.name, s.class, s.uid, s.phone
      ORDER BY s.name ASC
    `, params);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/students/:id/rekap', authenticateToken, async (req, res) => {
  const { id }          = req.params;
  const { month, year } = req.query;
  try {
    const studentResult = await pool.query('SELECT * FROM students WHERE id=$1', [id]);
    if (studentResult.rows.length === 0) return res.status(404).json({ error: 'Siswa tidak ditemukan' });

    const student = studentResult.rows[0];
    let query     = `SELECT * FROM attendance WHERE uid=$1 AND status='present'`;
    const params  = [student.uid];

    if (month && year) {
      query += ` AND EXTRACT(MONTH FROM scanned_at)=$2 AND EXTRACT(YEAR FROM scanned_at)=$3`;
      params.push(month, year);
    }
    query += ' ORDER BY scanned_at DESC';

    const attendance = await pool.query(query, params);
    const rows       = attendance.rows;
    const stats      = {
      total:       rows.filter(r => r.attendance_status !== 'pulang').length,
      tepat_waktu: rows.filter(r => r.attendance_status === 'tepat_waktu').length,
      telat:       rows.filter(r => r.attendance_status === 'telat').length,
      pulang:      rows.filter(r => r.attendance_status === 'pulang').length,
    };

    res.json({ student, attendance: rows, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================================================
// NOTIFY WA
// ================================================

app.post('/api/notify/whatsapp', authenticateToken, async (req, res) => {
  const { phone, message } = req.body;
  try {
    const response = await axiosLib.post('https://api.fonnte.com/send', {
      target: phone, message,
    }, { headers: { 'Authorization': process.env.FONNTE_TOKEN } });
    res.json({ success: true, data: response.data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================================================
// EXPORT
// ================================================

app.get('/api/export/excel', authenticateToken, async (req, res) => {
  const { startDate, endDate } = req.query;
  try {
    let query, params = [];
    if (startDate && endDate) {
      query  = `SELECT name, class, uid, attendance_status, weather, temperature, humidity, time, date, scanned_at
                FROM attendance WHERE status='present'
                AND scanned_at>=$1::date AND scanned_at<($2::date+interval '1 day')
                ORDER BY scanned_at DESC`;
      params = [startDate, endDate];
    } else {
      query = `SELECT name, class, uid, attendance_status, weather, temperature, humidity, time, date, scanned_at
               FROM attendance WHERE status='present' ORDER BY scanned_at DESC`;
    }

    const result = await pool.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Tidak ada data' });

    const data = result.rows.map(r => ({
      'Nama':         r.name,
      'Kelas':        r.class,
      'UID Kartu':    r.uid,
      'Status':       r.attendance_status === 'tepat_waktu' ? 'Tepat Waktu' :
                      r.attendance_status === 'telat'       ? 'Telat' :
                      r.attendance_status === 'pulang'      ? 'Pulang' : r.attendance_status,
      'Cuaca':        r.weather,
      'Suhu (°C)':    r.temperature,
      'Kelembaban %': r.humidity,
      'Jam':          r.time,
      'Tanggal':      r.date,
    }));

    const ws = xlsx.utils.json_to_sheet(data);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Absensi');
    ws['!cols'] = Object.keys(data[0]).map(key => ({
      wch: Math.max(key.length, ...data.map(r => String(r[key] || '').length)) + 2
    }));

    const buffer   = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = startDate && endDate ? `laporan-${startDate}-sd-${endDate}.xlsx` : 'laporan-semua.xlsx';
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/export/pdf', authenticateToken, async (req, res) => {
  const { startDate, endDate } = req.query;
  try {
    let query, params = [];
    if (startDate && endDate) {
      query  = `SELECT name, class, uid, attendance_status, weather, temperature, humidity, time, date, scanned_at
                FROM attendance WHERE status='present'
                AND scanned_at>=$1::date AND scanned_at<($2::date+interval '1 day')
                ORDER BY scanned_at DESC`;
      params = [startDate, endDate];
    } else {
      query = `SELECT name, class, uid, attendance_status, weather, temperature, humidity, time, date, scanned_at
               FROM attendance WHERE status='present' ORDER BY scanned_at DESC`;
    }

    const result = await pool.query(query, params);
    const doc    = new PDFDocument({ margin: 40, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition',
      `attachment; filename=laporan${startDate ? `-${startDate}-sd-${endDate}` : ''}.pdf`
    );
    doc.pipe(res);

    doc.fontSize(18).font('Helvetica-Bold').text('NASI - Laporan Absensi', { align: 'center' });
    doc.fontSize(11).font('Helvetica').fillColor('#718096');
    doc.text(startDate && endDate ? `Periode: ${startDate} s/d ${endDate}` : 'Semua Data', { align: 'center' });
    doc.text(`Dicetak: ${new Date().toLocaleString('id-ID')}`, { align: 'center' });
    doc.moveDown(0.5);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#e2e8f0').lineWidth(1).stroke();
    doc.moveDown(0.5);

    const total      = result.rows.length;
    const tepatWaktu = result.rows.filter(r => r.attendance_status === 'tepat_waktu').length;
    const telat      = result.rows.filter(r => r.attendance_status === 'telat').length;
    const pulang     = result.rows.filter(r => r.attendance_status === 'pulang').length;

    doc.fontSize(10).font('Helvetica-Bold').fillColor('#2d3748');
    doc.text(`Total: ${total}  |  Tepat Waktu: ${tepatWaktu}  |  Telat: ${telat}  |  Pulang: ${pulang}`, { align: 'center' });
    doc.moveDown(0.8);

    const colX     = [40, 140, 200, 280, 360, 420, 475];
    const colLabel = ['Nama', 'Kelas', 'Tanggal', 'Jam', 'Status', 'Cuaca', 'Suhu'];
    const rowH     = 20;

    doc.rect(40, doc.y, 515, rowH).fillColor('#1a56db').fill();
    const headerY = doc.y + 5;
    doc.font('Helvetica-Bold').fontSize(9).fillColor('white');
    colLabel.forEach((label, i) => {
      doc.text(label, colX[i], headerY, { width: (colX[i+1] || 555) - colX[i] - 4 });
    });
    doc.y += rowH - 14;

    doc.font('Helvetica').fontSize(8.5).fillColor('#2d3748');
    result.rows.forEach((r, idx) => {
      const rowY = doc.y;
      if (idx % 2 === 0) doc.rect(40, rowY, 515, rowH).fillColor('#f8fafc').fill();

      const statusLabel = r.attendance_status === 'tepat_waktu' ? 'Tepat Waktu' :
                          r.attendance_status === 'telat'        ? 'Telat' :
                          r.attendance_status === 'pulang'       ? 'Pulang' : r.attendance_status;

      const rowData = [
        r.name, r.class,
        r.date || new Date(r.scanned_at).toLocaleDateString('id-ID'),
        r.time || '--:--', statusLabel, r.weather || '-',
        r.temperature ? `${r.temperature}°C` : '-',
      ];

      doc.fillColor('#2d3748');
      rowData.forEach((val, i) => {
        doc.text(String(val||'-'), colX[i]+2, rowY+6, { width: (colX[i+1]||555)-colX[i]-4, lineBreak: false });
      });

      doc.moveTo(40, rowY+rowH).lineTo(555, rowY+rowH).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
      doc.y = rowY + rowH;
      if (doc.y > 750) { doc.addPage(); doc.y = 40; }
    });

    doc.moveDown(1);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#e2e8f0').lineWidth(1).stroke();
    doc.moveDown(0.3);
    doc.fontSize(8).fillColor('#a0aec0').text('Dokumen ini digenerate otomatis oleh sistem NASI Attendance', { align: 'center' });
    doc.end();

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================================================
// START SERVER
// ================================================

app.listen(3001, '0.0.0.0', () => {
  console.log('Server running on port 3001');
});