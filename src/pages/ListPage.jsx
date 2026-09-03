import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listWorkshops, withRegistrations, deleteWorkshop } from '../lib/db.js';
import { listPendingRequests } from '../lib/publicdb.js';
import { WORKSHOP_FIELDS, ISSUER } from '../lib/schema.js';
import { formatDateRange } from '../lib/tickets.js';
import { boardGroups } from '../lib/overview.js';
import BoardGroup from '../components/BoardGroup.jsx';

/** Which view Records opens in, remembered between visits. */
const VIEW_KEY = 'records.view';

function rememberedView() {
  try {
    return localStorage.getItem(VIEW_KEY) === 'table' ? 'table' : 'board';
  } catch {
    // Private browsing, or storage refused. The default is fine.
    return 'board';
  }
}

const TABLE_FIELDS = WORKSHOP_FIELDS.filter((f) => f.inTable);

function displayCell(field, w) {
  const v = w[field.key];
  if (field.key === 'startDate') return formatDateRange(w) || '—';
  if (field.type === 'list') return Array.isArray(v) && v.length ? v.join('; ') : '—';
  if (v === null || v === undefined || v === '') return '—';
  return v;
}

export default function ListPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [mode, setMode] = useState('');
  const [year, setYear] = useState('');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [pendingId, setPendingId] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [view, setView] = useState(rememberedView);
  const [bundles, setBundles] = useState(null);
  const [requests, setRequests] = useState([]);
  const [openIds, setOpenIds] = useState(() => new Set());

  useEffect(() => {
    listWorkshops()
      .then(setRows)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // The board needs every workshop's registrations; the table does not.
  // Fetched only when the board is actually shown, and once.
  useEffect(() => {
    if (view !== 'board' || bundles) return;
    let live = true;
    Promise.all([withRegistrations(rows), listPendingRequests()])
      .then(([b, q]) => { if (!live) return; setBundles(b); setRequests(q); })
      .catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [view, bundles, rows]);

  const chooseView = (next) => {
    setView(next);
    try { localStorage.setItem(VIEW_KEY, next); } catch { /* not worth failing over */ }
  };

  const years = useMemo(
    () => [...new Set(rows.map((r) => (r.startDate || '').slice(0, 4)).filter(Boolean))].sort().reverse(),
    [rows]
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (mode && r.mode !== mode) return false;
      if (year && !(r.startDate || '').startsWith(year)) return false;
      if (!needle) return true;
      return (r.searchText || JSON.stringify(r).toLowerCase()).includes(needle);
    });
  }, [rows, q, mode, year]);

  const totalSeats = filtered.reduce((s, r) => s + (Number(r.seatLimit) || 0), 0);

  // Grouped from the FILTERED list, so the search box narrows the board the
  // same way it narrows the table.
  const groups = useMemo(() => {
    if (!bundles) return [];
    const keep = new Set(filtered.map((w) => w.id));
    return boardGroups(bundles.filter((b) => keep.has(b.workshop.id)), requests);
  }, [bundles, filtered, requests]);

  const doExport = async (kind) => {
    setBusy(kind);
    try {
      // Loaded on demand — most visits never export.
      const xl = await import('../lib/exporters.js');
      // Only the workshops actually on screen: reading every one and
      // discarding the rest cost a query per workshop in the database.
      const bundles = await withRegistrations(filtered);
      if (kind === 'xlsx') xl.exportAllXlsx(bundles);
      else xl.exportWorkshopsCsv(bundles);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  /** Deletes the workshop and every registration under it. */
  const remove = async (w) => {
    setDeletingId(w.id);
    setError('');
    try {
      await deleteWorkshop(w.id);
      setRows((prev) => prev.filter((r) => r.id !== w.id));
      setNotice(`Deleted “${w.title || '(untitled)'}” and its registrations.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setDeletingId('');
      setPendingId('');
    }
  };

  if (loading) return <main><p className="count">Loading records…</p></main>;

  return (
    <main>
      <div className="print-only print-head">
        <h1>Workshop Records</h1>
        <div className="org">{ISSUER.name} — {ISSUER.unitLine}</div>
        <div className="rule" />
      </div>

      <div className="page-head no-print">
        <h1>Records</h1>
        <span className="count">
          {filtered.length} of {rows.length} · {totalSeats} seats
        </span>
        <span className="spacer" />
        <div className="btn-row">
          <Link className="btn" to="/import">Import from text</Link>
          <Link className="btn" to="/new">Add manually</Link>
        </div>
      </div>

      {error && <div className="notice warn">{error}</div>}
      {notice && <div className="notice no-print">{notice}</div>}

      <div className="toolbar no-print">
        <div className="btn-row" role="group" aria-label="View">
          <button
            className={view === 'board' ? 'primary' : undefined}
            aria-pressed={view === 'board'}
            onClick={() => chooseView('board')}
          >
            Board
          </button>
          <button
            className={view === 'table' ? 'primary' : undefined}
            aria-pressed={view === 'table'}
            onClick={() => chooseView('table')}
          >
            Table
          </button>
        </div>
        <input
          placeholder="Search title, venue, resource person…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ minWidth: 280 }}
        />
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="">All modes</option>
          <option>Offline</option>
          <option>Online</option>
          <option>Hybrid</option>
        </select>
        <select value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="">All years</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        {(q || mode || year) && (
          <button onClick={() => { setQ(''); setMode(''); setYear(''); }}>Clear</button>
        )}
        <span className="spacer" />
        <button onClick={() => doExport('xlsx')} disabled={!filtered.length || busy}>
          {busy === 'xlsx' ? 'Building…' : 'Excel'}
        </button>
        <button onClick={() => doExport('csv')} disabled={!filtered.length || busy}>
          {busy === 'csv' ? 'Building…' : 'CSV'}
        </button>
        <button onClick={() => window.print()} disabled={!filtered.length}>Print</button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          {rows.length === 0
            ? <>No workshops stored yet. <Link to="/import">Import your first one from text.</Link></>
            : 'No records match these filters.'}
        </div>
      ) : view === 'board' ? (
        bundles === null ? (
          <p className="count">Loading registrations…</p>
        ) : (
          <>
            <div className="btn-row no-print" style={{ marginBottom: 10 }}>
              <button onClick={() => setOpenIds(new Set(filtered.map((w) => w.id)))}>
                Expand all
              </button>
              <button onClick={() => setOpenIds(new Set())} disabled={openIds.size === 0}>
                Collapse all
              </button>
            </div>
            <div className="board">
              {groups.map((g) => (
                <BoardGroup
                  key={g.workshop.id}
                  group={g}
                  open={openIds.has(g.workshop.id)}
                  onToggle={() => setOpenIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(g.workshop.id)) next.delete(g.workshop.id);
                    else next.add(g.workshop.id);
                    return next;
                  })}
                />
              ))}
            </div>
          </>
        )
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="num" style={{ width: 44 }}>#</th>
                {TABLE_FIELDS.map((f) => (
                  <th key={f.key} className={f.type === 'number' ? 'num' : undefined}>{f.label}</th>
                ))}
                <th className="no-print">Remove</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((w, i) => (
                <tr key={w.id}>
                  <td className="num">{i + 1}</td>
                  {TABLE_FIELDS.map((f) => (
                    <td key={f.key} className={f.type === 'number' ? 'num' : undefined}>
                      {f.key === 'title'
                        ? <Link to={`/w/${w.id}`}>{w.title || '(untitled)'}</Link>
                        : displayCell(f, w)}
                    </td>
                  ))}
                  <td className="no-print">
                    {pendingId === w.id ? (
                      <div className="actions">
                        <button
                          type="button"
                          className="small danger"
                          disabled={Boolean(deletingId)}
                          onClick={() => remove(w)}
                        >
                          {deletingId === w.id ? 'Deleting…' : 'Delete all'}
                        </button>
                        <button
                          type="button"
                          className="small"
                          disabled={Boolean(deletingId)}
                          onClick={() => setPendingId('')}
                        >
                          Keep
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="small"
                        disabled={Boolean(deletingId)}
                        title={`Delete ${w.title || 'this workshop'} and its registrations`}
                        onClick={() => setPendingId(w.id)}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
