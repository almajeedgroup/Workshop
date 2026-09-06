/**
 * Recording a class, in the presenter's own browser.
 *
 * There is nowhere to upload an hour of video to — Firebase Hosting serves
 * files and Firestore holds documents of a megabyte. So the recording is
 * made locally and saved to the presenter's computer, which is a real
 * recording of the real class and needs no server at all.
 *
 * It records the SCREEN, picked by the presenter, with the microphone mixed
 * in. Recording the meeting frame directly is not possible from outside it,
 * and recording only the microphone would capture the presenter and none of
 * the class. Sharing the tab the class is in gives everybody's video, the
 * shared screen, and — through the tab's own audio — everybody's voice.
 *
 * Injectable, so the whole flow can be driven in a test without a camera,
 * a microphone, or somebody sitting there to pick a window.
 */

import { pickRecordingType, recordingName } from './classroom.js';

/** Whether this browser can record at all. */
export function recordingSupport(win = globalThis) {
  return Boolean(win?.MediaRecorder && win?.navigator?.mediaDevices?.getDisplayMedia);
}

/**
 * Put the microphone into the screen's audio.
 *
 * A shared tab carries its own sound, which is everybody in the meeting
 * EXCEPT the person sharing — their voice never goes through their own
 * speakers. Recording without this gives an hour of students answering
 * questions nobody can hear being asked.
 *
 * Returns the screen stream unchanged when there is nothing to mix, so a
 * browser without an audio context still records.
 */
export function mixAudio(win, screenStream, micStream) {
  const Ctx = win?.AudioContext || win?.webkitAudioContext;
  const screenAudio = screenStream.getAudioTracks?.() || [];
  const micAudio = micStream?.getAudioTracks?.() || [];
  if (!Ctx || micAudio.length === 0) return screenStream;

  const ctx = new Ctx();
  const destination = ctx.createMediaStreamDestination();
  if (screenAudio.length) ctx.createMediaStreamSource(screenStream).connect(destination);
  ctx.createMediaStreamSource(micStream).connect(destination);

  const out = new win.MediaStream();
  screenStream.getVideoTracks().forEach((t) => out.addTrack(t));
  destination.stream.getAudioTracks().forEach((t) => out.addTrack(t));
  out.__context = ctx;          // kept so it can be closed when recording stops
  out.__sources = [screenStream, micStream];
  return out;
}

/**
 * Start recording. Resolves once the presenter has picked what to share.
 *
 * `onStop` receives a Blob and the filename to offer it under. Stopping the
 * share from the browser's own bar counts as stopping the recording, because
 * that is what the presenter just did.
 */
export async function startRecording({
  win = globalThis,
  workshop = null,
  onStop = () => {},
  onError = () => {},
} = {}) {
  if (!recordingSupport(win)) {
    throw new Error('This browser cannot record. Chrome or Edge on a computer can.');
  }

  const screen = await win.navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: 30 },
    audio: true,
  });

  let mic = null;
  try {
    mic = await win.navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    // Refused, or in use. Still worth recording — the class is audible
    // through the shared tab even if the presenter's own voice is not.
  }

  const stream = mixAudio(win, screen, mic);
  const mimeType = pickRecordingType((t) => win.MediaRecorder.isTypeSupported?.(t));
  const recorder = new win.MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks = [];
  const startedAt = Date.now();

  recorder.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
  recorder.onerror = (e) => onError(e?.error?.message || 'The recording stopped unexpectedly.');
  recorder.onstop = () => {
    for (const s of stream.__sources || [stream]) s?.getTracks?.().forEach((t) => t.stop());
    try { stream.__context?.close?.(); } catch { /* already closed */ }
    const type = recorder.mimeType || mimeType || 'video/webm';
    onStop(new win.Blob(chunks, { type }), recordingName(workshop, new Date(), type), Date.now() - startedAt);
  };

  // Stopping the share from the browser's own bar IS stopping the recording.
  screen.getVideoTracks()[0]?.addEventListener('ended', () => {
    if (recorder.state !== 'inactive') recorder.stop();
  });

  // A chunk a second, so a browser that crashes loses a second, not the hour.
  recorder.start(1000);
  return {
    startedAt,
    stop() { if (recorder.state !== 'inactive') recorder.stop(); },
    state: () => recorder.state,
  };
}

/** Hand a finished recording to the presenter. */
export function saveRecording(win, blob, name) {
  const url = win.URL.createObjectURL(blob);
  const a = win.document.createElement('a');
  a.href = url;
  a.download = name;
  win.document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoked late: revoking immediately cancels the download in some browsers.
  win.setTimeout(() => win.URL.revokeObjectURL(url), 60000);
}
