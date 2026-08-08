import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseText, SAMPLE_WORKSHOP_TEXT, SAMPLE_REGISTRATION_TEXT } from '../lib/parser.js';
import { createWorkshop } from '../lib/db.js';
import WorkshopForm from '../components/WorkshopForm.jsx';
import RegistrationEditor from '../components/RegistrationEditor.jsx';
import { WORKSHOP_FIELDS } from '../lib/schema.js';

const REQUIRED = WORKSHOP_FIELDS.filter((f) => f.required);

export default function ImportPage() {
  const nav = useNavigate();
  const [text, setText] = useState('');
  const [records, setRecords] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState([]);

  const analyse = () => {
    setError('');
    setSaved([]);
    const parsed = parseText(text);
    if (parsed.length === 0) {
      setError('Nothing recognisable in that text.');
      setRecords(null);
      return;
    }
    setRecords(parsed);
  };

  const patchWorkshop = (i, workshop) =>
    setRecords((rs) => rs.map((r, idx) => (idx === i ? { ...r, workshop } : r)));

  const patchRegistrations = (i, registrations) =>
    setRecords((rs) => rs.map((r, idx) => (idx === i ? { ...r, registrations } : r)));

  const dropRecord = (i) => setRecords((rs) => rs.filter((_, idx) => idx !== i));

  const missingFor = (r) => REQUIRED.filter((f) => !r.workshop[f.key]).map((f) => f.label);

  const saveAll = async () => {
    setSaving(true);
    setError('');
    const done = [];
    try {
      for (const r of records) {
        if (missingFor(r).length) continue;
        const id = await createWorkshop(r.workshop, r.registrations);
        done.push({ id, title: r.workshop.title });
      }
      setSaved(done);
      setRecords(null);
      setText('');
    } catch (e) {
      setError(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const saveOne = async (i) => {
    setSaving(true);
    setError('');
    try {
      const r = records[i];
      const id = await createWorkshop(r.workshop, r.registrations);
      nav(`/w/${id}`);
    } catch (e) {
      setError(`Save failed: ${e.message}`);
      setSaving(false);
    }
  };

  const savable = records ? records.filter((r) => !missingFor(r).length).length : 0;

  return (
    <main>
      <div className="page-head">
        <h1>Import from text</h1>
        <span className="spacer" />
        {records && (
          <div className="btn-row">
            <button onClick={() => setRecords(null)}>Back to text</button>
            <button className="primary" onClick={saveAll} disabled={saving || !savable}>
              {saving ? 'Saving…' : `Save ${savable} record${savable === 1 ? '' : 's'}`}
            </button>
          </div>
        )}
      </div>

      {error && <div className="notice warn">{error}</div>}

      {saved.length > 0 && (
        <div className="notice">
          <strong>Saved {saved.length} record{saved.length === 1 ? '' : 's'}.</strong>
          <ul>
            {saved.map((s) => (
              <li key={s.id}><a href={`/w/${s.id}`}>{s.title || '(untitled)'}</a></li>
            ))}
          </ul>
        </div>
      )}

      {!records && (
        <div className="split">
          <div>
            <div className="field">
              <div className="lab"><label htmlFor="paste">Paste the workshop details</label></div>
              <textarea
                id="paste"
                className="mono-area"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={'Paste the poster, or labelled lines:\n\nWorkshop Title: …\nDate: …\nVenue: …\n\nRegistrations:\n*Name:* …\n*WhatsApp #:* …'}
              />
            </div>
            <div className="btn-row">
              <button className="primary" onClick={analyse} disabled={!text.trim()}>
                Analyse text
              </button>
              <button onClick={() => setText(SAMPLE_WORKSHOP_TEXT)}>Example: poster</button>
              <button onClick={() => setText(`${SAMPLE_WORKSHOP_TEXT}\nRegistrations:\n${SAMPLE_REGISTRATION_TEXT}`)}>
                Example: with registrations
              </button>
              <button onClick={() => setText('')} disabled={!text}>Clear</button>
            </div>
          </div>

          <div className="panel">
            <h3>What the parser understands</h3>
            <ul style={{ paddingLeft: 18, margin: '10px 0 0' }}>
              <li><code>Label: value</code> — including WhatsApp <code>*bold*</code> labels.</li>
              <li><code>Label - value</code>, and labels with no separator (<code>held on 03/09/2025</code>).</li>
              <li>
                <strong>Poster emojis</strong> — 📅 date, ⏰ time, 📍 venue, 💰 fee, 🎓 eligibility,
                📱 contact, ⚠️ seat limit. Paste the promo message straight in.
              </li>
              <li>Dates in almost any form; ranges like <code>15th – 22nd August 2026</code> fill start <em>and</em> end.</li>
              <li>
                Registrations under a <code>Registrations:</code> heading — either the WhatsApp
                reply format (<code>*Name:*</code>, <code>*DoB:*</code> …) repeated per candidate,
                or a pasted table. Emails, phone numbers and dates of birth are detected wherever they sit.
              </li>
              <li>Several workshops in one paste — separate with <code>---</code> or repeat the <code>Title:</code> line.</li>
            </ul>
            <div className="hint" style={{ marginTop: 12 }}>
              Nothing is saved until you review it on the next screen. Ticket IDs are
              allocated on save.
            </div>
          </div>
        </div>
      )}

      {records && records.map((r, i) => {
        const missing = missingFor(r);
        return (
          <div className="record-card" key={i}>
            <header>
              <strong>Record {i + 1}</strong>
              <span>{r.workshop.title || '(untitled)'}</span>
              <span className="spacer" />
              <span className="count" style={{ color: 'inherit' }}>
                {r.registrations.length} registration{r.registrations.length === 1 ? '' : 's'}
              </span>
              <button className="small" onClick={() => saveOne(i)} disabled={saving || missing.length}>
                Save this
              </button>
              <button className="small" onClick={() => dropRecord(i)} disabled={saving}>
                Discard
              </button>
            </header>

            <div className="body">
              {missing.length > 0 && (
                <div className="notice warn">
                  Cannot save yet — fill in: <strong>{missing.join(', ')}</strong>
                </div>
              )}

              {r.warnings.length > 0 && (
                <div className="notice">
                  <strong>Check these:</strong>
                  <ul>{r.warnings.map((w, k) => <li key={k}>{w}</li>)}</ul>
                </div>
              )}

              {Object.keys(r.extras || {}).length > 0 && (
                <div className="notice">
                  <strong>Unmatched labels</strong> (not stored — copy what you need into a field
                  above, or add the label to <code>aliases</code> in <code>schema.js</code>):
                  <ul>
                    {Object.entries(r.extras).map(([k, v]) => (
                      <li key={k}><code>{k}</code>: {v}</li>
                    ))}
                  </ul>
                </div>
              )}

              <WorkshopForm value={r.workshop} onChange={(w) => patchWorkshop(i, w)} />

              <h3 style={{ margin: '16px 0 10px' }}>Registrations</h3>
              <RegistrationEditor
                rows={r.registrations}
                onChange={(p) => patchRegistrations(i, p)}
              />
            </div>
          </div>
        );
      })}
    </main>
  );
}
