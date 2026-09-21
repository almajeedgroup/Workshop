import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getPublicWorkshop } from '../../lib/publicdb.js';
import { recordSelfJoin } from '../../lib/attendancedb.js';
import { classIsLive, classClosedReason, canEmbedMeeting } from '../../lib/meeting.js';
import { formatDateRange } from '../../lib/tickets.js';
import { ISSUER } from '../../lib/schema.js';
import JitsiRoom from '../../components/JitsiRoom.jsx';
import RoomLauncher from '../../components/RoomLauncher.jsx';
import ClassBoard from '../../components/ClassBoard.jsx';
import { IconAlert, IconPin, IconUsers } from '../../components/site/Icons.jsx';
import '../../class.css';

/* The public site styles its form fields inline, field by field, rather than
   through a class — so both use `.f-label` and `.f-input` from site.css.
   They used to each inline the same eight declarations, which is how one of
   them kept an invisible field border after the other was fixed. */

/** Today, as the register keys its days. */
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Enough of a shape to catch a typo, and no more.
 *
 * It deliberately does NOT check the ticket against the register: that
 * would mean letting an unauthenticated browser read registrations, and
 * the roster is exactly what must not be readable. A wrong ticket records
 * attendance against nobody, and the office sees an unmarked row — which
 * is the same thing that happens today when nobody takes the register.
 */
