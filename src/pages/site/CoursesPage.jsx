import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listCourseDirectory } from '../../lib/publicdb.js';
import { formatDateRange } from '../../lib/tickets.js';
import { ISSUER } from '../../lib/schema.js';
import { IconArrow, IconSearch, IconBook } from '../../components/site/Icons.jsx';

/**
 * Every course, and the code you need to type.
 *
 * ── WHAT THIS PAGE IS FOR ────────────────────────────────────────────────
 *
 * The student dashboard asks for a course code and a ticket ID. A student
 * who has lost their ticket knows neither, and until this page existed
 * there was nowhere to look one up: the public mirror is readable one
 * document at a time BY ID, which is no help when the ID is the thing you
 * are missing.
 *
 * So the CODE is the loudest thing on every row. Not the title — a student
 * knows what their course was called; what they cannot remember is
 * `AIHOW26`. It is set in monospace and it can be copied in one tap,
 * because the next thing they do is paste it into a box.
 */
export default function CoursesPage() {
  const [courses, setCourses] = useState(null);      // null = not looked yet
  const [q, setQ] = useState('');
  const [copied, setCopied] = useState('');

  useEffect(() => {
    let live = true;
    listCourseDirectory()
      .then((rows) => { if (live) setCourses(rows); })
      .catch(() => { if (live) setCourses([]); });
    return () => { live = false; };
  }, []);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle || !courses) return courses || [];
    return courses.filter((c) => [c.title, c.code, c.id, c.venue]
      .some((v) => String(v || '').toLowerCase().includes(needle)));
  }, [courses, q]);

  const copy = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(''), 1800);
    } catch {
      /* A browser that refuses the clipboard still shows the code, which
         is the thing that matters. Nothing is said, because nothing broke
         for the reader — they can select it. */
    }
  };

  return (
    <>
      <section className="band hero quiet tight" data-tone="light">
        <div className="wrap">
          <div className="hero-mid" data-reveal>
            <span className="ann flat"><b>Courses</b> {ISSUER.operator}</span>
            <h1 className="display-lead">Every course, and its <em>code</em></h1>
            <p className="lede">
              The code is what you type on <b>Your courses</b> to add a course to
              your account, alongside the ticket ID from your ticket.
            </p>
            <div className="acts">
              <Link className="btn" to="/study">Your courses <IconArrow /></Link>
            </div>
          </div>
        </div>
      </section>

      <section className="band paper" data-tone="light">
        <div className="wrap">
          <label className="finder" htmlFor="course-find">
            <IconSearch />
            <input
              id="course-find"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, code or place"
              aria-label="Search courses"
            />
          </label>

          {courses === null && <p className="lede mt-5">Looking…</p>}

          {courses?.length === 0 && (
            <div className="panel mt-5" data-reveal>
              <p className="t-base">
                No course has been published yet. If you took one and need its
                code, ring the office on{' '}
                <a href={`tel:${ISSUER.phones[0].replace(/\s/g, '')}`}>{ISSUER.phones[0]}</a>.
              </p>
            </div>
          )}

          {courses?.length > 0 && shown.length === 0 && (
            <div className="panel mt-5">
              <p className="t-base">Nothing matches &ldquo;{q.trim()}&rdquo;.</p>
            </div>
          )}

          {shown.length > 0 && (
            <ul className="cdir mt-5">
              {shown.map((c) => (
                <li className="cdir-row" key={c.id} data-reveal>
                  <span className="cdir-ico" aria-hidden="true"><IconBook /></span>

                  <span className="cdir-what">
                    <b>{c.title}</b>
                    <em>
                      {[formatDateRange(c), c.mode, c.venue].filter(Boolean).join(' · ')}
                    </em>
                  </span>

                  {/* The code is the reason anybody is on this page. */}
                  <button
                    type="button"
                    className="cdir-code"
                    onClick={() => copy(c.id)}
                    title="Copy this code"
                  >
                    <span className="cdir-code-label">Course code</span>
                    <span className="cdir-code-id">{c.id}</span>
                    <span className="cdir-code-hint">{copied === c.id ? 'Copied' : 'Tap to copy'}</span>
                  </button>

                  <span className="cdir-go">
                    {c.registrationOpen && (
                      <Link className="btn sm" to={`/register/${c.id}`}>Register</Link>
                    )}
                    {c.classOpen && (
                      <Link className="btn sm ghost" to={`/class/${c.id}`}>Join the class</Link>
                    )}
                    {c.libraryOpen && !c.classOpen && !c.registrationOpen && (
                      <Link className="btn sm ghost" to={`/study/${c.id}`}>Watch it</Link>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <p className="t-sm mt-6" style={{ color: 'var(--ink-faint)' }}>
            Took a course that is not here? Ring the office on{' '}
            <a href={`tel:${ISSUER.phones[0].replace(/\s/g, '')}`}>{ISSUER.phones[0]}</a>{' '}
            and they will give you the code.
          </p>
        </div>
      </section>
    </>
  );
}
