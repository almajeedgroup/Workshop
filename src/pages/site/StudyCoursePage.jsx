import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../AuthContext.jsx';
import { getPublicWorkshop } from '../../lib/publicdb.js';
import { getMembership } from '../../lib/studentdb.js';
import { listLibrary, libraryFileUrl } from '../../lib/librarydb.js';
import { getProgress, markOpened, setDone } from '../../lib/progressdb.js';
import {
  libraryByDay, libraryCounts, libraryFormat, formatBytes,
  embeddableUrl, viewerKind, libraryProgress, nextUp, sortLibrary,
} from '../../lib/library.js';
import { formatDate, formatDateRange } from '../../lib/tickets.js';
import { IconArrow, IconCheck } from '../../components/site/Icons.jsx';

/**
 * One course, as a place to actually study rather than a list of links.
 *
 * ── THE SHAPE, AND WHY ───────────────────────────────────────────────────
 *
 * The thing being watched fills the page, and the course contents sit
 * beside it. That is the shape every course platform has converged on, and
 * not by fashion: a list of links throws you into another tab for each
 * item, loses your place, and makes "what is next" a thing you have to go
 * back and work out. Here the next thing is always in view.
 *
 * WHAT IS NOT PROMISED. Most of this material lives on somebody else's
 * server, and most servers refuse to be framed — there is no way to ask
 * from a browser, and a refusal arrives as a blank box. So only hosts known
 * to allow it are framed, and everything else opens out, in a tab, saying
 * so beforehand. Opening out stays available on every item regardless,
 * because a frame that shows nothing is worse than a link that works.
 */
