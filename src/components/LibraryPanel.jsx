import { useRef, useState } from 'react';
import { courseDays } from '../lib/attendance.js';
import { formatDate } from '../lib/tickets.js';
import {
  libraryByDay, libraryCounts, libraryFormat, formatBytes,
  MAX_FILE_BYTES, LIBRARY_KINDS, tidyShareLink,
} from '../lib/library.js';
import {
  addLibraryLink, uploadLibraryFile, removeLibraryItem, setLibraryAccess,
} from '../lib/librarydb.js';
import { canStoreFiles } from '../firebase.js';

/**
 * The course library, from the office's side.
 *
 * Two ways to put something on the shelf, and the panel does not pretend
 * they are the same:
 *
 *   a LINK costs nothing, and breaks silently the day somebody moves the
 *   Drive folder or changes who may open it;
 *   a FILE costs storage, and cannot be taken away from the course by
 *   anybody outside this app.
 *
 * Both are legitimate and the choice is the office's, so the form asks
 * rather than guessing — and says what each one means, because "Drive link"
 * and "upload" look interchangeable until a student cannot open one.
 */
export default function LibraryPanel({ workshop, items, onChanged, onWorkshop }) {
  const [source, setSource] = useState('link');
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('recording');
  const [day, setDay] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(-1);      // -1 = not uploading
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  /* Removing is not undoable — a stored file is deleted from the bucket, not
     hidden — and six one-tap red buttons down a list is how somebody deletes
     a recording they meant to rename. Same two-step the requests panel uses:
     the row asks before it acts, and nothing shouts until it is about to. */
  const [confirmingId, setConfirmingId] = useState('');
  const [openBusy, setOpenBusy] = useState(false);
  const [openConfirm, setOpenConfirm] = useState(false);
  const fileInput = useRef(null);

  const days = courseDays(workshop);
  const counts = libraryCounts(items);
  const groups = libraryByDay(items);

  // A file store that was never switched on fails deep inside the SDK with a
  // CORS error that names nothing. Say so up front instead.
  const canUpload = canStoreFiles;

  /* No effect snapping `source` back to 'link' when there is no bucket. One
     used to, and it made the Upload button look broken: it flipped the
     choice back before the sentence explaining why could render, so the
     click did nothing and said nothing. The choice is allowed; it is the
     SAVE that is not. */

  const reset = () => {
    setTitle(''); setUrl(''); setFile(null); setProgress(-1);
    if (fileInput.current) fileInput.current.value = '';
  };

  const add = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (source === 'link') {
        if (!url.trim()) { setError('Paste the link first.'); return; }
        if (!/^https?:\/\//i.test(url.trim())) {
          setError('That is not a link. It has to start with https://');
          return;
        }
        setProgress(0);
        await addLibraryLink(workshop.id, { title, kind, day, url: url.trim() });
      } else {
        if (!file) { setError('Choose a file first.'); return; }
        if (file.size > MAX_FILE_BYTES) {
          setError(`That file is ${formatBytes(file.size)}. The limit is `
            + `${formatBytes(MAX_FILE_BYTES)} — share it as a Drive link instead.`);
          return;
        }
        setProgress(0);
        await uploadLibraryFile(workshop.id, file, { title, kind, day }, setProgress);
      }
      reset();
      await onChanged?.();
    } catch (err) {
      setError(err?.message || 'That did not go up. Try again.');
      setProgress(-1);
    }
  };

  const remove = async (item) => {
    setConfirmingId('');
    setBusyId(item.id);
    try {
      await removeLibraryItem(workshop.id, item);
      await onChanged?.();
    } catch (err) {
      setError(err?.message || 'That could not be removed.');
    } finally {
      setBusyId('');
    }
  };

  const uploading = progress >= 0 && source === 'file';
  const isOpen = String(workshop.libraryAccess || '') === 'Open';

  /* Opening a library gives it away to anybody who makes an account, and
     that cannot be undone for whoever already took a copy — so it asks,
     and closing again does not. */
  const setOpen = async (open) => {
    setOpenBusy(true); setError('');
    try {
      const next = await setLibraryAccess(workshop.id, workshop, open);
      setOpenConfirm(false);
      onWorkshop?.(next);
      await onChanged?.();
    } catch (e) {
      setError(e?.message || 'That could not be changed.');
    } finally {
      setOpenBusy(false);
    }
  };
  /* Shown before saving rather than after, so the office sees the address a
     student will get while they can still object to it. */
  const cleaned = tidyShareLink(url);
  const tidied = url.trim() && cleaned !== url.trim() ? cleaned : '';

  return (
    <div className="panel no-print">
      <div className="page-head" style={{ border: 0, paddingBottom: 0, marginBottom: 12 }}>
        <h2>Library</h2>
        <span className="count">
          {counts.total === 0
            ? 'nothing yet'
            : `${counts.recording} recording${counts.recording === 1 ? '' : 's'}, `
              + `${counts.notes} note${counts.notes === 1 ? '' : 's'}`}
        </span>
      </div>

      <p className="hint">
        What students can open after the course, from <b>Your courses</b> on the
        public site.
      </p>

      {/* WHO IT IS FOR, stated before what is on it. This is the setting that
          decides whether a recording is for the people who paid for the
          course or for anybody at all, and it belongs above the shelf rather
          than buried under it. */}
      <div className={`notice mt-3${isOpen ? ' open-lib' : ''}`}>
        <b>{isOpen ? 'Open to anyone with an account.' : 'Only for students with a ticket.'}</b>{' '}
        {isOpen
          ? 'Anybody who signs up on the public site can open this course\u2019s '
            + 'recordings and notes, whether or not they took it.'
          : 'A student has to claim a ticket this course issued. Nobody else can see any of it.'}

        <div className="btn-row mt-3">
          {isOpen ? (
            <button type="button" disabled={openBusy} onClick={() => setOpen(false)}>
              {openBusy ? '\u2026' : 'Close it to ticket holders'}
            </button>
          ) : openConfirm ? (
            <>
              <button
                className="small danger"
                type="button"
                disabled={openBusy}
                onClick={() => setOpen(true)}
              >
                {openBusy ? '\u2026' : 'Yes, open it to everyone'}
              </button>
              <button className="small" type="button" onClick={() => setOpenConfirm(false)}>
                Keep it private
              </button>
              <span className="hint" style={{ marginLeft: 4 }}>
                Closing it later does not take back what anybody has already downloaded.
              </span>
            </>
          ) : (
            <button type="button" onClick={() => setOpenConfirm(true)}>
              Open it to everyone
            </button>
          )}
        </div>
      </div>

      {/* ---------------- add ---------------- */}
      <form onSubmit={add} className="mt-4">
        <div className="btn-row">
          <button
            type="button"
            className={source === 'link' ? 'primary' : undefined}
            aria-pressed={source === 'link'}
            onClick={() => { setSource('link'); setError(''); }}
          >
            Paste a link
          </button>
          <button
            type="button"
            className={source === 'file' ? 'primary' : undefined}
            aria-pressed={source === 'file'}
            onClick={() => { setSource('file'); setError(''); }}
            title={canUpload ? undefined : 'Needs a Storage bucket, which needs a paid plan.'}
          >
            Upload a file
          </button>
          <span className="hint" style={{ marginLeft: 4 }}>
            {source === 'link'
              ? 'Free. Stops working if the file moves or its sharing changes.'
              : canUpload
                ? `Kept here for good. Up to ${formatBytes(MAX_FILE_BYTES)} each.`
                : 'Not available on this plan.'}
          </span>
        </div>

        {/* A project on the free plan has no bucket, and that is a
            decision rather than a fault — so this states how the library
            works here instead of reading like something is broken. */}
        {!canUpload && source === 'file' && (
          <div className="notice mt-3">
            This project keeps its library as links. Uploading files needs a
            Firebase Storage bucket, which needs a paid plan — everything else
            about the library works exactly the same either way.
          </div>
        )}

        <div className="grid2 mt-3">
          <div className="field">
            <div className="lab"><label htmlFor="lib-title">Title</label></div>
            <input
              id="lib-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={source === 'file' ? 'Left blank, the file name is used' : 'Day one — what a model is'}
            />
          </div>

          <div className="field">
            <div className="lab"><label htmlFor="lib-kind">What is it</label></div>
            <select id="lib-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
              {LIBRARY_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
            </select>
          </div>

          <div className="field">
            <div className="lab"><label htmlFor="lib-day">Which day</label></div>
            <select id="lib-day" value={day} onChange={(e) => setDay(e.target.value)}>
              {/* Undated is a real answer, not a missing one: a course pack
                  belongs to the course rather than to any one session. */}
              <option value="">The whole course</option>
              {days.map((d) => <option key={d} value={d}>{formatDate(d)}</option>)}
            </select>
          </div>

          {source === 'link' ? (
            <div className="field">
              <div className="lab"><label htmlFor="lib-url">Link</label></div>
              <input
                id="lib-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://drive.google.com/…"
                inputMode="url"
                aria-describedby="lib-url-hint"
              />
              <span className="hint" id="lib-url-hint">
                In Drive: <b>Share → General access → Anyone with the link →
                Viewer</b>. Left on <b>Restricted</b>, students get a
                &ldquo;Request access&rdquo; page instead of the file — which is
                the one thing that goes wrong here.
              </span>
              {tidied && (
                <span className="hint" style={{ color: 'var(--lime-ink)' }}>
                  Will be saved as a read-only link: <code>{tidied}</code>
                </span>
              )}
            </div>
          ) : (
            <div className="field">
              <div className="lab"><label htmlFor="lib-file">File</label></div>
              <input
                id="lib-file"
                ref={fileInput}
                type="file"
                onChange={(e) => { setFile(e.target.files?.[0] || null); setError(''); }}
              />
            </div>
          )}
        </div>

        {error && <div className="notice warn mt-3">{error}</div>}

        {uploading && (
          <div className="mt-3">
            {/* A progress bar, because a 400 MB recording over an office
                connection takes minutes and an upload with no feedback gets
                cancelled by somebody who assumes it has hung. */}
            <div className="up-bar" aria-hidden="true">
              <i style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <span className="hint" role="status">
              Uploading {file?.name} — {Math.round(progress * 100)}%. Leave this page open.
            </span>
          </div>
        )}

        <div className="btn-row mt-3">
          <button
            className="primary"
            type="submit"
            disabled={uploading || (source === 'file' && !canUpload)}
          >
            {uploading ? 'Uploading…' : 'Add to the library'}
          </button>
        </div>
      </form>

      {/* ---------------- what is there ---------------- */}
      {counts.total > 0 && (
        <div className="mt-5">
          {groups.map(({ day: d, items: group }) => (
            <div key={d || 'course'} className="mt-4">
              <h3 className="t-sm" style={{ fontWeight: 700 }}>
                {d ? formatDate(d) : 'The whole course'}
              </h3>
              <div className="lib mt-2">
                {group.map((item) => {
                  const format = libraryFormat(item.format);
                  const size = formatBytes(item.bytes);
                  return (
                    <div className="lib-row" key={item.id} data-kind={item.kind}>
                      <span className="lib-ico" aria-hidden="true">
                        {format.key === 'link' && item.kind === 'recording' ? '▶' : format.icon}
                      </span>
                      <span className="lib-what">
                        <b>{item.title}</b>
                        <small>
                          {[
                            item.kind === 'recording' ? 'Recording' : 'Notes',
                            format.key === 'link' ? '' : format.label,
                            size,
                            item.source === 'link' ? 'link' : 'stored here',
                          ].filter(Boolean).join(' · ')}
                        </small>
                      </span>
                      {item.source === 'link' && (
                        <a className="lib-open" href={item.url} target="_blank" rel="noopener noreferrer">
                          Open
                        </a>
                      )}
                      {confirmingId === item.id ? (
                        <span className="actions">
                          <button
                            className="small danger"
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() => remove(item)}
                          >
                            {busyId === item.id ? '…'
                              : item.source === 'file' ? 'Delete the file' : 'Remove it'}
                          </button>
                          <button
                            className="small"
                            type="button"
                            onClick={() => setConfirmingId('')}
                          >
                            Keep
                          </button>
                        </span>
                      ) : (
                        <button
                          className="small"
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => setConfirmingId(item.id)}
                        >
                          {busyId === item.id ? '…' : 'Remove'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
