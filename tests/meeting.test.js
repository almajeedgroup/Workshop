import test from 'node:test';
import assert from 'node:assert/strict';
import {
  slugify, randomToken, mintRoomName, roomIsGuessable, MIN_SAFE_ROOM_LENGTH,
  classIsLive, classClosedReason, isOnlineClass, classJoinUrl, roomUrl, externalApiUrl,
  meetingOptions, HOST_TOOLBAR, GUEST_TOOLBAR, MODERATOR_ACTIONS,
  nameKey, matchRoom, marksFromRoom,
} from '../src/lib/meeting.js';
import { ISSUER, isOnlineWorkshop, visibleWorkshopFields } from '../src/lib/schema.js';
import { publicWorkshopRecord } from '../src/lib/publicdb.js';

/* ------------------------------------------------------------------ *
 * Room names
 * ------------------------------------------------------------------ */

test('slugify keeps whole words rather than cutting one in half', () => {
  // `beyond-guida` in a link somebody reads aloud looks like a typo.
  assert.equal(slugify('Beyond Guidance', 12), 'beyond');
  assert.equal(slugify('Beyond Guidance', 16), 'beyond-guidance');
});

test('slugify strips accents and punctuation', () => {
  assert.equal(slugify('Ínternatiönal Cláss!'), 'international-class');
});

test('slugify still returns something when the first word is too long', () => {
  assert.equal(slugify('Supercalifragilisticexpialidocious', 12), 'supercalifra');
});

test('slugify survives nothing at all', () => {
  for (const v of ['', null, undefined, '   ', '!!!']) assert.equal(slugify(v), '');
});

test('a minted room is long, random, and readable at the front', () => {
  const room = mintRoomName({ code: 'AIHOW26', title: 'Workshop on AI' });
  assert.match(room, /^beyond-guidance-aihow26-[a-z2-9]{16}$/);
  assert.ok(room.length >= MIN_SAFE_ROOM_LENGTH);
});

test('two rooms minted for the same workshop are different', () => {
  const w = { code: 'AIHOW26' };
  const seen = new Set(Array.from({ length: 50 }, () => mintRoomName(w)));
  assert.equal(seen.size, 50);
});

test('a room falls back to the title, then to a name of its own', () => {
  assert.match(mintRoomName({ title: 'Robotics' }), /-robotics-/);
  assert.match(mintRoomName({}), /-class-/);
});

test('minted names never use the characters people misread', () => {
  // No l, o, 0 or 1: these get read down a phone.
  assert.ok(!/[lo01]/.test(randomToken(400)));
});

test('a name somebody typed is reported as guessable', () => {
  for (const bad of ['', 'class', 'physics-class', 'introduction-to-robotics-workshop']) {
    assert.equal(roomIsGuessable(bad), true, `${bad} should be flagged`);
  }
});

test('a minted name is not', () => {
  assert.equal(roomIsGuessable(mintRoomName({ code: 'AIHOW26' })), false);
});

/* ------------------------------------------------------------------ *
 * Is there a class?
 * ------------------------------------------------------------------ */

test('a class is live only when it is online, open AND has a room', () => {
  const room = 'r-1234567890abcdef';
  assert.equal(classIsLive({ mode: 'Online', classOpen: 'Open', meetingRoom: room }), true);
  assert.equal(classIsLive({ mode: 'Hybrid', classOpen: 'Open', meetingRoom: room }), true);
  assert.equal(classIsLive({ mode: 'Online', classOpen: 'Open', meetingRoom: '' }), false);
  assert.equal(classIsLive({ mode: 'Online', classOpen: 'Closed', meetingRoom: room }), false);
  // classOpen and meetingRoom outlive a change of mode — the fields are
  // hidden on an in-person course, not erased.
  assert.equal(classIsLive({ mode: 'Offline', classOpen: 'Open', meetingRoom: room }), false);
  assert.equal(classIsLive(null), false);
});

test('the public mirror spells "open" as a boolean, and is still understood', () => {
  // The mirror is all booleans; the workshop is an enum on a form. Reading
  // only one spelling is a join page that never lets anybody in.
  const mirror = { mode: 'Online', classOpen: true, meetingRoom: 'r-1234567890abcdef' };
  assert.equal(classIsLive(mirror), true);
  assert.equal(classIsLive({ ...mirror, classOpen: false }), false);
});

test('hybrid counts as online — the people at home are the point', () => {
  assert.equal(isOnlineClass({ mode: 'Hybrid' }), true);
  assert.equal(isOnlineWorkshop({ mode: 'Hybrid' }), true);
  assert.equal(isOnlineClass({ mode: 'Offline' }), false);
});