export default function StudyCoursePage() {
  const { workshopId } = useParams();
  const { user, loading } = useAuth();

  const [state, setState] = useState('looking');   // looking | ok | denied
  const [workshop, setWorkshop] = useState(null);
  const [openToAll, setOpenToAll] = useState(false);
  const [items, setItems] = useState([]);
  const [progress, setProgress] = useState({ done: {}, last: '' });
  const [current, setCurrent] = useState(null);

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

      /* Two ways to be allowed in: a ticket, or a course the office has
         opened to everybody. Asked of the same mirror the rules read, so
         the page and the server cannot disagree about who is welcome. */
      const anyone = ws?.libraryOpen === true;
      setOpenToAll(anyone);
      if (!member && !anyone) { setState('denied'); return; }

      let shelf;
      try {
        shelf = await listLibrary(workshopId);
      } catch {
        // The membership said yes and the database said no: a revocation
        // between the two reads, or rules not yet deployed.
        if (live) setState('denied');
        return;
      }
      if (!live) return;
      setItems(shelf);
      setState('ok');

      /* Progress is read SEPARATELY, and its failure is not a refusal.
         Bundling the two meant a student whose place could not be read was
         told they were not on the course — which is a far worse thing to be
         told, and untrue. Worst case they start from the beginning. */
      const seen = await getProgress(user.uid, workshopId).catch(() => ({ done: {}, last: '' }));
      if (!live) return;
      setProgress(seen);
      // Opens on where they stopped, which is the whole point of keeping it.
      setCurrent(nextUp(shelf, seen) || sortLibrary(shelf)[0] || null);
    })();
    return () => { live = false; };
  }, [workshopId, user, loading]);

  const open = useCallback((item) => {
    setCurrent(item);
    setProgress((p) => ({ ...p, last: item.id }));
    if (user) markOpened(user.uid, workshopId, item.id);
    // The viewer is above the list on a phone, and tapping a row down the
    // page would otherwise change something off-screen.
    document.getElementById('viewer')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [user, workshopId]);

  const tick = useCallback((item, value) => {
    setProgress((p) => {
      const done = { ...p.done };
      if (value) done[item.id] = true; else delete done[item.id];
      return { ...p, done };
    });
    if (user) setDone(user.uid, workshopId, item.id, value);
  }, [user, workshopId]);

  const days = useMemo(() => libraryByDay(items), [items]);
  const counts = useMemo(() => libraryCounts(items), [items]);
  const bar = useMemo(() => libraryProgress(items, progress.done), [items, progress.done]);
  const next = useMemo(() => nextUp(items, progress), [items, progress]);

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
                ? 'This account has not claimed a ticket for this course, and the '
                  + 'course is not one of the open ones. If you took it, add your '
                  + 'ticket ID on Your courses.'
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

  return (
    <section className="band paper study tight" data-tone="light">
      <div className="wrap">
        <nav className="crumbs">
          <Link to="/study">Your courses</Link>
          <span aria-hidden="true">/</span>
          <span>{workshop?.title || workshopId}</span>
        </nav>

        <header className="study-head">
          <div style={{ minWidth: 0 }}>
            <h1 className="t-display-sm">{workshop?.title || workshopId}</h1>
            <p className="t-sm" style={{ color: 'var(--ink-faint)', marginTop: 4 }}>
              {[
                workshop && formatDateRange(workshop),
                counts.total > 0 && `${counts.recording} recording${counts.recording === 1 ? '' : 's'}`,
                counts.total > 0 && `${counts.notes} note${counts.notes === 1 ? '' : 's'}`,
                openToAll && 'open to anyone signed in',
              ].filter(Boolean).join(' · ')}
            </p>
          </div>

          {counts.total > 0 && (
            <div className="study-progress">
              <div className="pbar" role="img"
                aria-label={`${bar.done} of ${bar.total} finished, ${bar.percent}%`}>
                <i style={{ width: `${bar.percent}%` }} />
              </div>
              <span className="t-xs">
                {bar.complete
                  ? 'Finished — every item ticked off'
                  : `${bar.done} of ${bar.total} done`}
              </span>
              {next && (
                <button className="btn sm" type="button" onClick={() => open(next)}>
                  {progress.last && next.id === progress.last ? 'Carry on' : 'Start the next one'}
                </button>
              )}
            </div>
          )}
        </header>

        {counts.total === 0 ? (
          <div className="panel mt-6">
            <p className="t-base">
              Your place on this course is recorded. Nothing has been added to the
              library yet — recordings usually appear a day or two after the class.
            </p>
          </div>
        ) : (
          <div className="study-grid mt-6">
            <div id="viewer" className="study-view">
              <Viewer item={current} onDone={() => current && tick(current, true)}
                done={!!(current && progress.done[current.id])} />
            </div>

            <aside className="study-list" aria-label="Course content">
              <h2 className="t-sm" style={{ fontWeight: 700 }}>Course content</h2>
              {days.map(({ day, items: group }) => (
                <div className="study-day" key={day || 'course'}>
                  <h3>{day ? formatDate(day) : 'For the whole course'}</h3>
                  <ul>
                    {group.map((item) => (
                      <Row
                        key={item.id}
                        item={item}
                        on={current?.id === item.id}
                        done={!!progress.done[item.id]}
                        onOpen={() => open(item)}
                        onTick={(v) => tick(item, v)}
                      />
                    ))}
                  </ul>
                </div>
              ))}
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * One row of the contents
 * ------------------------------------------------------------------ */

function Row({ item, on, done, onOpen, onTick }) {
  const format = libraryFormat(item.format);
  const unknown = format.key === 'link';
  const size = formatBytes(item.bytes);

  return (
    <li className={`srow${on ? ' on' : ''}${done ? ' done' : ''}`}>
      <button type="button" className="srow-open" onClick={onOpen} aria-current={on || undefined}>
        <span className="srow-ico" aria-hidden="true">
          {unknown && item.kind === 'recording' ? '▶' : format.icon}
        </span>
        <span className="srow-what">
          <b>{item.title}</b>
          <small>
            {[
              item.kind === 'recording' ? 'Recording' : 'Notes',
              unknown ? '' : format.label,
              size,
            ].filter(Boolean).join(' · ')}
          </small>
        </span>
      </button>
      {/* A tick the student sets themselves. Nothing measures whether a
          recording was really watched, and a bar that claimed to would be
          lying — this is a reading list, and they keep their own place. */}
      <label className="srow-tick">
        <input
          type="checkbox"
          checked={done}
          onChange={(e) => onTick(e.target.checked)}
          aria-label={`Mark "${item.title}" as done`}
        />
        <span aria-hidden="true"><IconCheck /></span>
      </label>
    </li>
  );
}

/* ------------------------------------------------------------------ *
 * The thing being looked at
 * ------------------------------------------------------------------ */

function Viewer({ item, done, onDone }) {
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState('');

  useEffect(() => {
    setUrl(''); setFailed('');
    if (!item) return undefined;
    if (item.source !== 'file') { setUrl(embeddableUrl(item) || item.url || ''); return undefined; }

    let live = true;
    libraryFileUrl(item)
      .then((u) => { if (live) setUrl(u); })
      .catch(() => { if (live) setFailed('That file could not be opened. Tell the office it is missing.'); });
    return () => { live = false; };
  }, [item]);

  if (!item) return <div className="empty">Choose something from the course content.</div>;

  const kind = viewerKind(item);
  const format = libraryFormat(item.format);

  return (
    <>
      <div className="study-stage" data-kind={kind}>
        {kind === 'text' && <div className="study-text">{item.text}</div>}

        {kind === 'video' && url && (
          <video className="study-media" src={url} controls preload="metadata" />
        )}
        {kind === 'audio' && url && (
          <audio className="study-audio" src={url} controls preload="metadata" />
        )}

        {kind === 'frame' && url && (
          <iframe
            className="study-frame"
            src={url}
            title={item.title}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            referrerPolicy="no-referrer"
          />
        )}

        {(kind === 'away' || kind === 'download') && (
          <div className="study-away">
            <span className="srow-ico lg" aria-hidden="true">{format.icon}</span>
            <p className="t-base">
              {kind === 'download'
                ? `${format.label} — this one opens on your own device.`
                : 'This one is kept somewhere that will not show inside a page.'}
            </p>
            {/* The way forward goes HERE, not only in the bar underneath. An
                empty rectangle with the button somewhere else reads as a
                thing that failed to load. */}
            {url && (
              <a className="btn" href={item.source === 'file' ? url : (item.url || url)}
                target="_blank" rel="noopener noreferrer">
                {kind === 'download' ? 'Download it' : 'Open it'} <IconArrow />
              </a>
            )}
          </div>
        )}

        {failed && <div className="study-away"><p className="t-base">{failed}</p></div>}
      </div>

      <div className="study-bar">
        <div style={{ minWidth: 0 }}>
          <b className="t-md">{item.title}</b>
          <span className="t-xs" style={{ display: 'block', color: 'var(--ink-faint)' }}>
            {item.kind === 'recording' ? 'Recording' : 'Notes'}
            {format.key === 'link' ? '' : ` · ${format.label}`}
          </span>
        </div>
        <div className="btn-row">
          {url && (
            <a className="btn sm ghost" href={item.source === 'file' ? url : (item.url || url)}
              target="_blank" rel="noopener noreferrer">
              Open in a new tab
            </a>
          )}
          <button className={`btn sm${done ? ' ghost' : ''}`} type="button" onClick={onDone}>
            {done ? 'Done ✓' : 'Mark as done'}
          </button>
        </div>
      </div>
    </>
  );
}
