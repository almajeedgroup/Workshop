import test from 'node:test';
import assert from 'node:assert/strict';
import {
  transcriptLine, appendLine, transcriptText, MAX_TRANSCRIPT_CHARS,
  checkHandoutFile, checkHandoutLink, handoutTitle, handoutRecord, humanBytes,
  MAX_HANDOUT_BYTES, pickRecordingType, recordingName, elapsed, RECORDING_TYPES,
} from '../src/lib/classroom.js';
import { speechSupport, speechErrorMessage, createTranscriber } from '../src/lib/speech.js';
import { recordingSupport, mixAudio } from '../src/lib/recorder.js';

/* ---------------- the transcript ---------------- */

test('a line is tidied, stamped, and capped', () => {
  const line = transcriptLine('  so   the gear   ratio  ', new Date('2026-09-06T10:04:00Z'));
  assert.equal(line.s, 'so the gear ratio');
  assert.equal(line.t, '2026-09-06T10:04:00.000Z');
  assert.equal(transcriptLine('x'.repeat(5000)).s.length, 2000);
});

test('silence is not a line', () => {
  for (const v of ['', '   ', null, undefined]) assert.equal(transcriptLine(v), null);
});

test('appending null changes nothing', () => {
  const lines = [{ t: '', s: 'a' }];
  assert.deepEqual(appendLine(lines, null), { lines, dropped: 0 });
});

test('a long class drops its OLDEST lines, and says how many', () => {
  // Refusing to add would stop recording the part being spoken now, which is
  // the part a class revises from.
  const long = Array.from({ length: 5 }, () => ({ t: '', s: 'x'.repeat(100) }));
  const { lines, dropped } = appendLine(long, { t: '', s: 'newest' }, 300);
  assert.equal(dropped, 3);
  assert.equal(lines[lines.length - 1].s, 'newest');
  assert.ok(lines.length < long.length + 1);
});

test('one enormous line is kept rather than everything being dropped', () => {
  const { lines } = appendLine([], { t: '', s: 'x'.repeat(500) }, 100);
  assert.equal(lines.length, 1);
});

test('the cap leaves room under a Firestore document', () => {
  // A document is 1 MiB for the whole record, lines and timestamps included.
  assert.ok(MAX_TRANSCRIPT_CHARS < 1024 * 1024 * 0.4);
});

test('the transcript reads back with times, or without', () => {
  const lines = [
    { t: '2026-09-06T04:34:00.000Z', s: 'one' },
    { t: 'not a date', s: 'two' },
  ];
  assert.match(transcriptText(lines), /^\[\d{2}:\d{2}\] one\ntwo$/);
  assert.equal(transcriptText(lines, { times: false }), 'one\ntwo');
  assert.equal(transcriptText([]), '');
});

/* ---------------- handouts ---------------- */

test('a PDF within the limit is accepted', () => {
  assert.deepEqual(checkHandoutFile({ type: 'application/pdf', size: 200 * 1024 }), { ok: true });
});

test('a big PDF is refused with the size, the limit and what to do instead', () => {
  const { ok, error } = checkHandoutFile({ type: 'application/pdf', size: 900 * 1024 });
  assert.equal(ok, false);
  assert.match(error, /900 KB/);
  assert.match(error, /600 KB/);
  assert.match(error, /share the link instead/);
});

test('only PDFs, and something must be chosen', () => {
  assert.match(checkHandoutFile({ type: 'image/png', size: 10 }).error, /Only PDF/);
  assert.match(checkHandoutFile(null).error, /No file chosen/);
});

test('the limit is under the document ceiling once base64 has grown it', () => {
  // base64 costs about a third more than the bytes it carries.
  assert.ok(MAX_HANDOUT_BYTES * 1.37 < 1024 * 1024);
});

test('a link without a scheme is still a link', () => {
  assert.deepEqual(checkHandoutLink('drive.google.com/x'),
    { ok: true, url: 'https://drive.google.com/x' });
});

