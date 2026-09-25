import { useEffect, useRef, useState } from 'react';
import { courseDays } from '../lib/attendance.js';
import { formatDate } from '../lib/tickets.js';
import {
  libraryByDay, libraryCounts, libraryFormat, formatBytes,
  MAX_FILE_BYTES, LIBRARY_KINDS,
} from '../lib/library.js';
import { addLibraryLink, uploadLibraryFile, removeLibraryItem } from '../lib/librarydb.js';
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
export default function LibraryPanel({ workshop, items, onChanged }) {
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
  const fileInput = useRef(null);

  const days = courseDays(workshop);
  const counts = libraryCounts(items);
  const groups = libraryByDay(items);

  // A file store that was never switched on fails deep inside the SDK with a
  // CORS error that names nothing. Say so up front instead.
  const canUpload = canStoreFiles;

  useEffect(() => { if (!canUpload && source === 'file') setSource('link'); }, [canUpload, source]);

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
        public site. Only students who have claimed a ticket for this course can
        see any of it.
      </p>

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
            disabled={!canUpload}
            onClick={() => { setSource('file'); setError(''); }}
            title={canUpload ? undefined : 'No file store is configured for this project.'}
          >
            Upload a file
          </button>
          <span className="hint" style={{ marginLeft: 4 }}>
            {source === 'link'
              ? 'Free, and stops working if the Drive folder moves or its sharing changes.'
              : `Kept here for good. Up to ${formatBytes(MAX_FILE_BYTES)} each.`}
          </span>
        </div>

        {!canUpload && (
          <div className="notice warn mt-3">
            No file store is configured, so only links can be added. Turn on
            Storage for this project in the Firebase console and set
            <code> VITE_FIREBASE_STORAGE_BUCKET</code>.
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
              />
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
          <button className="primary" type="submit" disabled={uploading}>
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
