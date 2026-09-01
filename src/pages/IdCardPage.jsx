import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getWorkshop, getRegistration, updateRegistration } from '../lib/db.js';
import { getPhoto, setPhoto } from '../lib/photodb.js';
import { readImageAsDataUrl } from '../lib/imagefile.js';
import { BLOOD_GROUPS } from '../lib/schema.js';
import { cardFace, ID_CARD_THEMES } from '../lib/idcards.js';
import { IdCardFront, IdCardBack } from '../components/IdCard.jsx';
import '../idcard.css';

/**
 * One participant's ID card: both faces as they will print, and the panel
 * that lets the organiser change what is on this one card.
 *
 * The colourway and the crests belong to the course and are set on the edit
 * screen, so they are shown here but not changed here — one card in a
 * different colour from the other thirty-nine is a mistake, not a feature.
 * What IS per-person is the role, the photograph, and the details a card
 * carries that a registration form never asked for.
 */
export default function IdCardPage() {
  const { id, regId } = useParams();
  const [workshop, setWorkshop] = useState(null);
  const [reg, setReg] = useState(null);
  const [photo, setPhotoState] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyPhoto, setBusyPhoto] = useState(false);

  useEffect(() => {
    let live = true;
    Promise.all([getWorkshop(id), getRegistration(id, regId), getPhoto(id, regId)])
      .then(([w, r, p]) => {
        if (!live) return;
        if (!w || !r) { setLoadError('That card does not exist.'); return; }
        setWorkshop(w);
        setReg(r);
        setPhotoState(p);
      })
      .catch((e) => live && setLoadError(e.message))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [id, regId]);

  if (loading) return <main><p className="count">Loading…</p></main>;
  if (loadError) {
    return (
      <main>
        <div className="notice warn">{loadError}</div>
        <Link className="btn" to={`/w/${id}`}>← Back to the workshop</Link>
      </main>
    );
  }

  const set = (k, v) => setReg((r) => ({ ...r, [k]: v }));

  const save = async () => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await updateRegistration(id, regId, {
        idRole: reg.idRole || '',
        bloodGroup: reg.bloodGroup || '',
        emergencyContact: reg.emergencyContact || '',
        idValidUntil: reg.idValidUntil || '',
      });
      setNotice('Saved. The card below is what will print.');
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const pickPhoto = async (file) => {
    if (!file) return;
    setBusyPhoto(true);
    setError('');
    setNotice('');
    try {
      // Smaller than the payment QR: a 24mm-tall photo needs nothing like
      // 480px, and this one is stored per person rather than per workshop.
      const url = await readImageAsDataUrl(file, { maxPx: 320 });
      await setPhoto(id, regId, url);
      setPhotoState(url);
      setNotice('Photograph saved.');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyPhoto(false);
    }
  };

  const clearPhoto = async () => {
    setBusyPhoto(true);
    setError('');
    try {
      await setPhoto(id, regId, '');
      setPhotoState('');
      setNotice('Photograph removed.');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyPhoto(false);
    }
  };

  const face = cardFace(workshop, { ...reg, photo });
  const theme = ID_CARD_THEMES.find((t) => t.key === face.theme.key);

  return (
    <main>
      <div className="page-head no-print">
        <div>
          <h1>ID card — {reg.name}</h1>
          <div className="count" style={{ marginTop: 4 }}>
            {reg.ticketId || 'no ticket number'} · {workshop.title}
          </div>
        </div>
        <span className="spacer" />
        <div className="btn-row">
          <Link className="btn" to={`/w/${id}`}>← Workshop</Link>
          <Link className="btn" to={`/w/${id}/cards`}>All cards</Link>
          <button onClick={() => window.print()}>Print / Save as PDF</button>
        </div>
      </div>

      {error && <div className="notice warn no-print">{error}</div>}
      {notice && <div className="notice no-print">{notice}</div>}

      <div className="panel" style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
        <div className="idc-scope idc-pair">
          <IdCardFront face={face} />
          <IdCardBack face={face} />
        </div>
      </div>

      <div className="panel no-print">
        <h2>What this card says</h2>
        <p className="hint" style={{ marginTop: 0, marginBottom: 14 }}>
          The colour (<strong>{theme?.label}</strong>) and the crests belong to the whole
          course — change them on <Link to={`/w/${id}/edit`}>Edit</Link> and every card
          follows. Everything below is this person's card alone.
        </p>

        <div className="grid2">
          <div className="field">
            <div className="lab"><label htmlFor="c-photo">Photograph</label></div>
            <div className="btn-row" style={{ alignItems: 'center' }}>
              <label className="btn" style={{ cursor: 'pointer', margin: 0 }}>
                {busyPhoto ? 'Working…' : photo ? 'Replace' : 'Choose a photo'}
                <input
                  id="c-photo"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  style={{ display: 'none' }}
                  disabled={busyPhoto}
                  onChange={(e) => pickPhoto(e.target.files?.[0])}
                />
              </label>
              {photo && (
                <button className="small" disabled={busyPhoto} onClick={clearPhoto}>Remove</button>
              )}
            </div>
            <div className="hint">
              Head and shoulders. Stored separately from the registration, and deleted with it.
            </div>
          </div>

          <div className="field">
            <div className="lab"><label htmlFor="c-role">Role on the card</label></div>
            <input
              id="c-role"
              value={reg.idRole || ''}
              placeholder={workshop.idCardLabel || 'PARTICIPANT'}
              onChange={(e) => set('idRole', e.target.value)}
            />
            <div className="hint">Leave blank to use the course-wide role.</div>
          </div>

          <div className="field">
            <div className="lab"><label htmlFor="c-blood">Blood group</label></div>
            <select id="c-blood" value={reg.bloodGroup || ''} onChange={(e) => set('bloodGroup', e.target.value)}>
              <option value="">—</option>
              {BLOOD_GROUPS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          <div className="field">
            <div className="lab"><label htmlFor="c-emg">Emergency contact</label></div>
            <input
              id="c-emg"
              value={reg.emergencyContact || ''}
              placeholder="A number to call, not the participant's own"
              onChange={(e) => set('emergencyContact', e.target.value)}
            />
          </div>

          <div className="field">
            <div className="lab"><label htmlFor="c-valid">Valid until</label></div>
            <input
              id="c-valid"
              type="date"
              value={reg.idValidUntil || ''}
              onChange={(e) => set('idValidUntil', e.target.value)}
            />
            <div className="hint">Blank means the last day of the course.</div>
          </div>
        </div>

        <div className="btn-row" style={{ marginTop: 8 }}>
          <button className="primary" disabled={saving} onClick={save}>
            {saving ? 'Saving…' : 'Save this card'}
          </button>
        </div>
      </div>
    </main>
  );
}