test('the classroom fields are hidden on a course held in person', () => {
  const online = visibleWorkshopFields({ mode: 'Online' }).map((f) => f.key);
  const offline = visibleWorkshopFields({ mode: 'Offline' }).map((f) => f.key);
  assert.ok(online.includes('classOpen') && online.includes('meetingRoom'));
  assert.ok(!offline.includes('classOpen') && !offline.includes('meetingRoom'));
});

test('each way of being shut out says which one it is', () => {
  assert.match(classClosedReason({ mode: 'Offline' }), /in person/);
  assert.match(classClosedReason({ mode: 'Online', classOpen: 'Closed' }), /not been opened yet/);
  assert.match(classClosedReason({ mode: 'Online', classOpen: 'Open' }), /no room/);
  assert.match(classClosedReason(null), /not valid/);
});

/* ------------------------------------------------------------------ *
 * Links
 * ------------------------------------------------------------------ */

test('the link a student is sent points at the school, not at the meeting', () => {
  const url = classJoinUrl('w123');
  assert.equal(url, `${ISSUER.siteUrl}/class/w123`);
  assert.ok(!url.includes(ISSUER.meetingHost), 'the room must not be in the public link');
});

test('a join link needs a workshop', () => {
  assert.equal(classJoinUrl(''), '');
});

test('the direct room address is built without doubling the scheme or slashes', () => {
  assert.equal(roomUrl('abc', 'meet.jit.si'), 'https://meet.jit.si/abc');
  assert.equal(roomUrl('abc', 'https://meet.jit.si/'), 'https://meet.jit.si/abc');
  assert.equal(roomUrl(''), '');
  assert.equal(externalApiUrl('meet.jit.si'), 'https://meet.jit.si/external_api.js');
});

/* ------------------------------------------------------------------ *
 * How the room is configured
 * ------------------------------------------------------------------ */

test('students arrive muted; the presenter arrives able to speak', () => {
  const guest = meetingOptions({ room: 'r', moderator: false }).configOverwrite;
  const host = meetingOptions({ room: 'r', moderator: true }).configOverwrite;
  assert.equal(guest.startWithAudioMuted, true);
  assert.equal(guest.startWithVideoMuted, true);
  assert.equal(host.startWithAudioMuted, false);
});

test('students cannot share their screen; the presenter can', () => {
  assert.ok(HOST_TOOLBAR.includes('desktop'));
  assert.ok(!GUEST_TOOLBAR.includes('desktop'),
    'a class where anyone can put their screen on the wall gets interrupted');
});

test('only the presenter gets the controls that act on everybody', () => {
  for (const button of ['mute-everyone', 'mute-video-everyone', 'security', 'recording']) {
    assert.ok(HOST_TOOLBAR.includes(button), `${button} belongs to the host`);
    assert.ok(!GUEST_TOOLBAR.includes(button), `${button} must not be a student's`);
  }
});

test('everyone gets the controls a class needs to work', () => {
  for (const button of ['microphone', 'camera', 'chat', 'raisehand', 'tileview', 'hangup']) {
    assert.ok(GUEST_TOOLBAR.includes(button), `${button} is not optional`);
  }
});

test('the device check is on, and the phone app nag is off', () => {
  const c = meetingOptions({ room: 'r' }).configOverwrite;
  assert.equal(c.prejoinPageEnabled, true);
  assert.equal(c.disableDeepLinking, true);
  assert.equal(c.disableThirdPartyRequests, true);
});

test('the presenter turns the lobby on, without being asked to', () => {
  assert.deepEqual(MODERATOR_ACTIONS, [['toggleLobby', true]]);
});

test('nobody is ever nameless in the room', () => {
  assert.equal(meetingOptions({ room: 'r' }).userInfo.displayName, 'Participant');
  assert.equal(meetingOptions({ room: 'r', moderator: true }).userInfo.displayName, 'Presenter');
  assert.equal(meetingOptions({ room: 'r', displayName: 'Adifaah' }).userInfo.displayName, 'Adifaah');
});

test('the room is branded as the school, not as Jitsi', () => {
  const i = meetingOptions({ room: 'r' }).interfaceConfigOverwrite;
  assert.equal(i.SHOW_JITSI_WATERMARK, false);
  assert.equal(i.APP_NAME, ISSUER.unit);
});

/* ------------------------------------------------------------------ *
 * Who is in the room
 * ------------------------------------------------------------------ */

const REGS = [
  { id: 'r1', name: 'Adifaah Shaikh', ticketId: 'AIHOW26-001' },
  { id: 'r2', name: 'Sabnam Khatun', ticketId: 'AIHOW26-002' },
  { id: 'r3', name: 'Mohammed Khan', ticketId: 'AIHOW26-003' },
];

