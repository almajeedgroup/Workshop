import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  getWorkshop, getRegistrations, deleteWorkshop, updateRegistration, addRegistrations,
  listAllWithRegistrations,
  deleteRegistration,
} from '../lib/db.js';
import RegistrationList from '../components/RegistrationList.jsx';
import { parseRegistrations } from '../lib/parser.js';
import { splitDuplicates, describeDuplicate } from '../lib/dedupe.js';
import {
  listRequests, setRequestStatus, deleteRequest, requestToRegistration,
  setRegistrationOpen, restoreRequest,
} from '../lib/publicdb.js';
import RequestsPanel from '../components/RequestsPanel.jsx';
import RegistrationCards from '../components/RegistrationCards.jsx';
import { getPhotos } from '../lib/photodb.js';
import { amountCollected, paymentCounts, seatsLeft as seatsLeftFor } from '../lib/stats.js';
import {
  visibleWorkshopFields, ISSUER, CURRENCY, workshopFee, isOnlineWorkshop,
} from '../lib/schema.js';
import { formatDateRange } from '../lib/tickets.js';
import { isFinished } from '../lib/overview.js';
import { classIsLive } from '../lib/meeting.js';
import {
  carryPlan, carryRows, describePlan, carrySources,
  pickAll, togglePick, chosenFrom, filterBring,
} from '../lib/carryover.js';

