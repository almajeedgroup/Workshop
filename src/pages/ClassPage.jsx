import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getWorkshop, getRegistrations } from '../lib/db.js';
import { setClassOpen, replaceRoom } from '../lib/meetingdb.js';
import { setMarks } from '../lib/attendancedb.js';
import { attendanceRows } from '../lib/attendance.js';
import {
  classIsLive, classJoinUrl, matchRoom, marksFromRoom, roomIsGuessable, roomUrl,
} from '../lib/meeting.js';
import { ISSUER, isOnlineWorkshop } from '../lib/schema.js';
import { formatDateRange } from '../lib/tickets.js';
import JitsiRoom from '../components/JitsiRoom.jsx';
import '../class.css';

/**
 * The presenter's screen for an online class.
 *
 * It is deliberately not just a video call. A call on its own is Zoom; what
 * makes this worth building into the school's own system is that the class
 * and the REGISTER are on one screen — the presenter can see, live, who is
 * in the room, who is on the course but has not turned up, and who is in the
 * room without being on the course at all, and can take the day's attendance
 * from that in one press instead of reading forty names aloud.
 */
export default function ClassPage() {
  const { id } = useParams();
  const [workshop, setWorkshop] = useState(null);
  const [regs, setRegs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [inRoom, setInRoom] = useState([]);
  const [joined, setJoined] = useState(false);
  const [confirmRoom, setConfirmRoom] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    Promise.all([getWorkshop(id), getRegistrations(id)])
      .then(([w, r]) => {
        if (!live) return;
        if (!w) { setLoadError('That workshop does not exist.'); return; }
        setWorkshop(w);
        setRegs(r);
      })
      .catch((e) => live && setLoadError(e.message))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [id]);

  // Stable, so a participant arriving does not rebuild the meeting.
  const handleParticipants = useCallback((list) => setInRoom(list), []);
  const handleJoined = useCallback(() => setJoined(true), []);
  const handleLeft = useCallback(() => { setJoined(false); setInRoom([]); }, []);

  const rows = useMemo(() => attendanceRows(regs), [regs]);
  const { present, strangers, missing } = useMemo(
    () => matchRoom(inRoom, rows), [inRoom, rows]
  );

  // The register is kept per day, and a class is attended on the day it is
  // held. A session outside the recorded dates — a catch-up, or a course
  // whose dates were never filled in — is still filed under today, which is
  // when those people were actually there.
  const day = new Date().toISOString().slice(0, 10);

  if (loading) return <main><p className="count">Loading…</p></main>;
  if (loadError) {
    return (
      <main>
        <div className="notice warn">{loadError}</div>
        <Link className="btn" to="/records">← Back to Records</Link>
      </main>
    );
  }

  if (!isOnlineWorkshop(workshop)) {
    return (
      <main>
        <div className="page-head no-print">
          <h1>{workshop.title || 'Untitled'}</h1>
        </div>
        <div className="panel">
          <h2>This course is held in person</h2>
          <p>
            An online classroom is set up for courses whose <strong>Mode</strong>{' '}
            is Online or Hybrid. Change the mode on the workshop and the class
            appears here.
          </p>
          <div className="btn-row">
            <Link className="btn" to={`/w/${id}/edit`}>Edit the workshop</Link>
            <Link className="btn" to={`/w/${id}`}>← Back to the workshop</Link>
          </div>
        </div>
      </main>
    );
  }

  const live = classIsLive(workshop);
  const joinLink = classJoinUrl(id);

  const toggle = async () => {
    setBusy('toggle'); setError(''); setNotice('');
    try {
      const next = await setClassOpen(id, workshop, !live);
      setWorkshop(next);
      setNotice(next.classOpen === 'Open'
        ? 'The class is open. The join link now works.'
        : 'The class is closed. The join link no longer lets anyone in.');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const newRoom = async () => {
    setBusy('room'); setError(''); setNotice('');
    try {
      setWorkshop(await replaceRoom(id, workshop));
      setNotice('Moved to a new room. Any link sent out before now is dead.');
      setConfirmRoom(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(joinLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access refused, or an insecure origin. The link is on
      // screen and selectable, so this is a convenience, not the only way.
      setError('Could not copy. Select the link and copy it by hand.');
    }
  };

  const takeAttendance = async () => {
    setBusy('marks'); setError(''); setNotice('');
    try {
      const marks = marksFromRoom(present);
      const n = Object.keys(marks).length;
      if (!n) { setNotice('Nobody in the room is on the register yet.'); return; }
      await setMarks(id, day, marks);
      setNotice(`Marked ${n} ${n === 1 ? 'person' : 'people'} present for ${day}.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <main className="class-page">
      <div className="page-head no-print">
        <h1>{workshop.title || 'Untitled'}</h1>
        <span className={`badge ${live ? 'on-air' : 'off-air'}`}>
          {live ? 'Class open' : 'Class closed'}
        </span>
        <span className="count">{formatDateRange(workshop) || 'no dates'} · {workshop.mode}</span>
        <span className="spacer" />
        <div className="btn-row">
          <Link className="btn" to={`/w/${id}/attendance`}>Attendance</Link>
          <Link className="btn" to={`/w/${id}`}>← Workshop</Link>
        </div>
      </div>

      {error && <div className="notice warn">{error}</div>}
      {notice && <div className="notice">{notice}</div>}

      <div className="class-grid">
        <section className="class-stage" aria-label="The class">
          {live ? (
            <JitsiRoom
              room={workshop.meetingRoom}
              moderator
              subject={workshop.title || 'Class'}
              displayName={workshop.presentedBy || 'Presenter'}
              onParticipants={handleParticipants}
              onJoined={handleJoined}
              onLeft={handleLeft}
            />
          ) : (
            <div className="room-idle">
              <h2>The class is closed</h2>
              <p>
                Opening it publishes the join link and lets students into the
                room. Closing it again takes the room off the public page.
              </p>
              <button
                type="button"
                className="primary big"
                onClick={toggle}
                disabled={Boolean(busy)}
              >
                {busy === 'toggle' ? 'Opening…' : 'Open the class'}
              </button>
              <p className="hint">
                {ISSUER.meetingHost} asks whoever opens a room to sign in once,
                with Google, GitHub or Facebook. Students are never asked to.
              </p>
            </div>
          )}
        </section>

        <aside className="class-side" aria-label="The class register">
          <div className="panel">
            <h2>Join link</h2>
            <p className="hint">
              Send this to the class. It opens the school&rsquo;s own page, not a
              meeting link — so it keeps working when you move the room.
            </p>
            <p className="joinlink"><code>{joinLink}</code></p>
            <div className="btn-row">
              <button type="button" onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
              <a className="btn" href={joinLink} target="_blank" rel="noreferrer">Open as a student</a>
            </div>
            {live && (
              <div className="btn-row" style={{ marginTop: 8 }}>
                <button type="button" className="danger" onClick={toggle} disabled={Boolean(busy)}>
                  {busy === 'toggle' ? 'Closing…' : 'Close the class'}
                </button>
              </div>
            )}
          </div>

          <div className="panel">
            <div className="pick-row">
              <h2>In the room</h2>
              <span className="spacer" />
              <span className="count">{inRoom.length}</span>
            </div>

            {!live ? (
              <p className="hint">Open the class to see who arrives.</p>
            ) : !joined ? (
              <p className="hint">
                Join the room yourself and the list fills in as students arrive.
              </p>
            ) : (
              <>
                <ul className="who">
                  {present.map(({ registration, participant }) => (
                    <li key={registration.id} className="is-present">
                      <span className="who-name">{registration.name}</span>
                      <span className="who-note">{registration.ticketId || participant.displayName}</span>
                    </li>
                  ))}
                  {strangers.map((p, i) => (
                    <li key={`s${p.participantId || i}`} className="is-stranger">
                      <span className="who-name">{p.displayName || 'Unnamed'}</span>
                      <span className="who-note">not on the register</span>
                    </li>
                  ))}
                </ul>
                {missing.length > 0 && (
                  <details className="who-missing">
                    <summary>{missing.length} not here yet</summary>
                    <ul className="who">
                      {missing.map((r) => (
                        <li key={r.id} className="is-missing">
                          <span className="who-name">{r.name}</span>
                          <span className="who-note">{r.ticketId}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                <div className="btn-row" style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    className="primary"
                    onClick={takeAttendance}
                    disabled={Boolean(busy) || present.length === 0}
                  >
                    {busy === 'marks'
                      ? 'Marking…'
                      : present.length
                        ? `Mark ${present.length} present`
                        : 'Mark present'}
                  </button>
                </div>
                <p className="hint">
                  Marks today&rsquo;s register as present. Nobody is marked absent —
                  students join late, and a register should not say otherwise.
                </p>
              </>
            )}
          </div>

          <div className="panel">
            <h2>Room</h2>
            <p className="joinlink"><code>{workshop.meetingRoom || 'not created yet'}</code></p>
            {workshop.meetingRoom && roomIsGuessable(workshop.meetingRoom) && (
              <div className="notice warn">
                This room name is short enough to guess. On a public server that
                means strangers can walk into the class. Replace it.
              </div>
            )}
            {workshop.meetingRoom && (
              <p className="hint">
                Direct address:{' '}
                <a href={roomUrl(workshop.meetingRoom)} target="_blank" rel="noreferrer">
                  {roomUrl(workshop.meetingRoom)}
                </a>
              </p>
            )}
            {confirmRoom ? (
              <div className="btn-row">
                <button type="button" className="danger" onClick={newRoom} disabled={Boolean(busy)}>
                  {busy === 'room' ? 'Moving…' : 'Yes, move the class'}
                </button>
                <button type="button" onClick={() => setConfirmRoom(false)}>Keep this room</button>
              </div>
            ) : (
              <div className="btn-row">
                <button type="button" onClick={() => setConfirmRoom(true)} disabled={Boolean(busy)}>
                  New room
                </button>
              </div>
            )}
            <p className="hint">
              A new room is the only way to shut out a link that has been
              forwarded. Everyone has to be sent the join link again.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
