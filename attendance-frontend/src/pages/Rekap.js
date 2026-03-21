import React, { useState, useEffect } from 'react';
import api from '../api/axiosConfig';

const statusBadge = (status) => {
  const map = {
    tepat_waktu: { cls: 'badge-green',  label: 'Tepat Waktu' },
    telat:       { cls: 'badge-yellow', label: 'Telat' },
    pulang:      { cls: 'badge-blue',   label: 'Pulang' },
  };
  const s = map[status] || { cls: 'badge-gray', label: status };
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
};

const Rekap = () => {
  const now = new Date();
  const [summary,     setSummary]     = useState([]);
  const [selected,    setSelected]    = useState(null);
  const [detail,      setDetail]      = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [month,       setMonth]       = useState(String(now.getMonth() + 1));
  const [year,        setYear]        = useState(String(now.getFullYear()));
  const [search,      setSearch]      = useState('');
  const [searchClass, setSearchClass] = useState('');

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await api.get('/rekap/summary', { params: { month, year } });
      setSummary(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDetail = async (student) => {
    setSelected(student);
    setLoadingDetail(true);
    try {
      const res = await api.get(`/students/${student.id}/rekap`, {
        params: { month, year }
      });
      setDetail(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetail(false);
    }
  };

    useEffect(() => { fetchSummary(); }, [month, year]);

  const months = [
    'Januari','Februari','Maret','April','Mei','Juni',
    'Juli','Agustus','September','Oktober','November','Desember'
  ];

  const years = Array.from({ length: 5 }, (_, i) =>
    String(now.getFullYear() - i)
  );

  const kelasList = [...new Set(summary.map(s => s.class))].sort();

  const filtered = summary.filter(s => {
    const matchName  = !search      || s.name.toLowerCase().includes(search.toLowerCase());
    const matchClass = !searchClass || s.class === searchClass;
    return matchName && matchClass;
  });

  const getPercentage = (s) => {
    const total = Number(s.total_hadir);
    if (!total) return 0;
    return Math.round((Number(s.tepat_waktu) / total) * 100);
  };

  const getBarColor = (pct) => {
    if (pct >= 80) return '#34d399';
    if (pct >= 60) return '#fbbf24';
    return '#f87171';
  };

  return (
    <div>
      <div className="page-header">
        <h2>Rekap Absensi</h2>
        <p>Histori kehadiran lengkap per siswa</p>
      </div>

      {/* Filter bulan & tahun */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{
          display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center'
        }}>
          <select value={month} onChange={e => { setMonth(e.target.value); setDetail(null); }}
            style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.9em', outline: 'none' }}>
            {months.map((m, i) => (
              <option key={i} value={String(i + 1)}>{m}</option>
            ))}
          </select>

          <select value={year} onChange={e => { setYear(e.target.value); setDetail(null); }}
            style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.9em', outline: 'none' }}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          <input type="text" placeholder="🔍 Cari nama..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 160, padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.9em', outline: 'none' }}
          />

          <select value={searchClass} onChange={e => setSearchClass(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.9em', outline: 'none', minWidth: 130 }}>
            <option value="">Semua Kelas</option>
            {kelasList.map(k => <option key={k} value={k}>{k}</option>)}
          </select>

          <span style={{ fontSize: '0.85em', color: '#718096' }}>
            {filtered.length} siswa
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: detail ? '1fr 1fr' : '1fr', gap: 20 }}>

        {/* Tabel summary semua siswa */}
        <div className="card">
          <div className="card-header">
            <h3>Rekap {months[Number(month) - 1]} {year}</h3>
            {detail && (
              <button onClick={() => { setDetail(null); setSelected(null); }}
                style={{ background: '#f1f5f9', border: 'none', padding: '5px 12px', borderRadius: 6, cursor: 'pointer', fontSize: '0.85em' }}>
                Tutup detail
              </button>
            )}
          </div>

          {loading ? (
            <div className="loading">Memuat data...</div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Kelas</th>
                    <th>Hadir</th>
                    <th>Tepat</th>
                    <th>Telat</th>
                    <th>% Tepat</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={6}>
                      <div className="empty-state">
                        <div style={{ fontSize: '2em' }}>📋</div>
                        <p>Tidak ada data</p>
                      </div>
                    </td></tr>
                  ) : filtered.map(s => {
                    const pct = getPercentage(s);
                    const isSelected = selected?.id === s.id;
                    return (
                      <tr key={s.id}
                        onClick={() => fetchDetail(s)}
                        style={{
                          cursor: 'pointer',
                          background: isSelected ? '#eff6ff' : 'inherit',
                          borderLeft: isSelected ? '3px solid #1a56db' : '3px solid transparent',
                        }}
                      >
                        <td style={{ fontWeight: 600 }}>{s.name}</td>
                        <td>{s.class}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="badge badge-blue">{s.total_hadir}</span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="badge badge-green">{s.tepat_waktu}</span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`badge ${Number(s.telat) > 0 ? 'badge-yellow' : 'badge-gray'}`}>
                            {s.telat}
                          </span>
                        </td>
                        <td style={{ minWidth: 100 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{
                              flex: 1, height: 6, background: '#f1f5f9',
                              borderRadius: 3, overflow: 'hidden'
                            }}>
                              <div style={{
                                width: `${pct}%`, height: '100%',
                                background: getBarColor(pct),
                                borderRadius: 3,
                                transition: 'width 0.3s'
                              }}/>
                            </div>
                            <span style={{ fontSize: '0.78em', color: '#718096', minWidth: 30 }}>
                              {pct}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detail histori siswa */}
        {detail && (
          <div className="card">
            <div className="card-header">
              <div>
                <h3>{detail.student.name}</h3>
                <span style={{ fontSize: '0.82em', color: '#718096' }}>
                  Kelas {detail.student.class} · {detail.student.uid}
                </span>
              </div>
            </div>

            {/* Stat mini */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3,1fr)',
              gap: 10, padding: '12px 16px', borderBottom: '1px solid #f1f5f9'
            }}>
              <div style={{ textAlign: 'center', padding: 10, background: '#ecfdf5', borderRadius: 8 }}>
                <div style={{ fontSize: '1.6em', fontWeight: 700, color: '#10b981' }}>
                  {detail.stats.tepat_waktu}
                </div>
                <div style={{ fontSize: '0.75em', color: '#065f46' }}>Tepat Waktu</div>
              </div>
              <div style={{ textAlign: 'center', padding: 10, background: '#fffbeb', borderRadius: 8 }}>
                <div style={{ fontSize: '1.6em', fontWeight: 700, color: '#f59e0b' }}>
                  {detail.stats.telat}
                </div>
                <div style={{ fontSize: '0.75em', color: '#92400e' }}>Telat</div>
              </div>
              <div style={{ textAlign: 'center', padding: 10, background: '#eff6ff', borderRadius: 8 }}>
                <div style={{ fontSize: '1.6em', fontWeight: 700, color: '#3b82f6' }}>
                  {detail.stats.total}
                </div>
                <div style={{ fontSize: '0.75em', color: '#1e40af' }}>Total Hadir</div>
              </div>
            </div>

            {/* Histori per hari */}
            {loadingDetail ? (
              <div className="loading">Memuat histori...</div>
            ) : detail.attendance.length === 0 ? (
              <div className="empty-state">
                <div style={{ fontSize: '2em' }}>📭</div>
                <p>Tidak ada data bulan ini</p>
              </div>
            ) : (
              <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Jam</th>
                      <th>Status</th>
                      <th>Cuaca</th>
                      <th>Suhu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.attendance.map(r => (
                      <tr key={r.id}>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.85em' }}>
                          {r.date || new Date(r.scanned_at).toLocaleDateString('id-ID')}
                        </td>
                        <td style={{ fontFamily: 'monospace' }}>{r.time || '--:--'}</td>
                        <td>{statusBadge(r.attendance_status)}</td>
                        <td style={{ fontSize: '0.82em' }}>
                          {{ hujan: '🌧️', lembab: '🌥️', panas: '☀️', normal: '⛅' }[r.weather] || '⛅'} {r.weather}
                        </td>
                        <td style={{ fontSize: '0.82em', color: '#718096' }}>
                          {r.temperature ? `${r.temperature}°C` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Rekap;