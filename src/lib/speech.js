/**
 * Live transcription, taken from the presenter's own microphone.
 *
 * The browser has a speech recogniser built in, and it is the only one
 * available here: there is no server in this app to send audio to, and a
 * transcription service would be a bill and a third party holding a
 * classroom's audio.
 *
 * ── WHAT IT HEARS, said plainly ──────────────────────────────────────────
 *
 * The microphone of the machine it runs on. On the presenter's screen that
 * is the presenter: a lecture transcribes well, and a discussion does not,
 * because a student's voice arrives as decoded audio in the meeting frame
 * and never passes the microphone. It is announced on screen rather than
 * discovered halfway through a term.
 *
 * Chrome and Edge have the recogniser. Safari and Firefox largely do not,
 * and are told so instead of being given a button that does nothing.
 *
 * Everything is injectable so the whole thing can be driven in a test
 * without a microphone, which is the only way any of it would be tested.
 */

/** The constructor, or null where the browser has none. */
export function speechSupport(win = globalThis) {
  return win?.SpeechRecognition || win?.webkitSpeechRecognition || null;
}

/** Why a failure happened, in words somebody can act on. */
export function speechErrorMessage(code) {
  switch (String(code || '')) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'The browser refused the microphone for transcription. Allow it in the '
        + 'address bar and start again.';
    case 'audio-capture':
      return 'No microphone was found for transcription.';
    case 'network':
      return 'The transcriber could not reach the network. Transcription needs a '
        + 'connection even though the class does not.';
    case 'aborted':
      return '';
    default:
      return `Transcription stopped: ${code || 'unknown reason'}.`;
  }
}

/**
 * A running transcriber.
 *
 * Returns { start, stop, isRunning }. Lines arrive final only; the partial
 * text a recogniser emits while somebody is mid-sentence goes to `onPartial`
 * so it can be shown greyed and never stored.
 *
 * IT RESTARTS ITSELF. Every browser recogniser stops on its own after a
 * pause — a few seconds of silence, or a fixed interval — and a class has
 * plenty of both. Without this, transcription quietly ends the first time
 * the presenter stops to think.
 */
export function createTranscriber({
  win = globalThis,
  lang = 'en-IN',
  onLine = () => {},
  onPartial = () => {},
  onError = () => {},
  onStateChange = () => {},
} = {}) {
  const Recogniser = speechSupport(win);
  if (!Recogniser) return null;

  let recogniser = null;
  let wanted = false;
  let reported = false;

  // Stopping fires `onend`, which reports too, so the same state reached two
  // ways was announced twice. Harmless on a React setState and confusing
  // anywhere else, so it is said once.
  const report = (running) => {
    if (running === reported) return;
    reported = running;
    onStateChange(running);
  };

  const build = () => {
    const r = new Recogniser();
    r.lang = lang;
    r.continuous = true;
    r.interimResults = true;

    r.onresult = (event) => {
      let partial = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const said = result[0]?.transcript || '';
        if (result.isFinal) onLine(said);
        else partial += said;
      }
      onPartial(partial.trim());
    };

    r.onerror = (event) => {
      // Silence is not a failure. A class has long pauses and reporting each
      // one would bury the errors that matter.
      if (event?.error === 'no-speech' || event?.error === 'aborted') return;
      const message = speechErrorMessage(event?.error);
      if (message) onError(message);
      // A refused microphone will not start again by being asked harder.
      if (event?.error === 'not-allowed' || event?.error === 'service-not-allowed') {
        wanted = false;
        report(false);
      }
    };

    r.onend = () => {
      onPartial('');
      if (!wanted) { report(false); return; }
      // Restarting immediately throws in some browsers; a tick is enough.
      win.setTimeout(() => {
        if (!wanted) return;
        try { r.start(); } catch { /* already starting, which is fine */ }
      }, 250);
    };
    return r;
  };

  return {
    start() {
      if (wanted) return;
      wanted = true;
      recogniser = build();
      try {
        recogniser.start();
        report(true);
      } catch (e) {
        wanted = false;
        report(false);
        onError(`Transcription could not start: ${e.message}`);
      }
    },
    stop() {
      wanted = false;
      onPartial('');
      try { recogniser?.stop(); } catch { /* already stopped */ }
      report(false);
    },
    isRunning: () => wanted,
  };
}
