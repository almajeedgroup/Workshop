/** Line icons, 24px grid, currentColor — no icon font, nothing external. */
const base = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' };

export const IconSpark = (p) => (
  <svg {...base} {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" /><circle cx="12" cy="12" r="3.2" /></svg>
);
export const IconBook = (p) => (
  <svg {...base} {...p}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v14H6.5A2.5 2.5 0 0 0 4 19.5z" /><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H19v4H6.5A2.5 2.5 0 0 1 4 19.5z" /></svg>
);
export const IconBulb = (p) => (
  <svg {...base} {...p}><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5.9 1.1 1 1.7l.1.5h5l.1-.5c.1-.6.4-1.2 1-1.7A6 6 0 0 0 12 3z" /></svg>
);
export const IconShield = (p) => (
  <svg {...base} {...p}><path d="M12 3 5 6v5.5c0 4.3 2.9 8.2 7 9.5 4.1-1.3 7-5.2 7-9.5V6z" /><path d="m9 12 2 2 4-4" /></svg>
);
export const IconQr = (p) => (
  <svg {...base} {...p}><rect x="3" y="3" width="7" height="7" rx="1.2" /><rect x="14" y="3" width="7" height="7" rx="1.2" /><rect x="3" y="14" width="7" height="7" rx="1.2" /><path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20h1" /></svg>
);
export const IconCheck = (p) => (
  <svg {...base} {...p}><path d="m4.5 12.5 5 5 10-11" /></svg>
);
export const IconCheckCircle = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="m8 12.4 2.7 2.7L16 9" /></svg>
);
export const IconAlert = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.3v.2" /></svg>
);
export const IconArrow = (p) => (
  <svg {...base} width="18" height="18" {...p}><path d="M5 12h13M12.5 6l6 6-6 6" /></svg>
);
export const IconPhone = (p) => (
  <svg {...base} {...p}><path d="M6.2 3.5h3l1.5 4-2.1 1.4a12 12 0 0 0 5.5 5.5l1.4-2.1 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.2 5.7a2 2 0 0 1 2-2.2z" /></svg>
);
export const IconMail = (p) => (
  <svg {...base} {...p}><rect x="3" y="5" width="18" height="14" rx="2.2" /><path d="m3.5 6.5 8.5 6 8.5-6" /></svg>
);
export const IconPin = (p) => (
  <svg {...base} {...p}><path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11z" /><circle cx="12" cy="10" r="2.6" /></svg>
);
export const IconUsers = (p) => (
  <svg {...base} {...p}><circle cx="9" cy="8" r="3.4" /><path d="M2.8 20a6.2 6.2 0 0 1 12.4 0" /><path d="M16.5 5.2a3.4 3.4 0 0 1 0 5.6M17.6 14.4A6.2 6.2 0 0 1 21.2 20" /></svg>
);
export const IconAward = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="9" r="5.5" /><path d="m8.5 13.8-1.3 7 4.8-2.6 4.8 2.6-1.3-7" /></svg>
);
