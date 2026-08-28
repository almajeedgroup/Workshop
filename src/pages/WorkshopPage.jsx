import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  getWorkshop, getRegistrations, deleteWorkshop, updateRegistration, addRegistrations,
  deleteRegistration,
} from '../lib/db.js';
import RegistrationList from '../components/RegistrationList.jsx';
import { parseRegistrations } from '../lib/parser.js';
import { splitDuplicates, describeDuplicate } from '../lib/dedupe.js';
import {
  listRequests, setRequestStatus, deleteRequest, requestToRegistration,
} from '../lib/publicdb.js';
import RequestsPanel from '../components/RequestsPanel.jsx';
import { amountCollected, paymentCounts, seatsLeft as seatsLeftFor } from '../lib/stats.js';
import { WORKSHOP_FIELDS, ISSUER, CURRENCY } from '../lib/schema.js';
import { formatDateRange } from '../lib/tickets.js';

function shown(field, w) {
  const v = w[field.key];
  if (field.type === 'list') return Array.isArray(v) && v.length ? v.join('; ') : '';
  if (v === null || v === undefined) return '';
  return String(v);
}

export default function WorkshopPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [workshop, setWorkshop] = useState(null);
  const [regs, setRegs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [exporting, setExporting] = useState(false);
  const [q, setQ] = useState('');
  const [payFilter, setPayFilter] = useState('');
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState('');
  const [pendingPaste, setPendingPaste] = useState(null);
  const [requests, setRequests] = useState([]);
  const [reqBusy, setReqBusy] = useState('');

  const reload = async () => {
    const [w, r, q] = await Promise.all([getWorkshop(id), getRegistrations(id), listRequests(id)]);
    setWorkshop(w);
    setRegs(r);
    setRequests(q);
  };

  useEffect(() => {
    let live = true;
    Promise.all([getWorkshop(id), getRegistrations(id), listRequests(id).catch(() => [])])
      .then(([w, r, q]) => { if (live) { setWorkshop(w); setRegs(r); setRequests(q); } })
      .catch((e) => live && setError(e.message))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [id]);

  const stats = useMemo(
    () => ({ ...paymentCounts(regs), collected: amountCollected(workshop, regs) }),
    [regs, workshop]
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return regs.filter((r) => {
      if (payFilter && (r.paymentStatus || 'Pending') !== payFilter) return false;
      if (!needle) return true;
      return (r.searchText || `${r.name} ${r.email} ${r.whatsapp} ${r.ticketId}`.toLowerCase())
        .includes(needle);
    });
  }, [regs, q, payFilter]);

  const changePayment = async (reg, status) => {
    setBusyId(reg.id);
    setError('');
    try {
      const patch = { ...reg, paymentStatus: status };
      if (status === 'Paid' && !patch.amountPaid && workshop.feeAmount) {
        patch.amountPaid = workshop.feeAmount;
      }
      await updateRegistration(id, reg.id, patch);
      setRegs((prev) => prev.map((r) => (r.id === reg.id ? { ...r, ...patch } : r)));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId('');
    }
  };

  const commitPaste = async (rows, skipped) => {
    setAdding(true);
    setError('');
    try {
      await addRegistrations(id, rows);
      await reload();
      setPasteText('');
      setPasteOpen(false);
      setPendingPaste(null);
      setNotice(
        `Added ${rows.length} registration${rows.length === 1 ? '' : 's'}` +
        (skipped ? `, skipped ${skipped} already registered.` : '.')
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setAdding(false);
    }
  };

  /**
   * Registrations arrive as pasted WhatsApp replies, so overlapping batches
   * are routine. Anything that matches someone already registered is held
   * back for a decision rather than quietly issued a second ticket.
   */
  const addPasted = async () => {
    const parsed = parseRegistrations(pasteText);
    if (!parsed.length) {
      setError('No registrations recognised in that text.');
      return;
    }
    setNotice('');
    const { unique, duplicates } = splitDuplicates(parsed, regs);

    // The seat limit was previously only reported after the fact. Adding past
    // it is still allowed — a coordinator may well have authorised it — but it
    // is now a decision rather than a surprise.
    const limit = Number(workshop.seatLimit) || 0;
    const overBy = limit ? regs.length + unique.length - limit : 0;

    if (duplicates.length || overBy > 0) {
      setError('');
      setPendingPaste({ unique, duplicates, overBy });
      return;
    }
    await commitPaste(parsed, 0);
  };

  const deleteOne = async (reg) => {
    setBusyId(reg.id);
    setError('');
    try {
      await deleteRegistration(id, reg.id);
      setRegs((prev) => prev.filter((r) => r.id !== reg.id));
      setNotice(
        `Deleted ${reg.name || 'the registration'}` +
        (reg.ticketId ? ` (ticket ${reg.ticketId}). That number is retired, not reissued.` : '.')
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId('');
    }
  };

  /**
   * Accepting is the manual step: only here does a submission become a
   * registration and get its ticket number. Payment stays Pending until it is
   * marked by hand on the list below.
   */
  const acceptRequest = async (request) => {
    setReqBusy(request.id);
    setError('');
    try {
      const { duplicates } = splitDuplicates([requestToRegistration(request)], regs);
      if (duplicates.length) {
        setError(`${request.name} looks already registered — ${describeDuplicate(duplicates[0])}. Reject the request, or add them by hand if this really is somebody else.`);
        return;
      }
      const [saved] = await addRegistrations(id, [requestToRegistration(request)]);
      await setRequestStatus(request.id, 'accepted', { ticketId: saved?.ticketId || '' });
      await reload();
      setNotice(
        `${request.name} registered as ${saved?.ticketId || 'a new entry'}. ` +
        'Payment is Pending until you mark it below.'
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setReqBusy('');
    }
  };

  const rejectRequest = async (request) => {
    setReqBusy(request.id);
    try {
      await setRequestStatus(request.id, 'rejected');
      await reload();
      setNotice(`${request.name}'s request marked rejected.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setReqBusy('');
    }
  };

  const removeRequest = async (request) => {
    setReqBusy(request.id);
    try {
      await deleteRequest(request.id);
      await reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setReqBusy('');
    }
  };

  const runExport = async (fn) => {
    setExporting(true);
    try {
      const xl = await import('../lib/exporters.js');
      xl[fn](workshop, filtered);
    } catch (e) {
      setError(e.message);
    } finally {
      setExporting(false);
    }
  };

  const remove = async () => {
    try {
      await deleteWorkshop(id);
      nav('/records');
    } catch (e) {
      setError(e.message);
    }
  };

  if (loading) return <main><p className="count">Loading…</p></main>;
  if (!workshop) {
    return <main><div className="empty">Workshop not found. <Link to="/records">Back to records</Link></div></main>;
  }

  const seatsLeft = seatsLeftFor(workshop, regs.length);

  return (
    <main>
      <div className="print-only print-head">
        <div className="org">{ISSUER.name} — {ISSUER.unitLine}</div>
        <div className="rule" />
        <h1>{workshop.title}</h1>
      </div>

      <div className="page-head no-print">
        <div>
          <h1>{workshop.title || '(untitled)'}</h1>
          <div className="count" style={{ marginTop: 4 }}>
            {workshop.code && <span className="tag">{workshop.code}</span>}
            {workshop.mode && <span className="tag solid">{workshop.mode}</span>}
            {formatDateRange(workshop)}
          </div>
        </div>
        <span className="spacer" />
        <div className="btn-row">
          <Link className="btn" to="/records">← Records</Link>
          <Link className="btn" to={`/w/${id}/edit`}>Edit</Link>
          <Link className="btn" to={`/w/${id}/certificates`}>Certificates</Link>
          <button onClick={() => window.print()}>Print / PDF</button>
        </div>
      </div>

      {error && <div className="notice warn">{error}</div>}
      {notice && <div className="notice no-print">{notice}</div>}

      <div className="stats no-print">
        <div className="stat"><span className="n">{stats.total}</span><span className="l">Registered</span></div>
        <div className="stat"><span className="n">{stats.paid}</span><span className="l">Paid</span></div>
        <div className="stat"><span className="n">{stats.pending}</span><span className="l">Pending</span></div>
        <div className="stat">
          <span className="n">{CURRENCY}{stats.collected}</span><span className="l">Collected</span>
        </div>
        {seatsLeft !== null && (
          <div className="stat">
            <span className="n">{seatsLeft < 0 ? `+${-seatsLeft}` : seatsLeft}</span>
            <span className="l">{seatsLeft < 0 ? 'Over limit' : 'Seats left'}</span>
          </div>
        )}
      </div>

      {seatsLeft !== null && seatsLeft <= 0 && (
        <div className="notice warn no-print">
          {seatsLeft === 0
            ? `The seat limit of ${workshop.seatLimit} has been reached.`
            : `Registrations exceed the seat limit of ${workshop.seatLimit} by ${-seatsLeft}.`}
        </div>
      )}

      <div className="panel">
        <h2 className="no-print">Details</h2>
        <dl className="kv">
          {WORKSHOP_FIELDS.map((f) => {
            const v = shown(f, workshop);
            if (!v) return null;
            return (
              <div key={f.key} style={{ display: 'contents' }}>
                <dt>{f.label}</dt>
                <dd>{v}</dd>
              </div>
            );
          })}
        </dl>
      </div>

      <RequestsPanel
        workshop={workshop}
        requests={requests}
        registerLink={`${window.location.origin}/register/${id}`}
        onAccept={acceptRequest}
        onReject={rejectRequest}
        onDelete={removeRequest}
        busyId={reqBusy}
      />

      <div className="panel">
        <div className="page-head" style={{ border: 0, paddingBottom: 0, marginBottom: 12 }}>
          <h2>Registrations</h2>
          <span className="count">{filtered.length} of {regs.length}</span>
          <span className="spacer" />
          <div className="btn-row no-print">
            <button onClick={() => setPasteOpen((o) => !o)}>
              {pasteOpen ? 'Close' : '+ Paste registrations'}
            </button>
            <button onClick={() => runExport('exportRegistrationsXlsx')} disabled={!filtered.length || exporting}>
              Excel
            </button>
            <button onClick={() => runExport('exportRegistrationsCsv')} disabled={!filtered.length || exporting}>
              CSV
            </button>
          </div>
        </div>

        {pasteOpen && (
          <div className="no-print" style={{ marginBottom: 14 }}>
            <textarea
              rows={8}
              className="mono-area"
              style={{ minHeight: 0 }}
              value={pasteText}
              // Editing the text invalidates any duplicate check already shown.
              onChange={(e) => { setPasteText(e.target.value); setPendingPaste(null); }}
              placeholder={'*Name:* …\n*DoB:* …\n*Qualification:* …\n*Course Name:* …\n*WhatsApp #:* …\n*Area:* …\n*Email ID:* …\n\n(paste as many replies as you like, one after another)'}
            />
            <div className="btn-row" style={{ marginTop: 8 }}>
              <button className="primary" onClick={addPasted} disabled={!pasteText.trim() || adding}>
                {adding ? 'Adding…' : 'Add registrations'}
              </button>
              <span className="hint">Each gets a ticket ID automatically.</span>
            </div>

            {pendingPaste && (
              <div className="notice warn" style={{ marginTop: 12 }}>
                {pendingPaste.duplicates.length > 0 && (
                  <>
                    <strong>
                      {pendingPaste.duplicates.length === 1
                        ? 'One of these is already registered:'
                        : `${pendingPaste.duplicates.length} of these are already registered:`}
                    </strong>
                    <ul>
                      {pendingPaste.duplicates.map((d, k) => <li key={k}>{describeDuplicate(d)}</li>)}
                    </ul>
                  </>
                )}

                {pendingPaste.overBy > 0 && (
                  <p style={{ margin: pendingPaste.duplicates.length ? '10px 0 0' : 0 }}>
                    <strong>
                      This would put the workshop {pendingPaste.overBy} over its seat limit of{' '}
                      {workshop.seatLimit}.
                    </strong>{' '}
                    Adding them is allowed — confirm below if that is intended.
                  </p>
                )}
                <div className="btn-row" style={{ marginTop: 10 }}>
                  <button
                    className="primary"
                    disabled={adding || !pendingPaste.unique.length}
                    onClick={() => commitPaste(pendingPaste.unique, pendingPaste.duplicates.length)}
                  >
                    {adding ? 'Adding…' : `Add ${pendingPaste.unique.length}`}
                    {pendingPaste.duplicates.length > 0 ? ' new' : ''}
                  </button>
                  {pendingPaste.duplicates.length > 0 && (
                    <button
                      disabled={adding}
                      onClick={() =>
                        commitPaste(
                          [...pendingPaste.unique, ...pendingPaste.duplicates.map((d) => d.row)],
                          0
                        )
                      }
                    >
                      Add all {pendingPaste.unique.length + pendingPaste.duplicates.length}, repeats included
                    </button>
                  )}
                  <button disabled={adding} onClick={() => setPendingPaste(null)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="toolbar no-print">
          <input
            placeholder="Search name, ticket, phone, email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ minWidth: 240 }}
          />
          <select value={payFilter} onChange={(e) => setPayFilter(e.target.value)}>
            <option value="">All payments</option>
            <option>Pending</option>
            <option>Paid</option>
            <option>Waived</option>
            <option>Refunded</option>
          </select>
          {(q || payFilter) && <button onClick={() => { setQ(''); setPayFilter(''); }}>Clear</button>}
        </div>

        <RegistrationList
          workshop={workshop}
          rows={filtered}
          onPaymentChange={changePayment}
          onDelete={deleteOne}
          busyId={busyId}
        />
      </div>

      <div className="btn-row no-print">
        <button className="primary" onClick={() => runExport('exportWorkshopXlsx')} disabled={exporting}>
          {exporting ? 'Building…' : 'Export whole workshop (Excel)'}
        </button>
        <span className="spacer" style={{ flex: 1 }} />
        {confirming ? (
          <>
            <span className="count">Delete this workshop and all {regs.length} registrations?</span>
            <button className="danger" onClick={remove}>Yes, delete</button>
            <button onClick={() => setConfirming(false)}>Cancel</button>
          </>
        ) : (
          <button className="danger" onClick={() => setConfirming(true)}>Delete</button>
        )}
      </div>
    </main>
  );
}
