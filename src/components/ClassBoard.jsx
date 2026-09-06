import { useCallback, useEffect, useRef, useState } from 'react';
import {
  watchNotes, saveNotes, watchTranscript, saveTranscript, clearTranscript,
  watchHandouts, addHandout, removeHandout,
} from '../lib/classroomdb.js';
import {
  appendLine, transcriptLine, transcriptText, checkHandoutFile, checkHandoutLink,
  humanBytes, elapsed, MAX_HANDOUT_BYTES,
} from '../lib/classroom.js';
import { createTranscriber, speechSupport } from '../lib/speech.js';
import { startRecording, recordingSupport, saveRecording } from '../lib/recorder.js';

/**
 * What a class leaves behind, live: notes, a transcript and handouts.
 *
 * One component, two audiences. The presenter gets the controls; a student
 * gets the same three things, read-only, updating as they are written. They
 * share a component because they must never disagree — a student reading
 * yesterday's notes because the two screens drifted is worse than no notes.
 *
 * Everything here is honest about its limits ON SCREEN rather than in a
 * document nobody opens: the transcript hears the presenter and not the
 * class, the recording is saved to the presenter's own computer, and a
 * handout PDF has to be small enough to live in a database record.
 */
export default function ClassBoard({ workshopId, workshop = null, day, host = false }) {
  const [tab, setTab] = useState('notes');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([]);
  const [handouts, setHandouts] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  /* ---- live, for everybody ---- */
  useEffect(() => {
    if (!workshopId || !day) return undefined;
    const offs = [
      watchNotes(workshopId, day, setNotes, (e) => setError(e.message)),
      watchTranscript(workshopId, day, setLines, (e) => setError(e.message)),
      watchHandouts(workshopId, setHandouts, (e) => setError(e.message)),
    ];
    return () => offs.forEach((off) => off());
  }, [workshopId, day]);

  return (
    <div className="board-panel">
      <div className="board-tabs" role="tablist" aria-label="What the class leaves behind">
        {[
          ['notes', 'Notes'],
          ['transcript', `Transcript${lines.length ? ` (${lines.length})` : ''}`],
          ['handouts', `Handouts${handouts.length ? ` (${handouts.length})` : ''}`],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? 'primary' : undefined}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div className="notice warn">{error}</div>}
      {notice && <div className="notice">{notice}</div>}

      {tab === 'notes' && (
        <Notes workshopId={workshopId} day={day} text={notes} host={host} onError={setError} />
      )}
      {tab === 'transcript' && (
        <Transcript
          workshopId={workshopId} workshop={workshop} day={day} lines={lines} host={host}
          onError={setError} onNotice={setNotice}
        />
      )}
      {tab === 'handouts' && (
        <Handouts
          workshopId={workshopId} handouts={handouts} host={host}
          onError={setError} onNotice={setNotice}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Notes
 * ------------------------------------------------------------------ */

function Notes({ workshopId, day, text, host, onError }) {
  const [draft, setDraft] = useState(text);
  const [saving, setSaving] = useState(false);
  const dirty = useRef(false);
  const timer = useRef(null);

  // Somebody else's edit only overwrites the box when this person is not
  // mid-sentence in it. Otherwise a second presenter typing would delete a
  // word out from under the first.
  useEffect(() => { if (!dirty.current) setDraft(text); }, [text]);

  const change = (value) => {
    setDraft(value);
    dirty.current = true;
    if (!host) return;
    clearTimeout(timer.current);
    // Saved a moment after typing stops, not on every keystroke: a document
    // write per letter is a write per letter.
    timer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await saveNotes(workshopId, day, value);
        dirty.current = false;
      } catch (e) { onError(e.message); } finally { setSaving(false); }
    }, 700);
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  if (!host) {
    return draft.trim()
      ? <div className="board-read">{draft}</div>
      : <p className="hint">The presenter has not written anything yet. It appears here as they do.</p>;
  }

  return (
    <>
      <label className="vh" htmlFor="class-notes">Class notes</label>
      <textarea
        id="class-notes"
        className="board-notes"
        value={draft}
        onChange={(e) => change(e.target.value)}
        placeholder="What the class needs to keep. Everybody in the room sees this as you type."
      />
      <p className="hint">
        {saving ? 'Saving…' : 'Saved automatically · everyone in the class sees this live.'}
      </p>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Transcript
 * ------------------------------------------------------------------ */

function Transcript({ workshopId, workshop, day, lines, host, onError, onNotice }) {
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const [recording, setRecording] = useState(null);
  const [since, setSince] = useState(0);
  const transcriber = useRef(null);
  const pending = useRef([]);
  const known = useRef(lines);
  const foot = useRef(null);

  known.current = lines;
  const supported = Boolean(speechSupport(globalThis));
  const canRecord = recordingSupport(globalThis);

  // New lines are held for a moment and written together. A class produces
  // one every few seconds; a write each would be a write every few seconds
  // for an hour, for every class, for one line of text.
  useEffect(() => {
    if (!host) return undefined;
    const flush = setInterval(async () => {
      if (!pending.current.length) return;
      const batch = pending.current;
      pending.current = [];
      let next = known.current;
      let lost = 0;
      for (const line of batch) {
        const step = appendLine(next, line);
        next = step.lines;
        lost += step.dropped;
      }
      try {
        await saveTranscript(workshopId, day, next);
        if (lost) onNotice(`The transcript is full, so the earliest ${lost} lines were dropped.`);
      } catch (e) { onError(e.message); }
    }, 4000);
    return () => clearInterval(flush);
  }, [host, workshopId, day, onError, onNotice]);

  useEffect(() => {
    if (!recording) return undefined;
    const t = setInterval(() => setSince(Date.now() - recording.startedAt), 1000);
    return () => clearInterval(t);
  }, [recording]);

  // Follows the speaker unless somebody has scrolled up to read something.
  useEffect(() => {
    const el = foot.current;
    if (!el) return;
    const box = el.parentElement;
    if (box && box.scrollHeight - box.scrollTop - box.clientHeight < 80) {
      el.scrollIntoView({ block: 'end' });
    }
  }, [lines, partial]);

  const listen = useCallback(() => {
    if (transcriber.current?.isRunning()) {
      transcriber.current.stop();
      return;
    }
    transcriber.current = createTranscriber({
      onLine: (said) => {
        const line = transcriptLine(said);
        if (line) pending.current.push(line);
      },
      onPartial: setPartial,
      onError,
      onStateChange: setListening,
    });
    if (!transcriber.current) {
      onError('This browser has no speech recogniser. Chrome or Edge does.');
      return;
    }
    transcriber.current.start();
  }, [onError]);

  useEffect(() => () => transcriber.current?.stop(), []);

  const record = async () => {
    if (recording) { recording.stop(); return; }
    try {
      const handle = await startRecording({
        workshop,
        onStop: (blob, name, ms) => {
          setRecording(null);
          saveRecording(globalThis, blob, name);
          onNotice(`Recording saved to your computer as ${name} (${elapsed(ms)}, ${humanBytes(blob.size)}).`);
        },
        onError,
      });
      setRecording(handle);
      setSince(0);
    } catch (e) {
      // Cancelling the picker is a decision, not a failure.
      if (e.name !== 'NotAllowedError' && e.name !== 'AbortError') onError(e.message);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(transcriptText(lines));
      onNotice('The transcript is on your clipboard.');
    } catch { onError('Could not copy. Select the text and copy it by hand.'); }
  };

  return (
    <>
      {host && (
        <div className="board-tools">
          <button
            type="button"
            className={listening ? 'danger' : 'primary'}
            onClick={listen}
            disabled={!supported}
            title={supported ? undefined : 'Chrome or Edge has the speech recogniser'}
          >
            {listening ? 'Stop transcribing' : 'Transcribe the class'}
          </button>
          <button
            type="button"
            className={recording ? 'danger' : undefined}
            onClick={record}
            disabled={!canRecord}
          >
            {recording ? `Stop recording · ${elapsed(since)}` : 'Record the class'}
          </button>
          <span className="spacer" />
          <button type="button" className="small" onClick={copy} disabled={!lines.length}>Copy</button>
          <button
            type="button"
            className="small"
            disabled={!lines.length}
            onClick={async () => {
              try { await clearTranscript(workshopId, day); } catch (e) { onError(e.message); }
            }}
          >
            Clear
          </button>
        </div>
      )}

      {host && (
        <p className="hint">
          Transcribes <strong>your microphone</strong> — what you say, not what
          the class says: their voices arrive as sound in the meeting and never
          reach it. Recording captures a screen you choose, with your
          microphone mixed in, and is saved to <strong>your computer</strong> —
          there is no file store behind this app to upload an hour of video to.
          {!supported && ' This browser has no speech recogniser; Chrome or Edge does.'}
        </p>
      )}

      <div className="board-read board-transcript">
        {lines.length === 0 && !partial && (
          <p className="hint">
            {host
              ? 'Nothing yet. Press “Transcribe the class” and it fills in as you speak.'
              : 'Nothing yet. What the presenter says appears here.'}
          </p>
        )}
        {lines.map((l, i) => (
          <p key={`${l.t}-${i}`} className="t-line">
            <span className="t-at">{String(l.t || '').slice(11, 16)}</span>
            {l.s}
          </p>
        ))}
        {partial && <p className="t-line t-partial"><span className="t-at">··</span>{partial}</p>}
        <span ref={foot} />
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Handouts
 * ------------------------------------------------------------------ */

function Handouts({ workshopId, handouts, host, onError, onNotice }) {
  const [link, setLink] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const file = useRef(null);

  const shareLink = async () => {
    const check = checkHandoutLink(link);
    if (!check.ok) { onError(check.error); return; }
    setBusy(true);
    try {
      await addHandout(workshopId, { title, kind: 'link', url: check.url });
      setLink(''); setTitle('');
      onNotice('Shared. It is on every screen in the class now.');
    } catch (e) { onError(e.message); } finally { setBusy(false); }
  };

  const sharePdf = async (chosen) => {
    if (!chosen) return;
    const check = checkHandoutFile(chosen);
    if (!check.ok) { onError(check.error); if (file.current) file.current.value = ''; return; }
    setBusy(true);
    try {
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('That file could not be read.'));
        reader.readAsDataURL(chosen);
      });
      await addHandout(workshopId, {
        title, kind: 'file', data, bytes: chosen.size, fileName: chosen.name,
      });
      setTitle('');
      if (file.current) file.current.value = '';
      onNotice('Shared. It is on every screen in the class now.');
    } catch (e) { onError(e.message); } finally { setBusy(false); }
  };

  return (
    <>
      {host && (
        <div className="board-share">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What is it called? (optional)"
            aria-label="Handout title"
          />
          <div className="board-tools">
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="Paste a link…"
              aria-label="Handout link"
              onKeyDown={(e) => { if (e.key === 'Enter') shareLink(); }}
            />
            <button type="button" onClick={shareLink} disabled={busy || !link.trim()}>Share link</button>
          </div>
          <div className="board-tools">
            <input
              ref={file}
              type="file"
              accept="application/pdf"
              aria-label="Handout PDF"
              onChange={(e) => sharePdf(e.target.files?.[0])}
              disabled={busy}
            />
          </div>
          <p className="hint">
            A PDF has to be under {humanBytes(MAX_HANDOUT_BYTES)} — there is no
            file store behind this app, so it is kept in the class record
            itself. Anything larger: put it on Drive and share the link.
          </p>
        </div>
      )}

      {handouts.length === 0 ? (
        <p className="hint">
          {host ? 'Nothing shared yet.' : 'The presenter has not shared anything yet.'}
        </p>
      ) : (
        <ul className="board-handouts">
          {handouts.map((h) => (
            <li key={h.id}>
              <a
                href={h.kind === 'file' ? h.data : h.url}
                target="_blank"
                rel="noreferrer"
                download={h.kind === 'file' ? `${h.title}.pdf` : undefined}
              >
                {h.title}
              </a>
              <span className="f-sub">
                {h.kind === 'file' ? `PDF · ${humanBytes(h.bytes)}` : 'link'}
              </span>
              {host && (
                <button
                  type="button"
                  className="small"
                  onClick={async () => {
                    try { await removeHandout(workshopId, h.id); } catch (e) { onError(e.message); }
                  }}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