function shown(field, w) {
  const v = w[field.key];
  if (field.type === 'list') return Array.isArray(v) && v.length ? v.join('; ') : '';
  if (v === null || v === undefined) return '';
  // An uploaded image is a data URL hundreds of thousands of characters long.
  // Saying it is set is the useful part; the blob is not readable by anyone.
  if (field.type === 'image') {
    if (!v) return '';
    return String(v).startsWith('data:') ? 'Uploaded' : String(v);
  }
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
  // Bringing a previous course's students across. The other courses are
  // fetched only when this is opened — most visits never use it, and it is a
  // read of every workshop with its registrations.
  const [carryOpen, setCarryOpen] = useState(false);
  const [sources, setSources] = useState(null);
  const [carryFrom, setCarryFrom] = useState('');
  const [carrying, setCarrying] = useState(false);
  // Who, of the ones who could come, is actually coming. `null` means the
  // selection has not been made for the course now chosen, and everybody is
  // ticked — which is where it starts and where it returns on every change
  // of course.
  const [picked, setPicked] = useState(null);
  const [carryQ, setCarryQ] = useState('');
  const [requests, setRequests] = useState([]);
  const [reqBusy, setReqBusy] = useState('');
  const [toggling, setToggling] = useState(false);
  // Both belong to the requests panel, and are shown inside it.
  const [reqError, setReqError] = useState('');
  const [duplicate, setDuplicate] = useState(null);
  const [regView, setRegView] = useState('list');
  const [photos, setPhotos] = useState({});
  // Tracked on its own rather than inferred from `photos`. A course where
  // nobody has a photograph loads an empty map, and an empty map is truthy —
  // which is exactly how the board came up blank before it was fixed.
  const [photosLoaded, setPhotosLoaded] = useState(false);

  // Photographs are heavy and only the cards view wants them, so they are
  // fetched when that view is first opened and not before.
  useEffect(() => {
    if (regView !== 'cards' || photosLoaded) return undefined;
    let live = true;
    getPhotos(id)
      .then((p) => { if (!live) return; setPhotos(p); setPhotosLoaded(true); })
      .catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [regView, photosLoaded, id]);

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
      if (status === 'Paid' && !patch.amountPaid && workshopFee(workshop)) {
        patch.amountPaid = workshopFee(workshop);
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
   * Open the panel and load the other courses.
   *
   * The newest is chosen for you, because it is nearly always the one meant:
   * this course follows the last one. That makes the whole thing open,
   * look, press.
   */
  const openCarry = async () => {
    setCarryOpen(true);
    setError('');
    if (sources) return;
    try {
      const all = carrySources(await listAllWithRegistrations(), id);
      setSources(all);
      setCarryFrom(all[0]?.workshop.id || '');
      setPicked(null);
      setCarryQ('');
    } catch (e) {
      setError(e.message);
      setSources([]);
    }
  };

  /** Bring the chosen ones across. */
  const bringForward = async (plan, source, chosen) => {
    setCarrying(true);
    setError('');
    try {
      const rows = carryRows(chosen, source);
      await addRegistrations(id, rows);
      await reload();
      setCarryOpen(false);
      setPicked(null);
      const left = plan.bring.length - rows.length;
      setNotice(
        `Brought ${rows.length} student${rows.length === 1 ? '' : 's'} from `
        + `“${source.title || 'that course'}”`
        + (left ? `, left ${left} behind` : '')
        + (plan.already.length ? `, skipped ${plan.already.length} already here.` : '.')
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setCarrying(false);
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
  /**
   * A match against somebody already registered WARNS; it does not refuse.
   *
   * dedupe.js says it plainly — "nothing here blocks a save, it reports and
   * the operator decides, two cousins really can share a phone" — and every
   * other route into the register honours that. Accept did not: it refused
   * outright and told you to add the person by hand, which loses the link
   * back to their request. Families share an email address and a phone, and
   * a sibling should not need retyping.
   */
  const acceptRequest = async (request, force = false) => {
    setReqBusy(request.id);
    setError('');
    setReqError('');
    try {
      if (!force) {
        const { duplicates } = splitDuplicates([requestToRegistration(request)], regs);
        if (duplicates.length) {
          setDuplicate({ id: request.id, message: describeDuplicate(duplicates[0]) });
          return;
        }
      }
      setDuplicate(null);
      const [saved] = await addRegistrations(id, [requestToRegistration(request)]);
      await setRequestStatus(request.id, 'accepted', { ticketId: saved?.ticketId || '' });
      await reload();
      setNotice(
        `${request.name} registered as ${saved?.ticketId || 'a new entry'}. ` +
        'Payment is Pending until you mark it below.'
      );
    } catch (e) {
      // Beside the button that failed. The page-level notice sits above the
      // statistics, which is off-screen when you are working in this panel.
      setReqError(e.message);
    } finally {
      setReqBusy('');
    }
  };

  const rejectRequest = async (request) => {
    setReqBusy(request.id);
    setReqError('');
    setDuplicate(null);
    try {
      await setRequestStatus(request.id, 'rejected');
      await reload();
      setNotice(`${request.name}'s request marked rejected.`);
    } catch (e) {
      setReqError(e.message);
    } finally {
      setReqBusy('');
    }
  };

  /**
   * Undo a rejection. Everything the student typed is still on the record —
   * rejecting only ever changed the status — so this puts it back in the
   * queue with nothing lost.
   */
  const putBackRequest = async (request) => {
    setReqBusy(request.id);
    setReqError('');
    try {
      await restoreRequest(request.id);
      await reload();
      setNotice(`${request.name} is back in the queue, with everything they entered.`);
    } catch (e) {
      setReqError(e.message);
    } finally {
      setReqBusy('');
    }
  };

  const removeRequest = async (request) => {
    setReqBusy(request.id);
    setReqError('');
    setDuplicate(null);
    try {
      await deleteRequest(request.id);
      await reload();
      setNotice(`${request.name}'s request was deleted. That one cannot be restored.`);
    } catch (e) {
      setReqError(e.message);
    } finally {
      setReqBusy('');
    }
  };

  /**
   * Publishing writes the public mirror as well as the flag. A workshop
   * created before self-registration existed has no mirror at all, so its
   * link reads "not valid" — this is what fixes that, in one press.
   */
  const toggleRegistration = async (open) => {
    setToggling(true);
    setError('');
    try {
      await setRegistrationOpen(id, workshop, open);
      await reload();
      setNotice(open
        ? 'The registration page is live. Print the QR, or share the link.'
        : 'Registration closed. The form now refuses new entries.');
    } catch (e) {
      setError(e.message);
    } finally {
      setToggling(false);
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
            {isFinished(workshop) && <span className="badge done">Completed</span>}
            {classIsLive(workshop) && <span className="badge on-air">Class open</span>}
            {formatDateRange(workshop)}
          </div>
        </div>
        <span className="spacer" />
        <div className="btn-row">
          <Link className="btn" to="/records">← Records</Link>
          <Link className="btn" to={`/w/${id}/edit`}>Edit</Link>
          {isOnlineWorkshop(workshop) && (
            <Link className="btn" to={`/w/${id}/class`}>Class</Link>
          )}
          <Link className="btn" to={`/w/${id}/attendance`}>Attendance</Link>
          <Link className="btn" to={`/w/${id}/cards`}>ID Cards</Link>
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
          {visibleWorkshopFields(workshop).map((f) => {
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
        onRestore={putBackRequest}
        error={reqError}
        duplicate={duplicate}
        onDismissDuplicate={() => setDuplicate(null)}
        onToggleOpen={toggleRegistration}
        busyId={reqBusy}
        toggling={toggling}
      />

      <div className="panel">
        <div className="page-head" style={{ border: 0, paddingBottom: 0, marginBottom: 12 }}>
          <h2>Registrations</h2>
          <span className="count">{filtered.length} of {regs.length}</span>
          <span className="spacer" />
          <div className="btn-row no-print">
            <button
              className={regView === 'list' ? 'primary' : undefined}
              aria-pressed={regView === 'list'}
              onClick={() => setRegView('list')}
            >
              List
            </button>
            <button
              className={regView === 'cards' ? 'primary' : undefined}
              aria-pressed={regView === 'cards'}
              onClick={() => setRegView('cards')}
              title="Photographs, for checking somebody against their card"
            >
              Cards
            </button>
            <button onClick={() => setPasteOpen((o) => !o)}>
              {pasteOpen ? 'Close' : '+ Paste registrations'}
            </button>
            <button
              onClick={() => (carryOpen ? setCarryOpen(false) : openCarry())}
              title="Bring the students from a previous course onto this one"
            >
              {carryOpen ? 'Close' : '+ From a previous course'}
            </button>
            <button
              className="primary"
              onClick={() => runExport('exportStudentListXlsx')}
              disabled={!filtered.length || exporting}
              title={filtered.length === regs.length
                ? 'All students, one row each, in an Excel file'
                : `Only the ${filtered.length} matching your search — clear it to download all ${regs.length}`}
            >
              {exporting ? 'Building…' : 'Download student list'}
              {filtered.length !== regs.length ? ` (${filtered.length})` : ''}
            </button>
            <button onClick={() => runExport('exportRegistrationsXlsx')} disabled={!filtered.length || exporting}>
              Full Excel
            </button>
            <button onClick={() => runExport('exportRegistrationsCsv')} disabled={!filtered.length || exporting}>
              CSV
            </button>
          </div>
        </div>

        {carryOpen && (() => {
          if (!sources) return <p className="count no-print">Loading your other courses…</p>;
          if (sources.length === 0) {
            return (
              <div className="empty no-print">
                No other course has anybody on it yet. Once one does, its
                students can be brought here in one press.
              </div>
            );
          }
          const from = sources.find((b) => b.workshop.id === carryFrom) || sources[0];
          const plan = carryPlan(from.registrations, regs);
          // Everybody, until somebody says otherwise. Bringing a whole course
          // forward is the common case; unticking two is less work than
          // ticking eighteen.
          const marks = picked ?? pickAll(plan);
          const chosen = chosenFrom(plan, marks);
          const shown = filterBring(plan, carryQ);
          const setMarks = (next) => setPicked(next);

          return (
            <div className="no-print carry" style={{ marginBottom: 14 }}>
              <div className="pick-row">
                <label htmlFor="carry-from"><strong>Bring students from</strong></label>
                <select
                  id="carry-from"
                  value={from.workshop.id}
                  onChange={(e) => {
                    setCarryFrom(e.target.value);
                    // A different course is a different list of people; the
                    // old ticks mean nothing on it.
                    setPicked(null);
                    setCarryQ('');
                  }}
                >
                  {sources.map(({ workshop, registrations }) => (
                    <option key={workshop.id} value={workshop.id}>
                      {workshop.title || '(untitled)'} — {registrations.length} student
                      {registrations.length === 1 ? '' : 's'}
                      {workshop.startDate ? ` · ${workshop.startDate}` : ''}
                    </option>
                  ))}
                </select>
                <span className="spacer" />
                <button
                  className="primary"
                  disabled={carrying || chosen.length === 0}
                  onClick={() => bringForward(plan, from.workshop, chosen)}
                >
                  {carrying
                    ? 'Bringing…'
                    : chosen.length
                      ? `Bring ${chosen.length} student${chosen.length === 1 ? '' : 's'}`
                      : 'Nobody chosen'}
                </button>
              </div>

              <p className="count" style={{ marginTop: 8 }}>
                {describePlan(plan, seatsLeft, marks)}
              </p>

              {plan.bring.length > 0 && (
                <>
                  <div className="carry-tools">
                    <button
                      type="button"
                      className="small"
                      disabled={chosen.length === plan.bring.length}
                      onClick={() => setMarks(pickAll(plan))}
                    >
                      Select all {plan.bring.length}
                    </button>
                    <button
                      type="button"
                      className="small"
                      disabled={chosen.length === 0}
                      onClick={() => setMarks(new Set())}
                    >
                      Clear
                    </button>
                    {plan.bring.length > 8 && (
                      <input
                        type="search"
                        className="small"
                        placeholder="Find a name…"
                        aria-label="Filter the students on that course"
                        value={carryQ}
                        onChange={(e) => setCarryQ(e.target.value)}
                      />
                    )}
                    <span className="spacer" />
                    <span className="hint">
                      {chosen.length} of {plan.bring.length} ticked
                    </span>
                  </div>

                  <ul className="carry-list">
                    {shown.map((r) => (
                      <li key={r.id}>
                        <label>
                          <input
                            type="checkbox"
                            checked={marks.has(r.id)}
                            onChange={() => setMarks(togglePick(marks, r.id))}
                          />
                          <span className="carry-name">{r.name || '(no name)'}</span>
                          <span className="f-sub">{r.whatsapp || r.email || 'no contact'}</span>
                        </label>
                      </li>
                    ))}
                    {shown.length === 0 && (
                      <li className="hint">Nobody on that course matches “{carryQ.trim()}”.</li>
                    )}
                  </ul>
                </>
              )}

              {plan.already.length > 0 && (
                <p className="hint">
                  {plan.already.length} more {plan.already.length === 1 ? 'is' : 'are'} on
                  that course and already registered here, so {plan.already.length === 1 ? 'it is' : 'they are'} not
                  offered: {plan.already.map((r) => r.name).filter(Boolean).slice(0, 6).join(', ')}
                  {plan.already.length > 6 ? ' and others' : ''}.
                </p>
              )}

              <p className="hint">
                Names and contact details come across. Ticket numbers, fees and
                last term’s notes do not — each person is issued a new ticket
                here and starts unpaid.
              </p>
            </div>
          );
        })()}

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

        {regView === 'cards' ? (
          !photosLoaded
            ? <p className="count">Loading photographs…</p>
            : <RegistrationCards workshop={workshop} rows={filtered} photos={photos} />
        ) : (
          <RegistrationList
            workshop={workshop}
            rows={filtered}
            onPaymentChange={changePayment}
            onDelete={deleteOne}
            busyId={busyId}
          />
        )}
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
