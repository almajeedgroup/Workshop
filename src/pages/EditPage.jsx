import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  getWorkshop, getRegistrations, createWorkshop, updateWorkshop, syncRegistrations,
} from '../lib/db.js';
import WorkshopForm from '../components/WorkshopForm.jsx';
import RegistrationEditor from '../components/RegistrationEditor.jsx';
import { parseRegistrations } from '../lib/parser.js';
import { splitDuplicates, describeDuplicate } from '../lib/dedupe.js';
import { WORKSHOP_FIELDS, emptyWorkshop } from '../lib/schema.js';

const REQUIRED = WORKSHOP_FIELDS.filter((f) => f.required);

export default function EditPage({ mode }) {
  const { id } = useParams();
  const nav = useNavigate();
  const isNew = mode === 'new';

  const [workshop, setWorkshop] = useState(emptyWorkshop());
  const [regs, setRegs] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [missingWorkshop, setMissingWorkshop] = useState(false);

  /**
   * The registrations this screen actually loaded. Saving may delete these
   * if they have been removed from the grid — but nothing else, so rows added
   * elsewhere while this page was open survive.
   */
  const baseIds = useRef([]);

  useEffect(() => {
    if (isNew) return;
    let live = true;
    Promise.all([getWorkshop(id), getRegistrations(id)])
      .then(([w, r]) => {
        if (!live) return;
        if (!w) { setMissingWorkshop(true); return; }
        setWorkshop(w);
        setRegs(r);
        baseIds.current = r.map((x) => x.id);
      })
      .catch((e) => live && setError(e.message))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [id, isNew]);

  const missing = REQUIRED.filter((f) => !workshop[f.key]).map((f) => f.label);
  const limit = Number(workshop.seatLimit) || 0;
  const overSeats = limit ? regs.length - limit : 0;

  const save = async () => {
    if (missing.length || missingWorkshop) return;
    setSaving(true);
    setError('');
    try {
      if (isNew) {
        const newId = await createWorkshop(workshop, regs);
        nav(`/w/${newId}`);
      } else {
        await updateWorkshop(id, workshop);
        const result = await syncRegistrations(id, regs, baseIds.current);
        if (result.keptFromOthers > 0) {
          // Don't navigate away silently — rows exist that were never on this
          // screen. Reload so the grid shows them, and stay put.
          const refreshed = await getRegistrations(id);
          setRegs(refreshed);
          baseIds.current = refreshed.map((x) => x.id);
          setSaving(false);
          setNotice(
            `Saved. ${result.keptFromOthers} registration${result.keptFromOthers === 1 ? ' was' : 's were'} ` +
            'added by someone else while this page was open. They have been kept and are now shown below.'
          );
          return;
        }
        nav(`/w/${id}`);
      }
    } catch (e) {
      setError(`Save failed: ${e.message}`);
      setSaving(false);
    }
  };

  const appendPasted = () => {
    const parsed = parseRegistrations(pasteText);
    if (!parsed.length) {
      setError('No registrations recognised in that text.');
      return;
    }
    const { unique, duplicates } = splitDuplicates(parsed, regs);
    setRegs((prev) => [...prev, ...unique]);
    setPasteText('');
    setPasteOpen(false);
    setError('');
    setNotice(
      duplicates.length
        ? `Added ${unique.length}. Skipped ${duplicates.length} already on the list: ` +
          `${duplicates.map(describeDuplicate).join('; ')}.`
        : ''
    );
  };

  if (loading) return <main><p className="count">Loading…</p></main>;

  if (missingWorkshop) {
    return (
      <main>
        <div className="empty">
          That workshop no longer exists. <Link to="/records">Back to records</Link>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="page-head">
        <h1>{isNew ? 'Add workshop' : 'Edit workshop'}</h1>
        <span className="spacer" />
        <div className="btn-row">
          <Link className="btn" to={isNew ? '/records' : `/w/${id}`}>Cancel</Link>
          <button className="primary" onClick={save} disabled={saving || missing.length > 0}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {error && <div className="notice warn">{error}</div>}
      {notice && <div className="notice">{notice}</div>}
      {missing.length > 0 && (
        <div className="notice warn">Required before saving: <strong>{missing.join(', ')}</strong></div>
      )}

      <div className="panel">
        <h2>Details</h2>
        <WorkshopForm value={workshop} onChange={setWorkshop} />
      </div>

      <div className="panel">
        <div className="page-head" style={{ border: 0, paddingBottom: 0, marginBottom: 12 }}>
          <h2>Registrations</h2>
          <span className="spacer" />
          <button onClick={() => setPasteOpen((o) => !o)}>
            {pasteOpen ? 'Close paste box' : 'Paste a list'}
          </button>
        </div>

        {pasteOpen && (
          <div style={{ marginBottom: 14 }}>
            <textarea
              rows={7}
              className="mono-area"
              style={{ minHeight: 0 }}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={'*Name:* …\n*DoB:* …\n*Qualification:* …\n*WhatsApp #:* …\n*Area:* …\n*Email ID:* …\n\n…or a table copied from Excel.'}
            />
            <div className="btn-row" style={{ marginTop: 8 }}>
              <button className="primary" onClick={appendPasted} disabled={!pasteText.trim()}>
                Add to list
              </button>
              <span className="hint">Rows are appended; existing rows are kept.</span>
            </div>
          </div>
        )}

        {overSeats > 0 && (
          <div className="notice warn">
            This list is {overSeats} over the seat limit of {workshop.seatLimit}. Saving is
            allowed — adjust the limit above if the extra places were authorised.
          </div>
        )}

        <RegistrationEditor rows={regs} onChange={setRegs} />
        {!isNew && (
          <div className="hint" style={{ marginTop: 10 }}>
            Saving makes the stored list match what is shown here — rows you delete here are
            deleted from the database. Registrations added by someone else since this page
            loaded are kept, not removed. Ticket IDs already issued never change.
          </div>
        )}
      </div>
    </main>
  );
}
