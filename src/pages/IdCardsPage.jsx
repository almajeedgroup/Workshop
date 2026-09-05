import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getWorkshop, getRegistrations } from '../lib/db.js';
import { getPhotos } from '../lib/photodb.js';
import { cardFace, paginateCards, CARDS_PER_SHEET, cardTheme } from '../lib/idcards.js';
import { IdCardFront, IdCardBack } from '../components/IdCard.jsx';
import '../idcard.css';

/**
 * Every participant's card, laid out on A4 sheets ready to print.
 *
 * Fronts and backs go on SEPARATE sheets in the same grid position rather
 * than being duplexed. Cards at this scale go into a laminating pouch as two
 * pieces anyway, and two sheets in identical order cannot be collated wrong
 * — whereas flipping a stack for manual duplex pairs each back with the card
 * from the opposite column, which is only discovered after cutting.
 */
export default function IdCardsPage() {
  const { id } = useParams();
  const [workshop, setWorkshop] = useState(null);
  const [regs, setRegs] = useState([]);
  const [photos, setPhotos] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [withPhotosOnly, setWithPhotosOnly] = useState(false);

  useEffect(() => {
    let live = true;
    Promise.all([getWorkshop(id), getRegistrations(id), getPhotos(id)])
      .then(([w, r, p]) => {
        if (!live) return;
        if (!w) { setError('That workshop does not exist.'); return; }
        setWorkshop(w);
        setRegs(r);
        setPhotos(p);
      })
      .catch((e) => live && setError(e.message))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [id]);

  if (loading) return <main><p className="count">Loading…</p></main>;
  if (error) {
    return (
      <main>
        <div className="notice warn">{error}</div>
        <Link className="btn" to={`/w/${id}`}>← Back to the workshop</Link>
      </main>
    );
  }

  const chosen = withPhotosOnly ? regs.filter((r) => photos[r.id]) : regs;
  const faces = chosen.map((r) => ({
    key: r.id,
    face: cardFace(workshop, { ...r, photo: photos[r.id] || '' }),
  }));
  const pages = paginateCards(faces);
  const missing = regs.length - regs.filter((r) => photos[r.id]).length;
  const theme = cardTheme(workshop);

  return (
    <main>
      <div className="page-head no-print">
        <div>
          <h1>ID cards</h1>
          <div className="count" style={{ marginTop: 4 }}>
            {chosen.length} card{chosen.length === 1 ? '' : 's'} · {pages.length * 2} sheet
            {pages.length * 2 === 1 ? '' : 's'} · {theme.label}
          </div>
        </div>
        <span className="spacer" />
        <div className="btn-row">
          <Link className="btn" to={`/w/${id}`}>← Workshop</Link>
          <button disabled={!chosen.length} onClick={() => window.print()}>
            Print / Save as PDF
          </button>
        </div>
      </div>

      <div className="panel no-print">
        <h2>Before you print</h2>
        <ul style={{ margin: '8px 0 0 18px', fontSize: 14, lineHeight: 1.75 }}>
          <li>
            Fronts and backs come out on <strong>separate sheets, in the same order</strong>.
            Print single-sided, cut both, then pair them into the pouches.
          </li>
          <li>
            {CARDS_PER_SHEET} cards to an A4 sheet. In the print dialog set scale to{' '}
            <strong>100%</strong> — "fit to page" will shrink them off card size.
          </li>
          <li>Turn on background graphics, or the coloured bands print white.</li>
          {missing > 0 && (
            <li>
              <strong>{missing}</strong> of {regs.length} {missing === 1 ? 'card has' : 'cards have'}{' '}
              no photograph and will print with an empty box. Add one from the card's own page.
            </li>
          )}
        </ul>

        {missing > 0 && (
          <label className="check" style={{ marginTop: 12 }}>
            <input
              type="checkbox"
              checked={withPhotosOnly}
              onChange={(e) => setWithPhotosOnly(e.target.checked)}
            />
            <span>Only print the {regs.length - missing} with a photograph</span>
          </label>
        )}
      </div>

      {chosen.length === 0 ? (
        <div className="empty">
          {regs.length === 0 ? 'No registrations yet.' : 'Nobody has a photograph yet.'}
        </div>
      ) : (
        <div className="idc-scope">
          {pages.map((page, i) => (
            <div key={`f${i}`} className="idc-sheet">
              <div className="idc-sheet-head no-print">
                <span>{workshop.title}</span>
                <span>Fronts · sheet {i + 1} of {pages.length}</span>
              </div>
              <div className="idc-grid">
                {page.map(({ key, face }) => <IdCardFront key={key} face={face} />)}
              </div>
            </div>
          ))}

          {pages.map((page, i) => (
            <div key={`b${i}`} className="idc-sheet">
              <div className="idc-sheet-head no-print">
                <span>{workshop.title}</span>
                <span>Backs · sheet {i + 1} of {pages.length}</span>
              </div>
              <div className="idc-grid">
                {page.map(({ key, face }) => <IdCardBack key={key} face={face} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
