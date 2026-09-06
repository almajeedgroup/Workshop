import { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { buildIndex, search, workshopFacts, requestFacts, MIN_QUERY } from '../lib/search.js';
import { groupPeople, courseCount, RETURNING_AT } from '../lib/people.js';
import { formatDateRange } from '../lib/tickets.js';
import TicketDocument from './TicketDocument.jsx';
import Overlay from './Overlay.jsx';

/**
 * One box that finds anybody.
 *
 * The question that comes over the phone is not organised by workshop —
 * "Adifaah says she registered", "who is AIHOW26-014", a WhatsApp number
 * with no name attached — and answering it meant opening courses one at a
 * time until she turned up.
 *
 * Choosing a result opens it OVER the page rather than navigating to it, for
 * the same reason the board's tickets do: you are usually looking somebody up
 * in the middle of doing something else, and coming back to find your filters
 * cleared and your groups collapsed is its own small tax.
 *
 * Built as the ARIA combobox pattern rather than a div with a click handler,
 * so it works from the keyboard the way every other search box in the world
 * does: type, arrow down, Enter.
 */
export default function Finder({ bundles = [], requests = [], placeholder }) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [chosen, setChosen] = useState(null);
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const input = useRef(null);
  const listId = useId();

  // Rebuilt only when the data behind it changes, not on every keystroke.
  const index = useMemo(() => buildIndex(bundles, requests), [bundles, requests]);
  // So a result can offer a profile when the person turns out to be on more
  // than one course. Looking that up from the ticket is how you find out
  // they have been here before.
  const people = useMemo(() => groupPeople(bundles), [bundles]);
  const { rows, total, short } = useMemo(() => search(index, q), [index, q]);

  useEffect(() => setActive(0), [q]);

  // A slash focuses the box, as it does on most things people search all day
  // — but not while they are typing into something else.
  useEffect(() => {
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName)
        || e.target?.isContentEditable;
      const shortcut = e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k');
      if (!shortcut || typing) return;
      e.preventDefault();
      input.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Clicking away closes the list but keeps what was typed — the query is
  // often still wanted after glancing at something else on the page.
  useEffect(() => {
    const onDown = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const choose = (item) => {
    setChosen(item);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      if (open) setOpen(false);
      else setQ('');
      return;
    }
    if (!rows.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % rows.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i - 1 + rows.length) % rows.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(rows[active] || rows[0]);
    }
  };

  const showList = open && q.trim().length >= MIN_QUERY;

  return (
    <div className="finder no-print" ref={box}>
      <div className="finder-box">
        <input
          ref={input}
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && rows.length ? `${listId}-${active}` : undefined}
          aria-label="Search everyone and every course"
          placeholder={placeholder || 'Search a name, ticket, number, area…'}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {q && (
          <button type="button" className="finder-clear" onClick={() => { setQ(''); input.current?.focus(); }}>
            Clear
          </button>
        )}
      </div>

      {showList && (
        <div className="finder-drop">
          <ul className="finder-list" role="listbox" id={listId} aria-label="Search results">
            {rows.map((item, i) => (
              <li
                key={item.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className={`f-row f-${item.kind}${i === active ? ' is-active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => { e.preventDefault(); choose(item); }}
              >
                <span className="f-kind">{item.kind}</span>
                <span className="f-label">{item.label}</span>
                <span className="f-sub">{item.subtitle}</span>
              </li>
            ))}
          </ul>
          <p className="finder-foot">
            {rows.length === 0
              ? `Nothing matches “${q.trim()}”.`
              : total > rows.length
                ? `${rows.length} of ${total} matches — narrow it down to see the rest.`
                : `${total} ${total === 1 ? 'match' : 'matches'}. ↑↓ to move, Enter to open.`}
          </p>
        </div>
      )}

      {chosen && <FinderDetail item={chosen} people={people} onClose={() => setChosen(null)} />}
    </div>
  );
}

/** What opens when a result is chosen. One overlay, three kinds of content. */
function FinderDetail({ item, people = [], onClose }) {
  if (item.kind === 'person') {
    const { workshop, reg } = item;
    const profile = people.find((p) =>
      p.courses.some((c) => c.reg.id === reg.id && c.workshop.id === workshop.id));
    const returning = profile && courseCount(profile) >= RETURNING_AT;
    return (
      <Overlay
        title={`${reg.name || 'Registration'} — ${reg.ticketId || 'no ticket'}`}
        onClose={onClose}
        wide
        actions={(
          <>
            <button type="button" onClick={() => window.print()}>Print / PDF</button>
            {returning && (
              <Link className="btn primary" to={`/people/${profile.id}`}>
                {courseCount(profile)} courses
              </Link>
            )}
            <Link className="btn" to={`/w/${workshop.id}/t/${reg.id}`}>Open full page</Link>
            <Link className="btn" to={`/w/${workshop.id}`}>The course</Link>
          </>
        )}
      >
        <TicketDocument workshop={workshop} reg={reg} />
      </Overlay>
    );
  }

  if (item.kind === 'request') {
    const { workshop, request } = item;
    return (
      <Overlay
        title={`${request.name || 'Request'} — ${request.ref || ''}`}
        onClose={onClose}
        actions={workshop
          ? <Link className="btn" to={`/w/${workshop.id}`}>Review on the course</Link>
          : null}
      >
        <p className="hint">
          A self-registration, not yet a registration. It is accepted or
          rejected on the course it was sent to.
        </p>
        <dl className="kv">
          {/* dt and dd must be DIRECT children — `.kv` is a two-column grid
              and a wrapper div would put both in one cell. */}
          {requestFacts(request).map(([k, v]) => (
            <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>
          ))}
        </dl>
      </Overlay>
    );
  }

  const { workshop, registrations } = item;
  return (
    <Overlay
      title={workshop.title || '(untitled)'}
      onClose={onClose}
      actions={(
        <>
          <Link className="btn" to={`/w/${workshop.id}/attendance`}>Attendance</Link>
          <Link className="btn primary" to={`/w/${workshop.id}`}>Open the course</Link>
        </>
      )}
    >
      <p className="count">{formatDateRange(workshop) || 'no dates recorded'}</p>
      <dl className="kv">
        {workshopFacts(item).map(([k, v]) => (
          <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>
        ))}
      </dl>
      {registrations.length > 0 && (
        <>
          <h3 style={{ marginTop: 16 }}>Registered</h3>
          <ul className="finder-people">
            {registrations.slice(0, 12).map((r) => (
              <li key={r.id}>
                <span>{r.name}</span>
                <span className="f-sub">{r.ticketId}</span>
              </li>
            ))}
          </ul>
          {registrations.length > 12 && (
            <p className="hint">and {registrations.length - 12} more on the course page.</p>
          )}
        </>
      )}
    </Overlay>
  );
}
