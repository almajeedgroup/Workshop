/**
 * Undoing a decision on a self-registration request.
 *
 * The point being pinned: rejecting is a DECISION, not a deletion. The record
 * keeps every field the student typed and only its status changes, so putting
 * somebody back in the queue must not have to reconstruct anything.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { restorePatch, requestToRegistration } from '../src/lib/publicdb.js';

const REQUEST = {
  id: 'req1',
  workshopId: 'w1',
  name: 'Sabnam Khatun',
  dob: '2004-12-21',
  qualification: 'Graduation',
  courseName: 'BBA IN AVIATION',
  whatsapp: '9339214522',
  area: 'Bangalore, Marathahalli',
  email: 'sabnam45220@gmail.com',
  paymentMode: 'UPI',
  paymentRef: 'UTR123456',
  notes: 'Asked about the bus route',
  ref: 'REQ-2K4B',
};

test('restore puts the request back in the pending queue', () => {
  assert.equal(restorePatch().status, 'new');
});

test('restore clears what the decision added, and only that', () => {
  const patch = restorePatch();
  assert.equal(patch.ticketId, '', 'a ticket number from an acceptance must not survive');
  assert.equal(patch.decidedAt, null, 'the decision time belongs to the decision');
  assert.deepEqual(
    Object.keys(patch).sort(), ['decidedAt', 'status', 'ticketId'],
    'restoring must not touch anything the student typed',
  );
});

test('restore touches none of the fields the student filled in', () => {
  const patch = restorePatch();
  for (const key of Object.keys(REQUEST)) {
    if (['status', 'ticketId'].includes(key)) continue;
    assert.ok(!(key in patch), `${key} is the student's, and restoring must leave it alone`);
  }
});

test('a restored request still converts to a full registration', () => {
  // Rejection changed the status and nothing else, so the merge of the
  // restore patch onto the stored record is what accepting would see.
  const restored = { ...REQUEST, status: 'rejected', ...restorePatch() };
  const reg = requestToRegistration(restored);

  assert.equal(reg.name, 'Sabnam Khatun');
  assert.equal(reg.dob, '2004-12-21');
  assert.equal(reg.qualification, 'Graduation');
  assert.equal(reg.courseName, 'BBA IN AVIATION');
  assert.equal(reg.whatsapp, '9339214522');
  assert.equal(reg.area, 'Bangalore, Marathahalli');
  assert.equal(reg.email, 'sabnam45220@gmail.com');
  assert.equal(reg.paymentRef, 'UTR123456');
  assert.equal(reg.paymentStatus, 'Pending');
  assert.match(reg.notes, /Asked about the bus route/);
  assert.match(reg.notes, /REQ-2K4B/, 'the self-registration reference is carried through');
});

test('a restored request carries no ticket number of its own', () => {
  const restored = { ...REQUEST, status: 'accepted', ticketId: 'IIC-007', ...restorePatch() };
  assert.equal(restored.ticketId, '');
  assert.equal(restored.status, 'new');
});
