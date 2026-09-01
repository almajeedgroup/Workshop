import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  getPublicWorkshop, submitRegistrationRequest, upiLink,
} from '../../lib/publicdb.js';
import { formatDateRange } from '../../lib/tickets.js';
import { normalizePhone } from '../../lib/parser.js';
import { ISSUER, CURRENCY, isFreeWorkshop } from '../../lib/schema.js';
import QrCode from '../../components/QrCode.jsx';
import {
  IconCheckCircle, IconAlert, IconArrow, IconPin, IconUsers, IconShield,
} from '../../components/site/Icons.jsx';

const FIELDS = [
  { key: 'name', label: 'Full name', required: true, autoComplete: 'name' },
  { key: 'whatsapp', label: 'WhatsApp number', required: true, type: 'tel', autoComplete: 'tel',
    hint: 'Your ticket and receipt come to this number.' },
  { key: 'dob', label: 'Date of birth', type: 'date' },
  { key: 'qualification', label: 'Class / qualification' },
  { key: 'courseName', label: 'Course or stream' },
  { key: 'area', label: 'Area', autoComplete: 'address-level2' },
  { key: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
];

export default function RegisterPage() {
  const { workshopId } = useParams();

  const [workshop, setWorkshop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState(() =>
    Object.fromEntries([...FIELDS.map((f) => [f.key, '']), ['paymentRef', ''], ['hp', '']])
  );
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [done, setDone] = useState(null);
  // The QR image is configured by path. If the file is not there yet, fall
  // back rather than showing a broken image on a payment screen.
  const [qrBroken, setQrBroken] = useState(false);

  useEffect(() => {
    let live = true;
    getPublicWorkshop(workshopId)
      .then((w) => {
        if (!live) return;
        if (!w) setLoadError('That registration link is not valid.');
        else setWorkshop(w);
      })
      .catch((e) => live && setLoadError(e.message))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [workshopId]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const free = isFreeWorkshop(workshop);
  const fee = free ? 0 : workshop?.feeAmount;
  // A bank-issued QR (BharatQR, a merchant standee) is an image and carries
  // card rails a plain UPI link cannot, so it wins where both are set.
  const qrImage = qrBroken ? '' : (workshop?.paymentQrUrl || '');
  const pay = useMemo(() => (workshop?.paymentUpi ? upiLink({
    upiId: workshop.paymentUpi,
    name: ISSUER.upiName || ISSUER.name,
    amount: fee || '',
    note: `${workshop.title || 'Workshop'} fee`.slice(0, 40),
  }) : ''), [workshop, fee]);

  const phoneOk = normalizePhone(form.whatsapp).length >= 10;
  const canSend = form.name.trim().length > 1 && phoneOk && !sending;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSend) return;
    setSending(true);
    setSendError('');
    try {
      const { ref } = await submitRegistrationRequest(workshopId, form);
      setDone({ ref, name: form.name.trim() });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setSendError(
        /permission/i.test(err.message)
          ? 'Registration for this workshop is closed.'
          : `Could not send your registration: ${err.message}`
      );
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <section className="tight"><div className="wrap"><p>Loading…</p></div></section>;
  }

  if (loadError || !workshop) {
    return (
      <section className="tight">
        <div className="wrap">
          <div className="verdict bad">
            <span className="vico"><IconAlert /></span>
            <div>
              <h3>Link not valid</h3>
              <p>{loadError || 'That workshop could not be found.'}</p>
            </div>
          </div>
          <p style={{ marginTop: 18 }}>
            Check the QR code or link on the poster, or call {ISSUER.phones.join(' or ')}.
          </p>
          <div style={{ marginTop: 20 }}><Link className="btn" to="/">Go to the school site</Link></div>
        </div>
      </section>
    );
  }

  /* ---------------- confirmation ---------------- */
  if (done) {
    const receipt = [
      `*${ISSUER.name.toUpperCase()}*`, ISSUER.unitLine, '',
      '*REGISTRATION RECEIVED*',
      `*Reference:* ${done.ref}`, `*Name:* ${done.name}`,
      `*Workshop:* ${workshop.title}`,
      formatDateRange(workshop) ? `*Date:* ${formatDateRange(workshop)}` : '',
      workshop.venue ? `*Venue:* ${workshop.venue}` : '',
      fee ? `*Fee:* ${CURRENCY}${fee}` : '',
      form.paymentRef ? `*Payment reference:* ${form.paymentRef}` : '',
      '', 'Your seat is confirmed once the office checks the payment.',
      'Your ticket will be sent to this number.',
      `Enquiries: ${ISSUER.phones.join(' / ')}`,
    ].filter(Boolean).join('\n');

    const toOffice = `https://wa.me/${normalizePhone(ISSUER.phones[0])}?text=${encodeURIComponent(receipt)}`;

    return (
      <section className="tight">
        <div className="wrap">
          <div className="verdict good" data-reveal>
            <span className="vico"><IconCheckCircle /></span>
            <div>
              <h3>Registration received</h3>
              <p>Thank you, {done.name}. Keep the reference below.</p>
            </div>
          </div>

          <div className="card" style={{ marginTop: 'var(--gap)', maxWidth: 620 }}>
            <span className="eyebrow" style={{ marginBottom: 10 }}>Your reference</span>
            <p style={{
              fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace',
              fontSize: 26, fontWeight: 700, color: 'var(--ink)', letterSpacing: '.04em',
            }}>
              {done.ref}
            </p>
            <dl className="dl" style={{ marginTop: 18 }}>
              <dt>Name</dt><dd>{done.name}</dd>
              <dt>Workshop</dt><dd>{workshop.title}</dd>
              {formatDateRange(workshop) && <><dt>Dates</dt><dd>{formatDateRange(workshop)}</dd></>}
              {workshop.venue && <><dt>Venue</dt><dd>{workshop.venue}</dd></>}
              <dt>Fee</dt><dd>{free ? 'Free' : fee ? `${CURRENCY}${fee}` : '—'}</dd>
            </dl>

            <p style={{ marginTop: 18, fontSize: 14.5 }}>
              {free
                ? 'Your seat is confirmed once the office has reviewed your entry. The ticket comes to your WhatsApp number.'
                : 'Your seat is confirmed once the office has checked the payment. The ticket comes to your WhatsApp number.'}
            </p>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 22 }}>
              <a className="btn" href={toOffice} target="_blank" rel="noreferrer">
                Send a copy to the office <IconArrow />
              </a>
              <button className="btn ghost" type="button" onClick={() => window.print()}>
                Save this receipt
              </button>
            </div>
            <p style={{ marginTop: 14, fontSize: 12.5, color: 'var(--ink-faint)' }}>
              Sending a copy on WhatsApp helps the office match your payment to your
              registration faster. It is not required.
            </p>
          </div>
        </div>
      </section>
    );
  }

  /* ---------------- the form ---------------- */
  const closed = !workshop.registrationOpen;

  return (
    <>
      <section className="hero tight">
        <div className="wrap">
          <div style={{ maxWidth: 760 }} data-reveal>
            <span className="eyebrow">Registration</span>
            <h1 className="display" style={{ fontSize: 'clamp(28px,4.4vw,46px)' }}>
              {workshop.title}
            </h1>
            <div className="tri" style={{ marginTop: 20 }}><i /><i /><i /></div>

            <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', marginTop: 22 }}>
              {formatDateRange(workshop) && (
                <span style={{ fontSize: 15, fontWeight: 600 }}>{formatDateRange(workshop)}</span>
              )}
              {workshop.time && <span style={{ fontSize: 15, color: 'var(--ink-soft)' }}>{workshop.time}</span>}
              {workshop.venue && (
                <span style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 15, color: 'var(--ink-soft)' }}>
                  <IconPin width="17" height="17" />{workshop.venue}
                </span>
              )}
              {workshop.audience && (
                <span style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 15, color: 'var(--ink-soft)' }}>
                  <IconUsers width="17" height="17" />{workshop.audience}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      <section style={{ paddingTop: 0 }}>
        <div className="wrap">
          {closed ? (
            <div className="verdict bad">
              <span className="vico"><IconAlert /></span>
              <div>
                <h3>Registration is closed</h3>
                <p>
                  This workshop is no longer taking registrations. Call{' '}
                  {ISSUER.phones.join(' or ')} to ask about the next one.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="grid g2" style={{ alignItems: 'start' }}>
              {/* details */}
              <div className="card" data-reveal>
                <h3>Your details</h3>
                <p style={{ marginTop: 6, marginBottom: 18, fontSize: 14 }}>
                  Everything except name and WhatsApp number is optional.
                </p>

                {FIELDS.map((f) => (
                  <label key={f.key} style={{ display: 'block', marginBottom: 16 }}>
                    <span style={{
                      display: 'block', fontSize: 12, fontWeight: 600, letterSpacing: '.1em',
                      textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 6,
                    }}>
                      {f.label}{f.required && ' *'}
                    </span>
                    <input
                      type={f.type || 'text'}
                      value={form[f.key]}
                      required={f.required}
                      autoComplete={f.autoComplete}
                      onChange={(e) => set(f.key, e.target.value)}
                      style={{
                        font: 'inherit', fontSize: 16, width: '100%', padding: '12px 14px',
                        borderRadius: 11, border: '1.6px solid var(--hair-2)', background: '#fff',
                      }}
                    />
                    {f.hint && (
                      <span style={{ display: 'block', marginTop: 5, fontSize: 12.5, color: 'var(--ink-faint)' }}>
                        {f.hint}
                      </span>
                    )}
                  </label>
                ))}

                {/* Hidden from people; bots fill it and the server refuses the write. */}
                <input
                  type="text" tabIndex={-1} autoComplete="off" aria-hidden="true"
                  value={form.hp} onChange={(e) => set('hp', e.target.value)}
                  style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
                />
              </div>

              {/* payment — a free course shows none of this */}
              <div className="card" data-reveal>
                <h3>{free ? 'Fee' : 'Payment'}</h3>
                {free ? (
                  <p style={{ marginTop: 6, fontSize: 15 }}>
                    This is a <strong style={{ color: 'var(--ink)' }}>free</strong> programme.
                    Nothing is payable — just send the form.
                  </p>
                ) : fee ? (
                  <p style={{ marginTop: 6, fontSize: 15 }}>
                    Registration fee <strong style={{ color: 'var(--ink)' }}>{CURRENCY}{fee}</strong>.
                  </p>
                ) : (
                  <p style={{ marginTop: 6, fontSize: 15 }}>No fee is payable for this workshop.</p>
                )}

                {free ? null : qrImage ? (
                  <div style={{
                    marginTop: 18, padding: 14, borderRadius: 14, background: '#fff',
                    border: '1px solid var(--hair)', textAlign: 'center',
                  }}>
                    <img
                      src={qrImage}
                      alt="Payment QR code"
                      onError={() => setQrBroken(true)}
                      style={{ width: '100%', maxWidth: 320, height: 'auto', display: 'block', margin: '0 auto' }}
                    />
                    <p style={{ marginTop: 12, fontSize: 13.5, color: 'var(--ink-soft)' }}>
                      Scan with any UPI or banking app{fee ? <> and pay <strong style={{ color: 'var(--ink)' }}>{CURRENCY}{fee}</strong></> : null}.
                    </p>
                    <p style={{ marginTop: 6, fontSize: 12.5, color: 'var(--ink-faint)' }}>
                      The amount is not filled in automatically — please enter it yourself.
                    </p>
                  </div>
                ) : pay ? (
                  <>
                    <div style={{
                      marginTop: 18, padding: 18, borderRadius: 14, background: '#fff',
                      border: '1px solid var(--hair)', textAlign: 'center',
                    }}>
                      <QrCode
                        value={pay}
                        title="UPI payment QR code"
                        style={{ width: 190, height: 190, maxWidth: '100%', color: 'var(--ink)' }}
                      />
                      <p style={{ marginTop: 12, fontSize: 13, color: 'var(--ink-faint)' }}>
                        Scan with any UPI app — the amount is already filled in
                      </p>
                      <p style={{
                        marginTop: 4, fontSize: 13.5, fontWeight: 600, color: 'var(--ink)',
                        fontFamily: 'ui-monospace,Menlo,monospace', wordBreak: 'break-all',
                      }}>
                        {workshop.paymentUpi}
                      </p>
                    </div>
                    <a className="btn ghost" href={pay} style={{ width: '100%', marginTop: 12 }}>
                      Open my UPI app
                    </a>
                  </>
                ) : (
                  <div className="verdict" style={{ marginTop: 16, padding: 16 }}>
                    <div>
                      <p style={{ fontSize: 14.5 }}>
                        Payment details will be sent to you. Call {ISSUER.phones.join(' or ')} if
                        you would like to pay now.
                      </p>
                    </div>
                  </div>
                )}

                <label style={{ display: free ? 'none' : 'block', marginTop: 20 }}>
                  <span style={{
                    display: 'block', fontSize: 12, fontWeight: 600, letterSpacing: '.1em',
                    textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 6,
                  }}>
                    Payment reference
                  </span>
                  <input
                    value={form.paymentRef}
                    onChange={(e) => set('paymentRef', e.target.value)}
                    placeholder="UTR or transaction ID"
                    style={{
                      font: 'inherit', fontSize: 16, width: '100%', padding: '12px 14px',
                      borderRadius: 11, border: '1.6px solid var(--hair-2)', background: '#fff',
                    }}
                  />
                  <span style={{ display: 'block', marginTop: 5, fontSize: 12.5, color: 'var(--ink-faint)' }}>
                    Optional, but it helps the office match your payment straight away.
                  </span>
                </label>

                {sendError && (
                  <div className="verdict bad" style={{ marginTop: 18, padding: 16 }}>
                    <span className="vico"><IconAlert /></span>
                    <div><p>{sendError}</p></div>
                  </div>
                )}

                <button className="btn" type="submit" disabled={!canSend} style={{ width: '100%', marginTop: 20 }}>
                  {sending ? 'Sending…' : 'Complete registration'} <IconArrow />
                </button>
                {!phoneOk && form.whatsapp && (
                  <p style={{ marginTop: 10, fontSize: 13, color: 'var(--saffron-2)' }}>
                    That does not look like a complete mobile number.
                  </p>
                )}

                <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', marginTop: 18 }}>
                  <IconShield width="16" height="16" style={{ color: 'var(--ink-faint)', flex: 'none', marginTop: 2 }} />
                  <span style={{ fontSize: 12.5, color: 'var(--ink-faint)', lineHeight: 1.6 }}>
                    Your details go only to the office. Nobody else can read what you submit,
                    and it never appears on the public site.
                  </span>
                </div>
              </div>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
