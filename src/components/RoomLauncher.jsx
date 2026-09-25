import { useState } from 'react';
import { roomUrl, launchReason, launchLimits, meetingHostname } from '../lib/meeting.js';
import { ISSUER } from '../lib/schema.js';

/**
 * The class, opened in its own window instead of inside this page.
 *
 * Not a fallback for a failure — a deliberate mode. 8x8 allow meet.jit.si to
 * be embedded only as a five-minute demo and disconnect the call after that,
 * while the same free server used directly has no limit. So on that server
 * the class is LAUNCHED, and this is the thing that launches it.
 *
 * It says why, and it says what is lost, because a presenter who was promised
 * a live register and cannot find one will go looking. Both are one press
 * away from the class itself rather than in front of it.
 */
export default function RoomLauncher({
  room, host = ISSUER.meetingHost, label = 'Open the class', subject = '', onOpened = null,
}) {
  const [why, setWhy] = useState(false);
  const url = roomUrl(room, host);
  const reason = launchReason(host);

  if (!room) return null;

  return (
    <div className="room-idle">
      <h2>{subject || 'The class is ready'}</h2>
      <p>
        It opens in its own window on <strong>{meetingHostname(host)}</strong>.
        Leave this page open beside it — the notes, the transcript and the
        handouts are here.
      </p>
      <p className="btn-row">
        <a
          className="btn primary big"
          href={url}
          target="_blank"
          rel="noreferrer"
          onClick={() => onOpened?.()}
        >
          {label}
        </a>
      </p>

      {reason && (
        <>
          <button type="button" className="small" onClick={() => setWhy((v) => !v)} aria-expanded={why}>
            {why ? 'Hide why' : 'Why a separate window?'}
          </button>
          {why && (
            <div className="launch-why">
              <p>{reason}</p>
              <p>Two things work differently because of it:</p>
              <ul>
                {launchLimits().map((line) => <li key={line}>{line}</li>)}
              </ul>
              <p className="hint">
                Running your own Jitsi removes the rule and puts the class back
                inside this page. See <code>meetingHost</code> in the README.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
