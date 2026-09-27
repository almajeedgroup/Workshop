import { useEffect, useRef, useState } from 'react';
import { ISSUER } from '../lib/schema.js';
import { externalApiUrl, meetingOptions, MODERATOR_ACTIONS, roomUrl } from '../lib/meeting.js';

/**
 * A Jitsi Meet room, embedded.
 *
 * The component owns three things a page should not have to: loading the
 * external API script once however many rooms are mounted, tearing the
 * meeting down properly when the page changes, and FAILING VISIBLY.
 *
 * That last one is the reason this is not twenty lines. The script comes
 * from another origin, so it is blocked by a Content-Security-Policy that
 * has not been told about it, by a school or office firewall, and by
 * anything that eats third-party scripts. In every one of those cases the
 * default outcome is a silent empty box a minute before a class starts. So
 * the load is timed, failure is reported upwards, and the caller shows the
 * way in that does not depend on us.
 */

/** One load for the whole app, whatever mounts. */
let scriptPromise = null;

/** Long enough for a slow phone, short enough to still fix it. */
const LOAD_TIMEOUT_MS = 15000;

export function loadJitsiApi(host = ISSUER.meetingHost, timeout = LOAD_TIMEOUT_MS) {
  if (globalThis.JitsiMeetExternalAPI) return Promise.resolve(globalThis.JitsiMeetExternalAPI);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const src = externalApiUrl(host);
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    const timer = setTimeout(() => {
      // A blocked script often never fires `error` — it just never arrives.
      // Without this the page waits for a video call that is not coming.
      fail(new Error(`Timed out loading the meeting software from ${host}.`));
    }, timeout);

    function done() {
      clearTimeout(timer);
      el.onload = null;
      el.onerror = null;
    }
    function fail(err) {
      done();
      scriptPromise = null;         // let a retry actually retry
      el.remove();
      reject(err);
    }
    el.onload = () => {
      done();
      if (globalThis.JitsiMeetExternalAPI) resolve(globalThis.JitsiMeetExternalAPI);
      else fail(new Error('The meeting software loaded but did not start.'));
    };
    el.onerror = () => fail(new Error(`Could not load the meeting software from ${host}.`));
    document.head.appendChild(el);
  });
  return scriptPromise;
}

export default function JitsiRoom({
  room,
  displayName = '',
  email = '',
  subject = '',
  moderator = false,
  host = ISSUER.meetingHost,
  onParticipants = null,
  onJoined = null,
  onLeft = null,
  onError = null,
}) {
  const holder = useRef(null);
  const api = useRef(null);
  const [state, setState] = useState('loading');   // loading | live | failed
  const [error, setError] = useState('');

  // Handlers are read through a ref so that a parent re-rendering with a new
  // callback does not tear down and rebuild a live video call.
  const handlers = useRef({ onParticipants, onJoined, onLeft, onError });
  handlers.current = { onParticipants, onJoined, onLeft, onError };

  useEffect(() => {
    if (!room) return undefined;
    let live = true;

    loadJitsiApi(host)
      .then((JitsiMeetExternalAPI) => {
        if (!live || !holder.current) return;
        const meeting = new JitsiMeetExternalAPI(host, {
          ...meetingOptions({ room, displayName, email, subject, moderator }),
          parentNode: holder.current,
        });
        api.current = meeting;
        setState('live');

        // Asked for rather than tallied. Counting joins and leaves drifts
        // the moment one event is missed; the room always knows who is in it.
        const report = () => {
          try {
            handlers.current.onParticipants?.(meeting.getParticipantsInfo() || []);
          } catch { /* the meeting is going away; the list no longer matters */ }
        };

        meeting.addListener('videoConferenceJoined', () => {
          if (moderator) {
            for (const [command, ...args] of MODERATOR_ACTIONS) {
              try { meeting.executeCommand(command, ...args); } catch { /* not fatal */ }
            }
          }
          handlers.current.onJoined?.();
          report();
        });
        meeting.addListener('participantJoined', report);
        meeting.addListener('participantLeft', report);
        meeting.addListener('displayNameChange', report);
        meeting.addListener('videoConferenceLeft', () => handlers.current.onLeft?.());
        meeting.addListener('readyToClose', () => handlers.current.onLeft?.());
      })
      .catch((e) => {
        if (!live) return;
        setState('failed');
        setError(e.message);
        handlers.current.onError?.(e);
      });

    return () => {
      live = false;
      try { api.current?.dispose(); } catch { /* already gone */ }
      api.current = null;
    };
    // Deliberately NOT depending on the callbacks or the display name: those
    // change while somebody is talking, and rebuilding the call would drop
    // them from it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, host, moderator]);

  if (!room) return null;

  if (state === 'failed') {
    return (
      <div className="room-fallback" role="alert">
        <h3>The class could not open here</h3>
        <p>{error}</p>
        <p>
          This is usually a network or browser restriction rather than a problem
          with the class. The room itself is fine — open it directly:
        </p>
        <p className="btn-row">
          <a className="btn primary" href={roomUrl(room, host)} target="_blank" rel="noreferrer">
            Open the class on {host}
          </a>
        </p>
        <p className="hint">
          If it does not open there either, try another browser or a phone on
          mobile data, and tell the office which network you are on.
        </p>
      </div>
    );
  }

  return (
    <div className="room-wrap">
      <div
        className="room"
        ref={holder}
        aria-label={subject ? `Video class: ${subject}` : 'Video class'}
      />
      {state === 'loading' && (
        <p className="room-loading" role="status">Opening the class…</p>
      )}
    </div>
  );
}