test('javascript: is refused, and named', () => {
  // In a classroom, on a link the presenter pastes and forty people click.
  const { ok, error } = checkHandoutLink('javascript:alert(1)');
  assert.equal(ok, false);
  assert.match(error, /not javascript:/);
  assert.match(checkHandoutLink('data:text/html,x').error, /not data:/);
});

test('nonsense is refused as nonsense', () => {
  assert.match(checkHandoutLink('not a link').error, /does not look like a link/);
  assert.match(checkHandoutLink('').error, /Paste a link first/);
});

test('a handout falls back to the file name, without the extension', () => {
  assert.equal(handoutTitle('', 'Gear ratios.pdf'), 'Gear ratios');
  assert.equal(handoutTitle('  Slides  ', 'x.pdf'), 'Slides');
  assert.equal(handoutTitle('', ''), 'Handout');
  assert.equal(handoutTitle('x'.repeat(200), '').length, 120);
});

test('a link record carries no data, and a file record carries no url', () => {
  const link = handoutRecord({ title: 'A', kind: 'link', url: 'https://x.y', data: 'nope' });
  assert.equal(link.data, '');
  assert.equal(link.url, 'https://x.y');
  const file = handoutRecord({ title: 'B', kind: 'file', data: 'data:...', url: 'nope', bytes: 12 });
  assert.equal(file.url, '');
  assert.equal(file.bytes, 12);
});

test('sizes read the way people say them', () => {
  assert.equal(humanBytes(900), '900 B');
  assert.equal(humanBytes(2048), '2 KB');
  assert.equal(humanBytes(1024 * 1024 * 3.5), '3.5 MB');
});

/* ---------------- recording ---------------- */

test('the container is asked for, not assumed', () => {
  // A recording that fails at the moment it is needed is worse than one in a
  // format somebody has to convert.
  assert.equal(pickRecordingType((t) => t === 'video/mp4'), 'video/mp4');
  assert.equal(pickRecordingType(() => true), RECORDING_TYPES[0]);
  assert.equal(pickRecordingType(() => false), '');
});

test('a recording is named for its class and its day', () => {
  assert.equal(
    recordingName({ title: 'Advanced Robotics!' }, new Date('2026-09-06T09:00:00Z'), 'video/webm'),
    'Advanced-Robotics-2026-09-06.webm'
  );
  assert.match(recordingName({}, new Date('2026-09-06T09:00:00Z'), 'video/mp4'), /^class-2026-09-06\.mp4$/);
});

test('elapsed reads as a clock', () => {
  assert.equal(elapsed(0), '0:00');
  assert.equal(elapsed(65000), '1:05');
  assert.equal(elapsed(3862000), '1:04:22');
  assert.equal(elapsed(-5), '0:00');
});

test('recording needs both halves, and says so by refusing', () => {
  assert.equal(recordingSupport({}), false);
  assert.equal(recordingSupport({ MediaRecorder: class {} }), false);
  assert.equal(recordingSupport({
    MediaRecorder: class {}, navigator: { mediaDevices: { getDisplayMedia() {} } },
  }), true);
});

test('with no microphone to mix, the screen is recorded as it is', () => {
  const screen = { getAudioTracks: () => [], getVideoTracks: () => [] };
  assert.equal(mixAudio({}, screen, null), screen);
});

test('the microphone IS mixed in when there is one', () => {
  // Without this the recording has students answering questions nobody can
  // hear being asked: the presenter's own voice never goes through their
  // own speakers, so the shared tab does not carry it.
  const connected = [];
  const win = {
    AudioContext: class {
      createMediaStreamDestination() { return { stream: { getAudioTracks: () => [{ kind: 'mixed' }] } }; }
      createMediaStreamSource(s) { return { connect: () => connected.push(s.name) }; }
    },
    MediaStream: class { constructor() { this.tracks = []; } addTrack(t) { this.tracks.push(t); } },
  };
  const screen = { name: 'screen', getAudioTracks: () => [{}], getVideoTracks: () => [{ kind: 'video' }] };
  const mic = { name: 'mic', getAudioTracks: () => [{}] };
  const out = mixAudio(win, screen, mic);
  assert.deepEqual(connected, ['screen', 'mic']);
  assert.deepEqual(out.tracks.map((t) => t.kind), ['video', 'mixed']);
  assert.deepEqual(out.__sources, [screen, mic]);
});