function looksLikeTicketId(v) {
  return /^[A-Z0-9]{2,}[A-Z0-9 _-]*[A-Z0-9]$/i.test(String(v).trim())
    && String(v).trim().length >= 3;
}

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
  const [ticketError, setTicketError] = useState('');
  /* Whether today's attendance was taken. null while the write is in
     flight, then true or false. It is shown because the student is
     being told they no longer have to be marked by hand — and a
     promise like that has to say when it did not keep itself. */
  const [recorded, setRecorded] = useState(null);

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
    return <section className="band light tight" data-tone="light"><div className="wrap"><p>Loading…</p></div></section>;
  }

  const live = classIsLive(workshop);

  if (loadError || !live) {
    return (
      <section className="band light tight" data-tone="light">
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
          <div className="mt-5">
            <Link className="btn" to="/">Go to the school site</Link>
          </div>
        </div>
      </section>
    );
  }

  const submit = (e) => {
    e.preventDefault();
    const clean = name.trim();
    const tick = ticket.trim().toUpperCase();
    if (!clean || !tick) return;

    if (!looksLikeTicketId(tick)) {
      setTicketError('That does not look like a ticket ID. It is the code on '
        + 'your ticket, like AIHOW26-014.');
      return;
    }
    setTicketError('');
    remember(NAME_KEY, clean);
    remember(TICKET_KEY, tick);

    /* The register marks itself. This is the whole point of asking for the
       ticket: nobody has to go down a list of forty names while also
       teaching. It is deliberately NOT awaited — being in the class matters
       more than recording that you are, and the write is create-only, so a
       second attempt on a second day is the only thing that can happen. */
    setRecorded(null);
    recordSelfJoin(workshopId, today(), tick).then(setRecorded, () => setRecorded(false));
    setJoining(true);
  };

  // The ticket rides along in the display name when it was given. It is what
  // the register is matched on, and an exact match beats guessing at two
  // spellings of the same person.
  const displayName = [name.trim(), ticket.trim()].filter(Boolean).join(' · ');

  if (joining) {
    return (
      <section className="band light tight" data-tone="light">
        <div className="wrap">
          <h1 className="t-display-sm" >{workshop.title}</h1>
          <p className="t-base" style={{ marginTop: 6, marginBottom: 16, color: 'var(--ink-soft)' }}>
            {workshop.collaborators
              ? <>In association with <strong>{workshop.collaborators}</strong></>
              : ISSUER.unitLine}
          </p>
          {canEmbedMeeting(workshop.meetingHost || ISSUER.meetingHost) ? (
            <JitsiRoom
              room={workshop.meetingRoom}
              host={workshop.meetingHost || ISSUER.meetingHost}
              displayName={displayName}
              subject={workshop.title || 'Class'}
              onLeft={() => setJoining(false)}
            />
          ) : (
            <RoomLauncher
              room={workshop.meetingRoom}
              host={workshop.meetingHost || ISSUER.meetingHost}
              subject="Your class is ready"
              label="Open the class"
            />
          )}
          {/* The same notes, transcript and handouts the presenter is
              writing, read-only and live. */}
          <div className="mt-4">
            <ClassBoard
              workshopId={workshopId}
              day={new Date().toISOString().slice(0, 10)}
              displayName={displayName}
            />
          </div>

          <p className="t-xs mt-4" style={{ color: 'var(--ink-soft)' }} aria-live="polite">
            {recorded === null ? 'Taking today\u2019s attendance\u2026'
              : recorded
                ? <>Today&rsquo;s attendance is recorded against <b>{ticket.trim().toUpperCase()}</b>.</>
                : <>Today&rsquo;s attendance could not be recorded from here, so you
                    will be marked by hand. Nothing else about the class is affected.</>}
          </p>

          <div className="btn-row mt-4">
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
      <section className="band hero quiet tight" data-tone="light">
        <div className="wrap">
          <div style={{ maxWidth: 820 }} data-reveal>
            <span className="ann flat"><b>Online class</b> {ISSUER.operator}</span>
            <h1 className="display-lead sm">{workshop.title}</h1>

            <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', marginTop: 22 }}>
              {formatDateRange(workshop) && (
                <span className="t-md" style={{ fontWeight: 600 }}>{formatDateRange(workshop)}</span>
              )}
              {workshop.time && (
                <span className="t-md" style={{ color: 'var(--ink-soft)' }}>{workshop.time}</span>
              )}
              {workshop.presentedBy && (
                <span className="t-md" style={{ display: 'flex', gap: 7, alignItems: 'center', color: 'var(--ink-soft)' }}>
                  <IconUsers width="17" height="17" />{workshop.presentedBy}
                </span>
              )}
              {workshop.mode === 'Hybrid' && workshop.venue && (
                <span className="t-md" style={{ display: 'flex', gap: 7, alignItems: 'center', color: 'var(--ink-soft)' }}>
                  <IconPin width="17" height="17" />{workshop.venue}
                </span>
              )}
            </div>

            {workshop.collaborators && (
              <p className="t-base" style={{ marginTop: 18, color: 'var(--ink-soft)' }}>
                In association with <strong style={{ color: 'var(--ink)' }}>{workshop.collaborators}</strong>
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="band paper" data-tone="light" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <form className="panel" onSubmit={submit} style={{ maxWidth: 520 }} data-reveal>
            <h3>Join the class</h3>
            <p className="t-base" style={{ marginTop: 6, marginBottom: 18 }}>
              The class is open. Your name is shown to the presenter and the
              rest of the class.
            </p>

            <label htmlFor="join-name" className="f-label">Your full name *</label>
            <input
              id="join-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              autoComplete="name"
              placeholder="As it is on your ticket"
              className="f-input"
            />

            <label htmlFor="join-ticket" className="f-label mt-5">Your ticket ID *</label>
            <input
              id="join-ticket"
              value={ticket}
              onChange={(e) => setTicket(e.target.value)}
              required
              placeholder="AIHOW26-014"
              aria-invalid={ticketError ? 'true' : undefined}
              aria-describedby={ticketError ? 'join-ticket-wrong join-ticket-hint' : 'join-ticket-hint'}
              className="f-input f-code"
            />
            <p id="join-ticket-hint" className="t-xs" style={{ marginTop: 6, color: 'var(--ink-soft)' }}>
              It is on the ticket you were sent. Today&rsquo;s attendance is
              recorded against it, so you do not have to be marked by hand —
              and it is what tells two people with the same name apart.
            </p>

            {ticketError && (
              <p className="f-wrong" id="join-ticket-wrong" role="alert">{ticketError}</p>
            )}

            <button className="btn mt-5" type="submit" disabled={!name.trim() || !ticket.trim()}>
              Join the class
            </button>

            <p className="t-xs" style={{ marginTop: 16, color: 'var(--ink-soft)' }}>
              The class opens in its own window. You will be asked to allow
              your camera and microphone, and can check both before you go in.
              Keep this page open beside it — the notes, the transcript and any
              handouts appear here. Nothing needs installing.
            </p>
          </form>
        </div>
      </section>
    </>
  );
}
