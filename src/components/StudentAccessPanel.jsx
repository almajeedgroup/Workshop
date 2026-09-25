import { useState } from 'react';
import { syncTicketIndex, revokeMember } from '../lib/studentdb.js';

/**
 * Who can open this course's library, and the switch that lets them.
 *
 * ── THE TICKET LIST HAS TO BE PUBLISHED FIRST ────────────────────────────
 *
 * A student claims a ticket, and the rules check it against
 * `workshops/{id}/tickets` — a list of which ticket numbers this course
 * actually issued, holding nothing else. Without that list every claim is
 * refused, which from the student's side looks exactly like a typo. So this
 * panel makes publishing it an explicit, visible act rather than something
 * that silently did not happen.
 *
 * It is run again after adding people, because a ticket issued later is not
 * in a list published earlier.
 *
 * ── WHAT REVOKING IS FOR ─────────────────────────────────────────────────
 *
 * A claim is exclusive and permanent, which is what makes a ticket worth
 * anything — and it means a ticket claimed by the wrong account is stuck
 * there until somebody frees it. That is this button. It takes the access
 * away AND releases the ticket, so the student it belongs to can claim it.
 */
export default function StudentAccessPanel({ workshop, registrations, members, ticketCount, onChanged }) {
  const [busy, setBusy] = useState('');
  /* Revoking frees a ticket somebody is holding. Asked before it is done,
     because doing it to the wrong row locks the right student out until
     they notice and call. */
  const [confirming, setConfirming] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const issued = registrations.filter((r) => String(r.ticketId || '').trim()).length;
  const behind = issued - ticketCount;

  const publish = async () => {
    setBusy('publish'); setError(''); setNote('');
    try {
      const { added, total } = await syncTicketIndex(workshop.id, registrations);
      setNote(added === 0
        ? `Already published — all ${total} tickets.`
        : `Published ${added} more. ${total} tickets can now be claimed.`);
      await onChanged?.();
    } catch (e) {
      setError(e?.message || 'That did not work.');
    } finally {
      setBusy('');
    }
  };

  const revoke = async (member) => {
    setConfirming('');
    setBusy(member.uid); setError(''); setNote('');
    try {
      await revokeMember(workshop.id, member);
      setNote(`${member.name || member.email} can no longer open this course, `
        + `and ${member.ticketId} is free to be claimed again.`);
      await onChanged?.();
    } catch (e) {
      setError(e?.message || 'That could not be undone.');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="panel no-print">
      <div className="page-head" style={{ border: 0, paddingBottom: 0, marginBottom: 12 }}>
        <h2>Who can open the library</h2>
        <span className="count">{members.length} signed in</span>
      </div>

      <p className="hint">
        A student signs in with Google and claims the ticket ID from their ticket.
        One ticket, one account — so a ticket somebody else takes is noticed
        rather than quietly shared.
      </p>

      {/* The one thing that silently breaks every claim, made loud. */}
      {behind > 0 ? (
        <div className="notice warn mt-3">
          <b>{behind} ticket{behind === 1 ? ' has' : 's have'} not been published.</b>{' '}
          Until they are, those students cannot add this course — it looks to them
          like their ticket is wrong.
        </div>
      ) : (
        issued > 0 && (
          <div className="notice mt-3">
            All {issued} tickets are published and can be claimed.
          </div>
        )
      )}

      <div className="btn-row mt-3">
        <button className="primary" type="button" disabled={busy === 'publish'} onClick={publish}>
          {busy === 'publish' ? 'Publishing…' : 'Publish the ticket list'}
        </button>
        <span className="hint" style={{ marginLeft: 4 }}>
          Run this again after adding people. It never removes anything.
        </span>
      </div>

      {note && <div className="notice mt-3" role="status">{note}</div>}
      {error && <div className="notice warn mt-3">{error}</div>}

      {members.length === 0 ? (
        <div className="empty mt-4">Nobody has added this course yet.</div>
      ) : (
        <table className="mt-4">
          <thead>
            <tr><th>Name</th><th>Signed in as</th><th>Ticket</th><th /></tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.uid}>
                <td>{m.name || <span style={{ color: 'var(--muted)' }}>not given</span>}</td>
                <td>{m.email}</td>
                <td className="mono">{m.ticketId}</td>
                <td style={{ textAlign: 'right' }}>
                  {confirming === m.uid ? (
                    <span className="actions">
                      <button
                        className="small danger"
                        type="button"
                        disabled={busy === m.uid}
                        onClick={() => revoke(m)}
                      >
                        {busy === m.uid ? '…' : 'Revoke and free the ticket'}
                      </button>
                      <button className="small" type="button" onClick={() => setConfirming('')}>
                        Leave it
                      </button>
                    </span>
                  ) : (
                    <button
                      className="small"
                      type="button"
                      disabled={busy === m.uid}
                      onClick={() => setConfirming(m.uid)}
                      title="Take access away and free the ticket"
                    >
                      {busy === m.uid ? '…' : 'Revoke'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
