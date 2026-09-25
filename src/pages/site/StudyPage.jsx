import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../AuthContext.jsx';
import { getPublicWorkshop } from '../../lib/publicdb.js';
import { listMyCourses, claimTicket } from '../../lib/studentdb.js';
import { formatDateRange } from '../../lib/tickets.js';
import { ISSUER } from '../../lib/schema.js';
import { IconArrow, IconBook, IconShield } from '../../components/site/Icons.jsx';

/**
 * A student's own shelf: every course they took, and what is on it.
 *
 * ── WHY THIS ASKS FOR A TICKET AND NOT A PASSWORD ────────────────────────
 *
 * There is no student account to give a password to. Registrations are
 * administrator-only — they carry every student's phone number — so nothing
 * in this app can look a student up and check them against a list. What a
 * student has is a Google account, which is a real identity somebody else
 * verified, and the ticket printed on their ticket.
 *
 * So the pair is the key: sign in as yourself, then say which ticket is
 * yours. The claim is exclusive, so a ticket belongs to one account for
 * good, and the office can see and undo one.
 */

const looksLikeTicketId = (v) => /^[A-Z0-9][A-Z0-9 _-]*[A-Z0-9]$/i.test(String(v).trim())
  && String(v).trim().length >= 3;

export default function StudyPage() {
  const { user, loading, loginStudentWithGoogle, logout } = useAuth();

  const [courses, setCourses] = useState(null);   // null = not looked yet
  const [ticket, setTicket] = useState('');
  const [workshopId, setWorkshopId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async (uid) => {
    const mine = await listMyCourses(uid);
    // The student's own list holds an ID and a ticket. The course's NAME is
    // in the public mirror, which anybody may read one document of — so the
    // dashboard is built from two sources and neither needs the roster.
    const withTitles = await Promise.all(mine.map(async (c) => ({
      ...c,
      workshop: await getPublicWorkshop(c.workshopId).catch(() => null),
    })));
    setCourses(withTitles);
  }, []);

  useEffect(() => {
    if (!user) { setCourses(null); return; }
    load(user.uid).catch(() => setCourses([]));
  }, [user, load]);

  const signIn = async () => {
    setError('');
    try { await loginStudentWithGoogle(); }
    catch (e) {
      // A popup the person closed themselves is not an error worth showing.
      if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request') return;
      setError('Google sign-in did not complete. Try again, or use a different browser.');
    }
  };

  const claim = async (e) => {
    e.preventDefault();
    const id = workshopId.trim().toUpperCase();
    const tick = ticket.trim();
    setError(''); setNote('');

    if (!id) { setError('Type the course code — it is on your ticket, above the ticket ID.'); return; }
    if (!looksLikeTicketId(tick)) {
      setError('That does not look like a ticket ID. It is the code on your ticket, like AIHOW26-014.');
      return;
    }

    setBusy(true);
    try {
      await claimTicket(id, tick, user);
      setTicket(''); setWorkshopId('');
      setNote('Added. Your recordings and notes are below.');
      await load(user.uid);
    } catch (err) {
      setError(claimError(err));
    } finally {
      setBusy(false);
    }
  };

  /* ---------------- states before the shelf ---------------- */

  if (loading) {
    return (
      <section className="band hero quiet tight" data-tone="light">
        <div className="wrap"><p className="lede">One moment…</p></div>
      </section>
    );
  }

  if (!user) {
    return (
      <>
        <section className="band hero quiet tight" data-tone="light">
          <div className="wrap">
            <div className="hero-mid" data-reveal>
              <span className="ann flat"><b>Your courses</b> {ISSUER.operator}</span>
              <h1 className="display-lead">Your recordings, <em>kept</em></h1>
              <p className="lede">
                Every class you took, the recordings and the notes, in one place.
                Sign in with the Google account you want them kept under, then
                add the ticket ID from your ticket.
              </p>
              <div className="acts">
                <button className="btn" type="button" onClick={signIn}>
                  Sign in with Google <IconArrow />
                </button>
              </div>
              {error && <p className="f-wrong" role="alert">{error}</p>}
            </div>
          </div>
        </section>

        <section className="band paper tight" data-tone="light">
          <div className="wrap">
            <div className="panel" data-reveal style={{ maxWidth: 720 }}>
              <span className="kick"><IconShield /> What signing in does</span>
              <p className="t-base mt-3">
                It identifies you, and nothing more. It does not give this account
                access to anybody&rsquo;s details, any course you did not take, or
                anything at all until you add a ticket that belongs to you. A ticket
                can be claimed once, so it stays yours.
              </p>
              <p className="t-base mt-3">
                Lost your ticket ID? Call the office on{' '}
                <a href={`tel:${ISSUER.phones[0].replace(/\s/g, '')}`}>{ISSUER.phones[0]}</a>.
              </p>
            </div>
          </div>
        </section>
      </>
    );
  }

  /* ---------------- signed in ---------------- */

  return (
    <>
      <section className="band hero quiet tight" data-tone="light">
        <div className="wrap">
          <div className="hero-mid" data-reveal>
            <span className="ann flat"><b>Your courses</b> {user.email}</span>
            <h1 className="display-lead sm">
              {user.displayName ? `Welcome back, ${user.displayName.split(' ')[0]}` : 'Your courses'}
            </h1>
            {/* Signing out is not what anybody came here to do, so it does
                not get the shape of the page's main action. It stays
                findable and stops competing with the courses below. */}
            <p className="t-sm mt-4" style={{ color: 'var(--ink-faint)' }}>
              Not you?{' '}
              <button type="button" className="linkish" onClick={logout}>Sign out</button>
            </p>
          </div>
        </div>
      </section>

      <section className="band paper" data-tone="light">
        <div className="wrap">
          <div className="head" data-reveal>
            <h2>What you can <em>open</em></h2>
          </div>

          {courses === null && <p className="lede mt-5">Looking…</p>}

          {courses?.length === 0 && (
            <div className="panel mt-5" data-reveal>
              <p className="t-base">
                Nothing here yet. Add the ticket ID from your ticket below and the
                course&rsquo;s recordings and notes will appear.
              </p>
            </div>
          )}

          {courses?.length > 0 && (
            <div className="courses mt-6">
              {courses.map(({ workshopId: id, ticketId, workshop }) => (
                <Link className="course" key={id} to={`/study/${id}`} data-reveal>
                  <span className="course-ico" aria-hidden="true"><IconBook /></span>
                  <span className="course-what">
                    <b>{workshop?.title || id}</b>
                    {/* A course with no public mirror has no title to show.
                        Saying so beats an empty card: the shelf still
                        opens, and the student can tell the office which
                        one looks wrong. */}
                    <em>{workshop ? formatDateRange(workshop) : `Course ${id}`}</em>
                    <span className="mono-id">{ticketId}</span>
                  </span>
                  <span className="course-go" aria-hidden="true"><IconArrow /></span>
                </Link>
              ))}
            </div>
          )}

          <form className="panel mt-7" onSubmit={claim} data-reveal style={{ maxWidth: 640 }}>
            <span className="kick">Add a course</span>
            <p className="t-base mt-3">
              Both are printed on your ticket. The course code is the short code at
              the top; the ticket ID is the longer one underneath it.
            </p>

            <label htmlFor="claim-course" className="f-label mt-5">Course code *</label>
            <input
              id="claim-course"
              className="f-input f-code"
              value={workshopId}
              onChange={(e) => setWorkshopId(e.target.value)}
              placeholder="AIHOW26"
              required
            />

            <label htmlFor="claim-ticket" className="f-label mt-5">Your ticket ID *</label>
            <input
              id="claim-ticket"
              className="f-input f-code"
              value={ticket}
              onChange={(e) => setTicket(e.target.value)}
              placeholder="AIHOW26-014"
              required
            />

            {error && <p className="f-wrong" role="alert">{error}</p>}
            {note && <p className="t-sm mt-3" style={{ color: 'var(--lime-ink)' }} role="status">{note}</p>}

            <button className="btn mt-5" type="submit" disabled={busy || !ticket.trim() || !workshopId.trim()}>
              {busy ? 'Adding…' : 'Add this course'}
            </button>
          </form>
        </div>
      </section>
    </>
  );
}

/**
 * Why a claim failed, said usefully.
 *
 * `permission-denied` covers three completely different situations here and
 * a student can act on two of them, so it is worth unpicking rather than
 * printing the code. The rules cannot tell us which, so this says what is
 * true of all of them and names the likely one first.
 */
function claimError(err) {
  const code = String(err?.code || '');
  if (code.includes('permission-denied')) {
    return 'That ticket was not recognised for that course. Check the course code and '
      + 'the ticket ID against your ticket. If both are right, the office may not have '
      + 'published this course yet — give them a call.';
  }
  return err?.message || 'That did not work. Try again in a moment.';
}
