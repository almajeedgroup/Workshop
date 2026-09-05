import { ISSUER, associationLine } from '../lib/schema.js';
import { formatDate, formatDateRange } from '../lib/tickets.js';
import { cardCrests } from '../lib/idcards.js';
import {
  signatureColumns, attendanceRows, sheetSignatories, attendanceMark,
  attendanceSummary,
} from '../lib/attendance.js';

/**
 * The printable attendance register.
 *
 * Each participant signs their own row; the presenter and coordinator sign
 * the foot. The crests are the ones chosen for this course's ID cards, in the
 * same order, so a course's paperwork looks like one set of documents.
 */
export default function AttendanceSheet({ workshop, registrations, day = '', byDay = null }) {
  const rows = attendanceRows(registrations);
  const cols = signatureColumns(workshop, day);
  const crests = cardCrests(workshop);
  const signatories = sheetSignatories(workshop);
  const dated = day ? formatDate(day) : formatDateRange(workshop);
  // Only meaningful on a single-day sheet; a whole-course sheet has a column
  // per day and no single set of totals to report.
  const marked = byDay && day
    ? attendanceSummary(rows, byDay[day] || {})
    : { attended: 0, absent: 0, unmarked: 0 };

  return (
    <div className="att-scope">
      <div className="att-sheet">
        <div className="att-head">
          <div className="att-crests">
            {crests.map((c) => <img key={c.key} src={c.src} alt={c.alt} />)}
          </div>
          <div className="att-titles">
            <div className="org">{ISSUER.name}</div>
            <div className="unit">{ISSUER.unitLine}</div>
            <div className="doc">Attendance {byDay ? 'Record' : 'Sheet'}</div>
          </div>
        </div>

        <dl className="att-meta">
          <dt>Programme</dt><dd className="wide">{workshop.title || '—'}</dd>
          <dt>{day ? 'Date' : 'Dates'}</dt><dd>{dated || '—'}</dd>
          <dt>Time</dt><dd>{workshop.time || '—'}</dd>
          <dt>Venue</dt><dd>{workshop.venue || '—'}</dd>
          <dt>Mode</dt><dd>{workshop.mode || '—'}</dd>
          {workshop.presentedBy && (<><dt>Presented by</dt><dd className="wide">{workshop.presentedBy}</dd></>)}
          <dt>In association with</dt><dd className="wide">{associationLine(workshop)}</dd>
        </dl>

        {rows.length === 0 ? (
          <div className="att-empty">
            No registrations yet, so there is nobody to list. Add registrations first,
            then print this sheet.
          </div>
        ) : (
          <>
            <table className="att-table">
              <thead>
                <tr>
                  <th className="num">#</th>
                  <th className="tid">Ticket ID</th>
                  <th>Name</th>
                  {cols.map((c) => <th key={c.key} className="sig">{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id || i}>
                    <td className="num">{i + 1}</td>
                    <td className="tid">{r.ticketId || '—'}</td>
                    <td>
                      <div className="nm">{r.name}</div>
                      {(r.qualification || r.area) && (
                        <div className="det">
                          {[r.qualification, r.area].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </td>
                    {cols.map((c) => (
                      <td key={c.key} className="sig">
                        {/* With `byDay` this prints the register that was
                            taken, as a record to file. Without it the boxes
                            stay empty, to be signed on the day. */}
                        {byDay && (
                          <span className="mk" data-tone={attendanceMark(byDay[c.key]?.[r.id]).tone}>
                            {attendanceMark(byDay[c.key]?.[r.id]).short}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="att-count">
              <span>Registered: <b>{rows.length}</b></span>
              {byDay ? (
                <>
                  <span>Present: <b>{marked.attended}</b></span>
                  <span>Absent: <b>{marked.absent}</b></span>
                  {marked.unmarked > 0 && <span>Not marked: <b>{marked.unmarked}</b></span>}
                </>
              ) : (
                <>
                  <span>Present: <b>______</b></span>
                  <span>Absent: <b>______</b></span>
                </>
              )}
            </div>
          </>
        )}

        <div className="att-signs">
          {signatories.map((s) => (
            <div className="att-sign" key={s.role}>
              <div className="rule" />
              <div className="who">{s.name}</div>
              <div className="role">{s.role}</div>
            </div>
          ))}
        </div>

        <div className="att-foot">
          <span>{ISSUER.name} · {ISSUER.site}</span>
          <span>{workshop.code || workshop.ticketPrefix || ''}</span>
        </div>
      </div>
    </div>
  );
}
