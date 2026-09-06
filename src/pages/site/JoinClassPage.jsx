import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getPublicWorkshop } from '../../lib/publicdb.js';
import { classIsLive, classClosedReason } from '../../lib/meeting.js';
import { formatDateRange } from '../../lib/tickets.js';
import { ISSUER } from '../../lib/schema.js';
import JitsiRoom from '../../components/JitsiRoom.jsx';
import ClassBoard from '../../components/ClassBoard.jsx';
import { IconAlert, IconPin, IconUsers } from '../../components/site/Icons.jsx';
import '../../class.css';

/* The public site styles its form fields inline, field by field, rather than
   through a class — so these are lifted from the registration form to match
   it exactly. A join form that looks like the admin tool on a page that
   looks like the school site is the sort of seam people notice without
   being able to say why. */
const LABEL = {
  display: 'block', fontSize: 12, fontWeight: 600, letterSpacing: '.1em',
  textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 6,
};
const INPUT = {
  font: 'inherit', fontSize: 16, width: '100%', padding: '12px 14px',
  borderRadius: 11, border: '1.6px solid var(--hair-2)', background: '#fff',
};

/** What the student was called last time. A class runs for days. */
const NAME_KEY = 'class.name';
const TICKET_KEY = 'class.ticket';

function remembered(key) {
  try { return localStorage.getItem(key) || ''; } catch { return ''; }
}
function remember(key, value) {
  try { localStorage.setItem(key, value); } catch { /* private browsing; not worth failing over */ }
}

/**
 * The page a student opens to attend an online class.
 *
 * The link they are sent points HERE, not at the meeting. That indirection is
 * the whole design: the room name can be replaced after a leak, the class can
 * be closed between sessions, and the link on forty phones keeps working —
 * or stops working — without anybody being sent a new one.
 *
 * They are asked for a name before joining rather than being dropped into a
 * call as "Fellow Jitster". A register needs to know who was there, and a
 * class needs to know who is talking.
 */
