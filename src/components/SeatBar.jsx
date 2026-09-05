import { seatPressure } from '../lib/stats.js';

/**
 * How full a course is, as a bar.
 *
 * Renders nothing for a workshop with no seat limit — an empty track beside
 * every uncapped course would be noise, and would imply a limit that is not
 * there.
 */
export default function SeatBar({ workshop, count, showLabel = true }) {
  const seats = seatPressure(workshop, count);
  if (!seats) return null;

  const label = seats.left < 0
    ? `${-seats.left} over ${seats.limit}`
    : `${seats.taken} of ${seats.limit}`;

  return (
    <div className="seats">
      <div
        className="seat-bar"
        data-level={seats.level}
        role="img"
        aria-label={`${seats.taken} of ${seats.limit} seats taken`}
      >
        <span style={{ width: `${Math.round(seats.filled * 100)}%` }} />
      </div>
      {showLabel && <span className="n">{label}</span>}
    </div>
  );
}