test('a name is matched however it was capitalised or punctuated', () => {
  assert.equal(nameKey('  ADIFAAH   Shaikh '), nameKey('Adifaah Shaikh'));
  assert.equal(nameKey('Mohammed  Khan.'), 'mohammed khan');
});

test('somebody in the room is found on the register by name', () => {
  const { present, strangers, missing } = matchRoom(
    [{ participantId: 'p1', displayName: 'adifaah shaikh' }], REGS
  );
  assert.equal(present.length, 1);
  assert.equal(present[0].registration.id, 'r1');
  assert.deepEqual(strangers, []);
  assert.deepEqual(missing.map((r) => r.id), ['r2', 'r3']);
});

test('a ticket ID in the name wins, whatever the name says', () => {
  const { present } = matchRoom(
    [{ participantId: 'p1', displayName: 'Bablu · aihow26-002' }], REGS
  );
  assert.equal(present[0].registration.id, 'r2');
});

test('somebody not on the register is a stranger, not a near miss', () => {
  // Crediting attendance to whoever has the closest name is a record about a
  // person that nobody checked. It reports instead.
  const { present, strangers } = matchRoom(
    [{ participantId: 'p1', displayName: 'Adifa Shaik' }], REGS
  );
  assert.deepEqual(present, []);
  assert.equal(strangers.length, 1);
});

test('two people of the same name are matched to neither', () => {
  const twins = [
    { id: 'a', name: 'Mohammed Khan', ticketId: 'X-1' },
    { id: 'b', name: 'Mohammed Khan', ticketId: 'X-2' },
  ];
  const { present, strangers } = matchRoom([{ displayName: 'Mohammed Khan' }], twins);
  assert.deepEqual(present, []);
  assert.equal(strangers.length, 1, 'the presenter decides, not a coin toss');
});

test('the same person joining twice is only counted once', () => {
  // Two devices, or a reconnect that left a ghost behind.
  const { present, strangers } = matchRoom([
    { participantId: 'p1', displayName: 'Adifaah Shaikh' },
    { participantId: 'p2', displayName: 'Adifaah Shaikh' },
  ], REGS);
  assert.equal(present.length, 1);
  assert.equal(strangers.length, 0, 'a duplicate is not a stranger');
});

test('an empty room means everybody is missing and nobody is present', () => {
  const { present, strangers, missing } = matchRoom([], REGS);
  assert.deepEqual(present, []);
  assert.deepEqual(strangers, []);
  assert.equal(missing.length, 3);
});

test('an unnamed participant is a stranger rather than a crash', () => {
  const { strangers } = matchRoom([{ participantId: 'p1' }, {}], REGS);
  assert.equal(strangers.length, 2);
});

/* ------------------------------------------------------------------ *
 * Attendance
 * ------------------------------------------------------------------ */

test('the room marks people present and nobody absent', () => {
  const { present } = matchRoom([{ displayName: 'Adifaah Shaikh' }], REGS);
  const marks = marksFromRoom(present);
  assert.deepEqual(marks, { r1: 'present' });
  // r2 and r3 are NOT marked absent: students join late, connections drop,
  // and a register that records that as absence is lying about them.
  assert.ok(!('r2' in marks) && !('r3' in marks));
});

test('an empty room writes no marks at all', () => {
  assert.deepEqual(marksFromRoom([]), {});
});

/* ------------------------------------------------------------------ *
 * What the public can see
 * ------------------------------------------------------------------ */

test('the room reaches the public mirror only while the class is open', () => {
  const base = { title: 'AI', mode: 'Online', meetingRoom: 'beyond-guidance-ai-abcdefgh12345678' };
  const open = publicWorkshopRecord({ ...base, classOpen: 'Open' });
  const shut = publicWorkshopRecord({ ...base, classOpen: 'Closed' });

  assert.equal(open.classOpen, true);
  assert.equal(open.meetingRoom, base.meetingRoom);

  // This is what makes closing a class actually close it. A room left
  // published is one strangers can walk into for as long as the record lives.
  assert.equal(shut.classOpen, false);
  assert.equal(shut.meetingRoom, '');
});

test('an in-person course never publishes a room, however the flag is set', () => {
  const rec = publicWorkshopRecord({
    title: 'AI', mode: 'Offline', classOpen: 'Open', meetingRoom: 'r-abcdefgh12345678',
  });
  assert.equal(rec.classOpen, false);
  assert.equal(rec.meetingRoom, '');
});

test('the mirror carries the server, so a student never has to know it', () => {
  const rec = publicWorkshopRecord({ title: 'AI', mode: 'Online' });
  assert.equal(rec.meetingHost, ISSUER.meetingHost);
});