export default function JoinClassPage() {
  const { workshopId } = useParams();
  const [workshop, setWorkshop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [name, setName] = useState(() => remembered(NAME_KEY));
  const [ticket, setTicket] = useState(() => remembered(TICKET_KEY));
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let live = true;
    getPublicWorkshop(workshopId)
      .then((w) => {
        if (!live) return;
        if (!w) setLoadError('That class link is not valid. Check the link you were sent.');
        else setWorkshop(w);
      })
      .catch((e) => live && setLoadError(e.message))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [workshopId]);

  if (loading) {
    return <section className="tight"><div className="wrap"><p>Loading…</p></div></section>;
  }

  const live = classIsLive(workshop);

  if (loadError || !live) {
    return (
      <section className="tight">
        <div className="wrap">
          <div className="verdict bad">
            <span className="vico"><IconAlert /></span>
            <div>
              <h3>{workshop?.title || 'This class'}</h3>
              <p>{loadError || classClosedReason(workshop)}</p>
              <p>
                Keep this link. Open it again when the class is due to start —
                it lets you in as soon as the presenter opens the room.
              </p>
              <p>
                Enquiries: {ISSUER.phones.join(' or ')}
              </p>
            </div>
          </div>
          <div style={{ marginTop: 20 }}>
            <Link className="btn" to="/">Go to the school site</Link>
          </div>
        </div>
      </section>
    );
  }

  const submit = (e) => {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    remember(NAME_KEY, clean);
    remember(TICKET_KEY, ticket.trim());
    setJoining(true);
  };

  // The ticket rides along in the display name when it was given. It is what
  // the register is matched on, and an exact match beats guessing at two
  // spellings of the same person.
  const displayName = [name.trim(), ticket.trim()].filter(Boolean).join(' · ');

  if (joining) {
    return (
      <section className="tight">
        <div className="wrap">
          <h1 style={{ fontSize: 'clamp(20px,2.6vw,26px)' }}>{workshop.title}</h1>
          <p style={{ marginTop: 6, marginBottom: 16, fontSize: 14, color: 'var(--ink-soft)' }}>
            {workshop.collaborators
              ? <>In association with <strong>{workshop.collaborators}</strong></>
              : ISSUER.unitLine}
          </p>
          <JitsiRoom
            room={workshop.meetingRoom}
            host={workshop.meetingHost || ISSUER.meetingHost}
            displayName={displayName}
            subject={workshop.title || 'Class'}
            onLeft={() => setJoining(false)}
          />
          {/* The same notes, transcript and handouts the presenter is
              writing, read-only and live. */}
          <div style={{ marginTop: 16 }}>
            <ClassBoard workshopId={workshopId} day={new Date().toISOString().slice(0, 10)} />
          </div>

          <div className="btn-row" style={{ marginTop: 14 }}>
            <button className="btn ghost" type="button" onClick={() => setJoining(false)}>
              Leave the class
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="hero tight">
        <div className="wrap">
          <div style={{ maxWidth: 760 }} data-reveal>
            <span className="eyebrow">Online class</span>
            <h1 className="display" style={{ fontSize: 'clamp(28px,4.4vw,46px)' }}>
              {workshop.title}
            </h1>
            <div className="tri" style={{ marginTop: 20 }}><i /><i /><i /></div>

            <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', marginTop: 22 }}>
              {formatDateRange(workshop) && (
                <span style={{ fontSize: 15, fontWeight: 600 }}>{formatDateRange(workshop)}</span>
              )}
              {workshop.time && (
                <span style={{ fontSize: 15, color: 'var(--ink-soft)' }}>{workshop.time}</span>
              )}
              {workshop.presentedBy && (
                <span style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 15, color: 'var(--ink-soft)' }}>
                  <IconUsers width="17" height="17" />{workshop.presentedBy}
                </span>
              )}
              {workshop.mode === 'Hybrid' && workshop.venue && (
                <span style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 15, color: 'var(--ink-soft)' }}>
                  <IconPin width="17" height="17" />{workshop.venue}
                </span>
              )}
            </div>

            {workshop.collaborators && (
              <p style={{ marginTop: 18, fontSize: 14.5, color: 'var(--ink-soft)' }}>
                In association with <strong style={{ color: 'var(--ink)' }}>{workshop.collaborators}</strong>
              </p>
            )}
          </div>
        </div>
      </section>

      <section style={{ paddingTop: 0 }}>
        <div className="wrap">
          <form className="card" onSubmit={submit} style={{ maxWidth: 520 }} data-reveal>
            <h3>Join the class</h3>
            <p style={{ marginTop: 6, marginBottom: 18, fontSize: 14 }}>
              The class is open. Your name is shown to the presenter and the
              rest of the class.
            </p>

            <label htmlFor="join-name" style={LABEL}>Your full name *</label>
            <input
              id="join-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              autoComplete="name"
              placeholder="As it is on your ticket"
              style={INPUT}
            />

            <label htmlFor="join-ticket" style={{ ...LABEL, marginTop: 18 }}>
              Ticket ID (optional)
            </label>
            <input
              id="join-ticket"
              value={ticket}
              onChange={(e) => setTicket(e.target.value)}
              placeholder="e.g. AIHOW26-014"
              aria-describedby="join-ticket-hint"
              style={INPUT}
            />
            <p id="join-ticket-hint" style={{ marginTop: 6, fontSize: 12.5, color: 'var(--ink-soft)' }}>
              From the ticket you were sent. Adding it makes sure today&rsquo;s
              attendance is recorded against you and not somebody with a
              similar name.
            </p>

            <button className="btn" type="submit" style={{ marginTop: 18 }} disabled={!name.trim()}>
              Join the class
            </button>

            <p style={{ marginTop: 16, fontSize: 12.5, color: 'var(--ink-soft)' }}>
              You will be asked to allow your camera and microphone, and can
              check both before you go in. You may wait briefly in a lobby
              until the presenter admits you. Nothing needs installing.
            </p>
          </form>
        </div>
      </section>
    </>
  );
}
