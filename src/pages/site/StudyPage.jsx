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
  const {
    user, loading, loginStudentWithGoogle, signUpStudent, signInStudent,
    resetPassword, redirectError, logout,
  } = useAuth();

  const [courses, setCourses] = useState(null);   // null = not looked yet
  const [ticket, setTicket] = useState('');
  const [workshopId, setWorkshopId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  /* The door. `mode` is which of the two the card is showing — with an email
     and a password those are genuinely different acts, and a single form
     that guesses gets one of them wrong. */
  const [mode, setMode] = useState('in');       // 'in' | 'up'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [doorError, setDoorError] = useState('');
  const [doorNote, setDoorNote] = useState('');
  const [doorBusy, setDoorBusy] = useState(false);

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

  /* A redirect sign-in finishes on a LATER page load than the one that
     started it, so its failure has no handler to land in. Without this the
     student is simply returned to a signed-out page with nothing said. */
  useEffect(() => {
    if (redirectError) setDoorError(authMessage(redirectError));
  }, [redirectError]);

  useEffect(() => {
    if (!user) { setCourses(null); return; }
    load(user.uid).catch(() => setCourses([]));
  }, [user, load]);

  const signIn = async () => {
    setDoorError('');
    try { await loginStudentWithGoogle(); }
    catch (e) {
      // A window the person closed themselves is not an error worth showing.
      if (e?.code === 'auth/popup-closed-by-user') return;
      setDoorError(authMessage(e));
    }
  };

  const withEmail = async (e) => {
    e.preventDefault();
    setDoorError(''); setDoorNote('');
    if (password.length < 6) {
      setDoorError('A password needs at least six characters.');
      return;
    }
    setDoorBusy(true);
    try {
      if (mode === 'up') await signUpStudent(email, password, fullName);
      else await signInStudent(email, password);
    } catch (err) {
      setDoorError(authMessage(err));
    } finally {
      setDoorBusy(false);
    }
  };

  const forgot = async () => {
    setDoorError(''); setDoorNote('');
    if (!email.trim()) { setDoorError('Type your email address first.'); return; }
    try {
      await resetPassword(email);
      setDoorNote('If that address has an account, a reset link is on its way to it.');
    } catch (err) {
      setDoorError(authMessage(err));
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
                Make an account, then add the ticket ID printed on your ticket.
              </p>
            </div>
          </div>
        </section>

        <section className="band paper tight" data-tone="light">
          <div className="wrap door">
            <div className="panel" data-reveal>
              {/* Two acts, named. With an email and a password, "sign in" and
                  "create an account" are genuinely different, and a single
                  form that guesses which one you meant gets it wrong for
                  everybody who has not been here before. */}
              <div className="seg" role="tablist" aria-label="Sign in or create an account">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'in'}
                  className={mode === 'in' ? 'on' : undefined}
                  onClick={() => { setMode('in'); setDoorError(''); setDoorNote(''); }}
                >
                  I have an account
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'up'}
                  className={mode === 'up' ? 'on' : undefined}
                  onClick={() => { setMode('up'); setDoorError(''); setDoorNote(''); }}
                >
                  Create an account
                </button>
              </div>

              <button className="btn wide mt-5" type="button" onClick={signIn}>
                Continue with Google <IconArrow />
              </button>
              <p className="t-xs mt-2" style={{ color: 'var(--ink-faint)' }}>
                Works for signing in and for making an account — Google does both.
              </p>

              <div className="or"><span>or use an email address</span></div>

              <form onSubmit={withEmail}>
                {mode === 'up' && (
                  <>
                    <label htmlFor="door-name" className="f-label">Your full name *</label>
                    <input
                      id="door-name"
                      className="f-input"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="As it is on your ticket"
                      autoComplete="name"
                      required
                    />
                  </>
                )}

                <label htmlFor="door-email" className={`f-label${mode === 'up' ? ' mt-5' : ''}`}>
                  Email address *
                </label>
                <input
                  id="door-email"
                  className="f-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />

                <label htmlFor="door-password" className="f-label mt-5">Password *</label>
                <input
                  id="door-password"
                  className="f-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
                  minLength={6}
                  required
                />
                <span className="f-hint">
                  {mode === 'up' ? 'At least six characters.' : ''}
                </span>

                {doorError && <p className="f-wrong" role="alert">{doorError}</p>}
                {doorNote && (
                  <p className="t-sm mt-3" style={{ color: 'var(--lime-ink)' }} role="status">
                    {doorNote}
                  </p>
                )}

                <button className="btn wide mt-5" type="submit" disabled={doorBusy}>
                  {doorBusy
                    ? 'One moment…'
                    : mode === 'up' ? 'Create my account' : 'Sign in'}
                </button>

                {mode === 'in' && (
                  <p className="t-sm mt-4" style={{ color: 'var(--ink-faint)' }}>
                    Forgotten it?{' '}
                    <button type="button" className="linkish" onClick={forgot}>
                      Email me a reset link
                    </button>
                  </p>
                )}
              </form>
            </div>

            <div className="panel" data-reveal>
              <span className="kick"><IconShield /> What an account does</span>
              <p className="t-base mt-3">
                It identifies you, and nothing more. It gives this account no access
                to anybody&rsquo;s details, no course you did not take, and nothing
                at all until you add a ticket that belongs to you.
              </p>
              <p className="t-base mt-3">
                A ticket can be claimed <b>once</b>, so it stays yours. If somebody
                else has taken yours, the office can free it.
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

/**
 * What went wrong, in words a student can act on.
 *
 * Firebase codes are precise and useless to a reader: `auth/invalid-credential`
 * covers a wrong password AND an address with no account, and the SDK will
 * not say which — deliberately, so the form cannot be used to find out who
 * has an account here. So that one names both possibilities rather than
 * guessing at the likelier.
 *
 * The three that matter most on this audience's phones are the popup ones.
 * A link opened from WhatsApp runs in WhatsApp's own browser, where Google
 * refuses OAuth outright; the app sends those round by redirect instead, and
 * what is left here is the case where even that could not start.
 */
function authMessage(err) {
  const code = String(err?.code || '');
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'That email and password do not match an account. Check the password, '
        + 'or use "Create an account" if you have not made one yet.';
    case 'auth/email-already-in-use':
      return 'There is already an account with that email. Use "I have an account" '
        + 'to sign in, or ask for a reset link if you have forgotten the password.';
    case 'auth/weak-password':
      return 'That password is too short. Six characters or more.';
    case 'auth/invalid-email':
      return 'That does not look like an email address.';
    case 'auth/too-many-requests':
      return 'Too many attempts from this device. Wait a few minutes and try again.';
    case 'auth/network-request-failed':
      return 'No connection reached us. Check the network and try again.';
    case 'auth/operation-not-allowed':
      return 'Accounts are not switched on for this site yet. Tell the office — '
        + 'it is one setting at their end, not anything you have done.';
    case 'auth/unauthorized-domain':
      return 'This address is not one the sign-in is set up for. Tell the office — '
        + 'it is a setting at their end.';
    case 'auth/popup-blocked':
    case 'auth/operation-not-supported-in-this-environment':
      return 'Your browser would not open the Google window. Open this page in '
        + 'Chrome or Safari rather than inside another app, or use an email '
        + 'address and password below.';
    case 'auth/account-exists-with-different-credential':
      return 'That email already has an account made a different way. Sign in with '
        + 'an email and password instead.';
    default:
      return err?.message || 'That did not work. Try again in a moment.';
  }
}
