import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../AuthContext.jsx';
import { getPublicWorkshop } from '../../lib/publicdb.js';
import { getMembership } from '../../lib/studentdb.js';
import { listLibrary, libraryFileUrl } from '../../lib/librarydb.js';
import {
  libraryByDay, libraryCounts, libraryFormat, formatBytes,
} from '../../lib/library.js';
import { formatDate, formatDateRange } from '../../lib/tickets.js';
import { IconArrow } from '../../components/site/Icons.jsx';

/**
 * One course's shelf, as a student sees it.
 *
 * Grouped by day and earliest first, because a course is a sequence and
 * somebody catching up starts at the beginning. Within a day the recording
 * comes before its notes: the recording is what was missed, the notes are
 * what support it.
 */
export default function StudyCoursePage() {
  const { workshopId } = useParams();
  const { user, loading } = useAuth();

  const [state, setState] = useState('looking'); // looking | ok | denied | error
  const [workshop, setWorkshop] = useState(null);
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (loading) return undefined;
    if (!user) { setState('denied'); return undefined; }

    let live = true;
    (async () => {
      const [ws, member] = await Promise.all([
        getPublicWorkshop(workshopId).catch(() => null),
        getMembership(workshopId, user.uid),
      ]);
      if (!live) return;
      setWorkshop(ws);

      if (!member) { setState('denied'); return; }
      try {
        const shelf = await listLibrary(workshopId);
        if (!live) return;
        setItems(shelf);
        setState('ok');
      } catch {
        // The membership document said yes and the database said no. That
        // is a revocation between the two reads, or rules not yet deployed.
        if (live) setState('denied');
      }
    })();
    return () => { live = false; };
  }, [workshopId, user, loading]);

  if (loading || state === 'looking') {
    return (
      <section className="band hero quiet tight" data-tone="light">
        <div className="wrap"><p className="lede">Opening…</p></div>
      </section>
    );
  }

  if (state === 'denied') {
    return (
      <section className="band hero quiet tight" data-tone="light">
        <div className="wrap">
          <div className="hero-mid" data-reveal>
            <h1 className="display-lead sm">Not open to this account</h1>
            <p className="lede">
              {user
                ? 'This account has not claimed a ticket for this course, or its access was withdrawn.'
                : 'Sign in to open your courses.'}
            </p>
            <div className="acts">
              <Link className="btn" to="/study">Your courses <IconArrow /></Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const days = libraryByDay(items);
  const counts = libraryCounts(items);

  return (
    <>
      <section className="band hero quiet tight" data-tone="light">
        <div className="wrap">
          <div className="hero-mid" data-reveal>
            <nav className="crumbs">
              <Link to="/study">Your courses</Link>
              <span aria-hidden="true">/</span>
              <span>{workshop?.title || workshopId}</span>
            </nav>
            <h1 className="display-lead sm">{workshop?.title || workshopId}</h1>
            {workshop && formatDateRange(workshop) && (
              <p className="lede">{formatDateRange(workshop)}</p>
            )}
            <p className="t-sm" style={{ color: 'var(--ink-faint)' }}>
              {counts.total === 0
                ? 'Nothing has been put here yet.'
                : `${counts.recording} recording${counts.recording === 1 ? '' : 's'} · `
                  + `${counts.notes} note${counts.notes === 1 ? '' : 's'} and handout${counts.notes === 1 ? '' : 's'}`}
            </p>
          </div>
        </div>
      </section>

      <section className="band paper" data-tone="light">
        <div className="wrap">
          {counts.total === 0 && (
            <div className="panel" data-reveal>
              <p className="t-base">
                Your place on this course is recorded. Nothing has been added to the
                library yet — recordings usually appear a day or two after the class.
              </p>
            </div>
          )}

          {days.map(({ day, items: dayItems }, i) => (
            <div key={day || 'course'} className={i === 0 ? '' : 'mt-7'} data-reveal>
              <h2 className="t-md" style={{ fontWeight: 700 }}>
                {day ? formatDate(day) : 'For the whole course'}
              </h2>
              <ul className="shelf mt-3">
                {dayItems.map((item) => <ShelfItem key={item.id} item={item} />)}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

/**
 * One thing on the shelf.
 *
 * A file's URL is fetched at the moment somebody asks for it, never stored:
 * a Storage download URL carries a token, and putting one in the database
 * would hand every reader a link that outlives their membership. The cost is
 * one click that has to wait — so it says so rather than appearing dead.
 */
function ShelfItem({ item }) {
  const [opening, setOpening] = useState(false);
  const [failed, setFailed] = useState('');
  /* Written notes are already here, so they open in place. Sending somebody
     to another page for two paragraphs that are in the document they are
     looking at would be a download dressed up as a link. */
  const [shown, setShown] = useState(false);
  const format = libraryFormat(item.format);
  const size = formatBytes(item.bytes);
  /* An unknown format is the normal case for a Drive link — Drive will not
     say what is behind one without an API call. The KIND is not a guess
     though: the office said what this is. So an unidentified recording
     still gets the recording's mark, and the meta line simply does not
     claim a format, rather than printing "Recording · Link", which is a
     word that tells the reader nothing they cannot see from the arrow. */
  const unknown = format.key === 'link';
  const glyph = unknown && item.kind === 'recording' ? '▶' : format.icon;

  const open = async (e) => {
    if (item.source === 'text') { e.preventDefault(); setShown((o) => !o); return; }
    if (item.source !== 'file') return;          // a link opens by itself
    e.preventDefault();
    setOpening(true); setFailed('');
    try {
      const url = await libraryFileUrl(item);
      // Opened rather than navigated to, so the student keeps the shelf.
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      setFailed('That file could not be opened. Tell the office it is missing.');
    } finally {
      setOpening(false);
    }
  };

  return (
    <li className="shelf-row" data-kind={item.kind}>
      <a
        className="shelf-link"
        href={item.source === 'link' ? item.url : '#'}
        target={item.source === 'link' ? '_blank' : undefined}
        rel={item.source === 'link' ? 'noopener noreferrer' : undefined}
        onClick={open}
        aria-busy={opening || undefined}
        aria-expanded={item.source === 'text' ? shown : undefined}
      >
        <span className="shelf-ico" aria-hidden="true">{glyph}</span>
        <span className="shelf-what">
          <b>{item.title}</b>
          <small>
            {[
              item.kind === 'recording' ? 'Recording' : 'Notes',
              unknown ? '' : format.label,
              size,
              item.source === 'link' ? 'opens elsewhere' : '',
              item.source === 'text' ? (shown ? 'tap to close' : 'tap to read') : '',
            ].filter(Boolean).join(' · ')}
          </small>
          {failed && <em className="shelf-wrong">{failed}</em>}
        </span>
        <span className="shelf-go" aria-hidden="true">
          {opening ? '…' : item.source === 'text' ? (shown ? '−' : '+') : '↗'}
        </span>
      </a>
      {item.source === 'text' && shown && (
        <div className="shelf-text">{item.text}</div>
      )}
    </li>
  );
}