/* ---------------- speech ---------------- */

test('a browser without a recogniser gets null, not a broken button', () => {
  assert.equal(speechSupport({}), null);
  assert.equal(createTranscriber({ win: {} }), null);
  assert.ok(speechSupport({ webkitSpeechRecognition: class {} }));
});

test('a refused microphone is explained, and silence is not an error', () => {
  assert.match(speechErrorMessage('not-allowed'), /Allow it in the/);
  assert.match(speechErrorMessage('network'), /needs a connection/);
  assert.equal(speechErrorMessage('aborted'), '');
});

/** A recogniser that can be driven by hand. */
function fakeWin() {
  const timers = [];
  class Recognition {
    constructor() { Recognition.last = this; this.started = 0; }
    start() { this.started += 1; }
    stop() { this.onend?.(); }
    say(text, isFinal) {
      this.onresult({ resultIndex: 0, results: [{ 0: { transcript: text }, isFinal }] });
    }
    fail(error) { this.onerror({ error }); }
  }
  return {
    win: { SpeechRecognition: Recognition, setTimeout: (fn) => { timers.push(fn); return timers.length; } },
    Recognition,
    tick: () => timers.splice(0).forEach((fn) => fn()),
  };
}

test('final speech becomes a line; mid-sentence speech does not', () => {
  const { win, Recognition } = fakeWin();
  const lines = []; const partials = [];
  const t = createTranscriber({ win, onLine: (s) => lines.push(s), onPartial: (s) => partials.push(s) });
  t.start();
  Recognition.last.say('the gear ratio is', false);
  Recognition.last.say('the gear ratio is three to one', true);
  assert.deepEqual(lines, ['the gear ratio is three to one']);
  assert.ok(partials.includes('the gear ratio is'));
});

test('it starts itself again after a pause, because every recogniser stops', () => {
  // Without this, transcription quietly ends the first time the presenter
  // stops to think — and a class is mostly pauses.
  const { win, Recognition, tick } = fakeWin();
  const t = createTranscriber({ win });
  t.start();
  assert.equal(Recognition.last.started, 1);
  Recognition.last.onend();
  tick();
  assert.equal(Recognition.last.started, 2);
});

test('once stopped, it stays stopped', () => {
  const { win, Recognition, tick } = fakeWin();
  const states = [];
  const t = createTranscriber({ win, onStateChange: (v) => states.push(v) });
  t.start();
  t.stop();
  Recognition.last.onend();
  tick();
  assert.equal(Recognition.last.started, 1);
  assert.equal(t.isRunning(), false);
  assert.deepEqual(states, [true, false]);
});

test('a refused microphone stops it rather than looping forever', () => {
  const { win, Recognition, tick } = fakeWin();
  const errors = [];
  const t = createTranscriber({ win, onError: (e) => errors.push(e) });
  t.start();
  Recognition.last.fail('not-allowed');
  Recognition.last.onend();
  tick();
  assert.equal(Recognition.last.started, 1, 'asking harder does not help');
  assert.equal(t.isRunning(), false);
  assert.equal(errors.length, 1);
});

test('a pause reports nothing at all', () => {
  const { win, Recognition } = fakeWin();
  const errors = [];
  const t = createTranscriber({ win, onError: (e) => errors.push(e) });
  t.start();
  Recognition.last.fail('no-speech');
  assert.deepEqual(errors, [], 'a class is mostly silence');
});
