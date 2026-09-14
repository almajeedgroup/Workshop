/**
 * Every feature this system has, written down once.
 *
 * The landing site is supposed to list what WORKSHOP does. Left to prose,
 * that list rots the first week somebody ships something — a page written in
 * March describes an app that stopped existing in April, and nobody notices
 * because no test reads English.
 *
 * So the list lives here, as data, and the pages are generated from it. One
 * entry is one feature and one URL. A test asserts every entry has a page and
 * that the hub links to all of them, which turns "we documented the feature"
 * into something that fails a build rather than something somebody remembers.
 *
 * NO JSX AND NO IMPORTS. This file has to be readable by `node --test` with
 * nothing but Node, the same as schema.js. Icons are named here as strings
 * and resolved to components by whatever renders them.
 *
 * ── ON WRITING THESE ─────────────────────────────────────────────────────
 * Each entry carries `limits` as well as `points`. A features page that only
 * says yes is a sales sheet, and the first person to hit the wall it never
 * mentioned stops believing the rest of it. Where this app cannot do
 * something — there is no server, so several things it cannot do — the page
 * says so in the same typeface as everything else.
 */

/** The arc of a course, which is also how the hub is grouped. */
export const FEATURE_GROUPS = [
  { key: 'before', label: 'Before the course', blurb: 'Filling the room, and knowing who is in it.' },
  { key: 'during', label: 'While it runs', blurb: 'The days themselves, in person or online.' },
  { key: 'after', label: 'After it ends', blurb: 'What the participant keeps, and what anyone can check.' },
  { key: 'across', label: 'Across everything', blurb: 'The office view — one register, on paper or on screen.' },
];

export const FEATURES = [
  /* ---------------------------------------------------------------- */
  {
    slug: 'registration',
    group: 'before',
    name: 'Registration',
    icon: 'users',
    tagline: 'A link on the poster, and the register fills itself.',
    lede:
      'Every course gets a public page of its own. Share the link, and people enter their own '
      + 'details — correctly spelt, because they are the ones spelling them.',
    sections: [
      {
        h: 'A submission is an application, not a seat',
        p: 'Anyone with the link can submit the form, so a submission lands in its own holding '
          + 'area that nobody can read back — not even the person who sent it. An organiser '
          + 'reviews it and accepts it, and only then does it become a registration with a '
          + 'ticket number. The register stays clean, and no seat is ever taken by a form.',
      },
      {
        h: 'The public page shows what a poster would show',
        p: 'It is built from a whitelist of fields, not from the course record. Internal notes, '
          + 'fee collection and every counter the office keeps are in the course record and '
          + 'stay there. Closing registration is one switch, and the page then says so instead '
          + 'of quietly accepting more people.',
      },
      {
        h: 'A hybrid course asks which way they are coming',
        p: 'A course that runs both in the hall and on a video link needs to know who '
          + 'is in which, before it prints an attendance sheet or counts chairs. The form '
          + 'asks on hybrid courses and nowhere else — on a course that is wholly one or '
          + 'the other, offering the choice can only collect a wrong answer. Somebody who '
          + 'has not said reads as not said, rather than being quietly counted as either.',
      },
      {
        h: 'Duplicates are caught while they are still cheap',
        p: 'The same person applying twice, or applying when they are already enrolled, is '
          + 'flagged at the point of acceptance — matched on phone, then email, then name with '
          + 'date of birth. A name alone is never treated as an identity, because there are '
          + 'two Mohammed Khans.',
      },
    ],
    points: [
      'One shareable registration link per course',
      'Applications reviewed before a ticket is issued',
      'On a hybrid course, the student says whether they are coming in person or online',
      'Registration opens and closes with a single switch',
      'Duplicate and already-enrolled applicants flagged',
      'Paste or import an existing list instead, when there is one',
    ],
    limits: [
      'Submissions are not readable by whoever sent them — there is no account to sign in to, by design.',
      'Nothing is emailed automatically. Someone contacts the applicant, and the system records that they were accepted.',
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    slug: 'tickets',
    group: 'before',
    name: 'Tickets and payments',
    icon: 'book',
    tagline: 'One number that follows a person through the course.',
    lede:
      'Every accepted registration is issued a ticket — a printable half-page with an ID, the '
      + 'course details and what is owed. It is the same ID used on the register, the ID card '
      + 'and the attendance sheet.',
    sections: [
      {
        h: 'Numbers that cannot collide',
        p: 'A ticket is the course prefix and a running number, allocated inside a database '
          + 'transaction. Two organisers importing two lists at the same moment cannot be '
          + 'handed the same number, which is the sort of thing that is invisible until the '
          + 'day two people turn up holding AIHOW26-014.',
      },
      {
        h: 'Fees, without a payment gateway',
        p: 'The system records what a course costs, what each person has paid and what is '
          + 'outstanding, and totals it. Money changes hands the way it already did — in the '
          + 'office, by transfer, by UPI. A free course is free, not unpaid, and is never '
          + 'counted as an arrear.',
      },
      {
        h: 'Shareable as a message',
        p: 'A ticket can be printed, or sent as a message with the same wording, so somebody '
          + 'with no printer still arrives with their number.',
      },
    ],
    points: [
      'Sequential ticket IDs, allocated transactionally',
      'Printable ticket and receipt on one half-page',
      'Paid, part-paid and outstanding tracked per person',
      'Free courses treated as free, never as unpaid',
      'Totals collected and outstanding, per course',
    ],
    limits: [
      'No card processing. This records payments; it does not take them.',
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    slug: 'online-classes',
    group: 'during',
    name: 'Online classes',
    icon: 'video',
    tagline: 'A video room for the course, on the school’s own page.',
    lede:
      'Each course can hold its sessions in a Jitsi Meet room — open source, and free on the '
      + 'public server. Students join from a page that already knows who they are, and the '
      + 'presenter keeps the register open beside the class.',
    sections: [
      {
        h: 'Room names are minted, never typed',
        p: 'A Jitsi room has no guest list: anyone who knows the name can walk in, and a room '
          + 'called physics-class on a public server will be walked into by strangers. So the '
          + 'name carries eighty bits of randomness behind a readable prefix, and the lobby is '
          + 'the second lock — the one that still works after a link has been forwarded.',
      },
      {
        h: 'Joining checks the register',
        p: 'A student opens the course’s join page and gives their ticket number or their '
          + 'phone. If they are on the register and the class is open, they are let through '
          + 'with their own name already filled in. If they are not, they are told who to '
          + 'call rather than left at a blank screen.',
      },
      {
        h: 'Embedded, or launched',
        p: 'The room runs inside the page by default. Because the free public Jitsi server '
          + 'limits embedded calls, a course can instead launch the room in its own tab in one '
          + 'press — the same room, the same lobby, no time limit. The choice is a setting, '
          + 'and the page says which way it is set.',
      },
    ],
    points: [
      'Unguessable room names with a lobby',
      'Join by ticket number or phone, checked against the register',
      'Presenter controls: mute all, lobby, share screen, end for all',
      'Embedded in the page, or launched in its own tab',
      'Works on a phone browser without an app',
    ],
    limits: [
      'The public Jitsi server cuts embedded calls short. For long online courses, run them in launch mode or on your own Jitsi instance.',
      'There is no attendance taken automatically from the video room — attendance is marked by a person.',
    ],
    link: { to: '/programmes', label: 'See which programmes run online' },
  },

  /* ---------------------------------------------------------------- */
  {
    slug: 'class-record',
    group: 'during',
    name: 'The class record',
    icon: 'mic',
    tagline: 'Notes, a transcript and handouts, written while the class runs.',
    lede:
      'A live class is the one thing this system produces that vanishes when it ends. Three '
      + 'things are captured as it happens, so nobody has to remember afterwards.',
    sections: [
      {
        h: 'Shared notes',
        p: 'One page the presenter types on and the class reads live. A student who joins late '
          + 'sees everything already written, and the notes stay attached to the course after '
          + 'the session closes.',
      },
      {
        h: 'A transcript, taken as it is said',
        p: 'The browser’s speech recogniser writes down what the presenter’s microphone hears, '
          + 'line by line, with the time against each. It is searchable afterwards and can be '
          + 'printed with the notes. It hears the presenter, not the students — a lecture '
          + 'transcribes well, a discussion does not, and the screen says so.',
      },
      {
        h: 'Handouts, live',
        p: 'A link or a small PDF appears for everybody at once, mid-sentence, without leaving '
          + 'the class. Large files are shared as a link instead, because there is nowhere here '
          + 'to upload them to.',
      },
      {
        h: 'Recording',
        p: 'The presenter can record the session. It is recorded in their own browser and saved '
          + 'to their own computer — this system has no server and nowhere to put an hour of '
          + 'video, which is stated on the button rather than discovered afterwards.',
      },
    ],
    points: [
      'Live shared notes, kept with the course',
      'Automatic transcript with timestamps',
      'Handouts and PDFs pushed to everyone mid-class',
      'Session recording, saved to the presenter’s computer',
      'Everything printable once the class ends',
    ],
    limits: [
      'The transcript is of the presenter’s microphone only.',
      'Recordings are not uploaded anywhere — they are saved locally by the presenter.',
      'A shared PDF must be small; anything larger is shared as a link.',
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    slug: 'attendance',
    group: 'during',
    name: 'Attendance',
    icon: 'clipboard',
    tagline: 'On screen for the office, on paper for the room.',
    lede:
      'Mark each person present, late or absent for each day of the course — and print the '
      + 'sheet the room actually signs.',
    sections: [
      {
        h: 'A sheet built to be written on',
        p: 'It prints portrait, with rows tall enough for a pen and signature boxes wide '
          + 'enough for a real signature. The heading repeats on every page, because an '
          + 'unsigned second page with no course name on it is worth nothing. The presenter '
          + 'signs underneath to say they were there.',
      },
      {
        h: 'Marks that mean something',
        p: 'Present, late, absent, or not yet marked — kept apart, so a day nobody got round '
          + 'to marking never reads as a room full of absentees. Totals and per-person '
          + 'percentages follow from the marks.',
      },
      {
        h: 'Attendance feeds the certificate',
        p: 'When awards are allotted at the end of a course, who attended is already known, '
          + 'so the decision is a review rather than a reconstruction.',
      },
    ],
    points: [
      'Present · late · absent · unmarked, per day',
      'Online students marked on the sheet, so a blank box is not read as an absence',
      'Portrait sheet with signature columns for up to six days',
      'Heading repeats on every printed page',
      'Per-person and per-day totals',
      'Exports with the rest of the course data',
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    slug: 'id-cards',
    group: 'during',
    name: 'ID cards',
    icon: 'card',
    tagline: 'Card-sized, lanyard-ready, printed a sheet at a time.',
    lede:
      'Every participant gets a CR80 portrait card — 54 x 85.6mm, a bank card turned on its '
      + 'end, which is the size every lanyard holder on sale is cut for.',
    sections: [
      {
        h: 'Decided once, for the whole course',
        p: 'The colourway and which organisations’ crests appear are settled when the course '
          + 'is established. Every card printed for that course then matches, without anybody '
          + 'deciding again at the printer.',
      },
      {
        h: 'Front is the person, back is the course',
        p: 'Photograph, name, ticket number and blood group on the front; course, dates, venue '
          + 'and who to call on the back. Print one card for the person who arrived late, or '
          + 'the whole course laid out on sheets.',
      },
    ],
    points: [
      'CR80 portrait, cut to standard lanyard size',
      'Several colourways, chosen per course',
      'Photograph, ticket number and blood group',
      'Single card or a full sheet',
      'Identical on screen and on paper',
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    slug: 'certificates',
    group: 'after',
    name: 'Certificates',
    icon: 'award',
    tagline: 'Four awards, one design, a register behind every one.',
    lede:
      'Completion, participation, excellence and appreciation — awarded per person at the end '
      + 'of a course, each with its own ID and a QR code that leads to the register.',
    sections: [
      {
        h: 'Allotted in one pass',
        p: 'At the end of a course the whole register is on one screen with attendance beside '
          + 'each name. Choose the award for each person, issue them together, and every '
          + 'certificate is created with its number, its date and its record in the same '
          + 'moment.',
      },
      {
        h: 'It records who issued it',
        p: 'Each certificate stores the name of the body that awarded it at the time it was '
          + 'awarded. A school renames itself, merges, or takes on a new partner; a '
          + 'certificate from 2025 must still say what it said in 2025. Telling somebody '
          + 'checking an old award that it came from an institution that did not exist yet is '
          + 'the exact failure verification exists to prevent.',
      },
      {
        h: 'Withdrawal is stated, not erased',
        p: 'A certificate issued in error can be withdrawn. It does not vanish from the '
          + 'register — checking it says plainly that it was issued and has since been '
          + 'withdrawn, with the reason. A certificate that silently disappears teaches '
          + 'everybody to distrust the register.',
      },
    ],
    points: [
      'Four kinds of award, one consistent design',
      'Unique certificate ID and QR on every one',
      'Issued for a whole course in a single pass',
      'The issuing body recorded on the certificate itself',
      'Withdrawal recorded openly, with a reason',
    ],
    link: { to: '/certificates', label: 'How our certificates work' },
  },

  /* ---------------------------------------------------------------- */
  {
    slug: 'verification',
    group: 'after',
    name: 'Verification',
    icon: 'shield',
    tagline: 'Anyone can check one. No account, no phone call, no waiting.',
    lede:
      'Anyone can print a certificate. A certificate worth having is one the person reading it '
      + 'can check themselves, in seconds, without taking anybody’s word for it.',
    sections: [
      {
        h: 'Type the ID, or scan the code',
        p: 'The ID is printed at the bottom left of every certificate and the QR code sits '
          + 'beside it. A college admissions officer or an employer points a phone at it and '
          + 'has an answer before the page finishes loading.',
      },
      {
        h: 'A plain answer',
        p: 'Genuine, withdrawn, or never issued — with the award, the programme, the dates and '
          + 'who issued it. Nothing hedged, and nothing that requires interpretation.',
      },
      {
        h: 'Nothing private is shown',
        p: 'No phone number, date of birth or address appears on a verification page, and the '
          + 'register cannot be searched by name — only a certificate ID someone is already '
          + 'holding will open a record. Checking a certificate must not become a way to look '
          + 'people up.',
      },
    ],
    points: [
      'Free, instant, and needs no account',
      'Works by typed ID or by QR code',
      'Says genuine, withdrawn or not found — plainly',
      'Shows other awards held by the same person',
      'Never shows contact details, and cannot be searched by name',
    ],
    link: { to: '/verify', label: 'Check a certificate now' },
  },

  /* ---------------------------------------------------------------- */
  {
    slug: 'records',
    group: 'across',
    name: 'Records and people',
    icon: 'search',
    tagline: 'One search box, every course, and the students who keep coming back.',
    lede:
      'The app is organised by course, which is right — a course is the thing that gets run and '
      + 'paid for. But the question that comes over the phone never is.',
    sections: [
      {
        h: 'Search from anywhere',
        p: '"Adifaah says she registered", "who is AIHOW26-014", or a WhatsApp number with no '
          + 'name attached. One box searches every course at once and ranks the certainties '
          + 'first: a ticket number typed in full is somebody reading off a ticket, not a '
          + 'guess. Open a result and their whole record appears over the page, without losing '
          + 'where you were.',
      },
      {
        h: 'Students, not registrations',
        p: 'Somebody who has come to three courses used to be three unrelated rows. They are '
          + 'now one person with three enrolments, matched the same way duplicates are — so a '
          + 'returning student is recognised rather than greeted like a stranger, and the '
          + 'office can finally answer who keeps coming back.',
      },
      {
        h: 'Bring last term’s students to the next course',
        p: 'Pick a previous course, tick the people you want — one, several, or all of them — '
          + 'and they are enrolled here in a single press. Their name and how to reach them '
          + 'come across, because those are facts about a person. Their old ticket number, '
          + 'what they paid and last term’s notes do not: everyone starts the new course '
          + 'with a new ticket and nothing owed that nobody has collected. Anybody already '
          + 'registered here is shown as such and left alone.',
      },
    ],
    points: [
      'Search by name, ticket number, phone or anything on the record',
      'Results open over the page as an overlay',
      'One profile per student, across every course they have attended',
      'Returning students identified automatically',
      'Carry any selection of a previous course onto the next one',
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    slug: 'printing',
    group: 'across',
    name: 'Exports and printing',
    icon: 'printer',
    tagline: 'Everything on screen comes off the printer looking deliberate.',
    lede:
      'Registers, tickets, ID cards, attendance sheets and certificates each print at their own '
      + 'size and orientation, from the same page you are looking at.',
    sections: [
      {
        h: 'Each document knows its own paper',
        p: 'The attendance sheet is portrait, the certificate landscape, the ID card CR80, the '
          + 'ticket a half-page. They are all in one app, and each one sets its own page rather '
          + 'than inheriting whatever printed last — verified by measuring the produced PDF, '
          + 'not by looking at it.',
      },
      {
        h: 'Spreadsheets, written here',
        p: 'Export a course, or everything, to .xlsx or .csv. The registrations sheet carries '
          + 'the course details joined onto each row so it stands on its own in somebody '
          + 'else’s hands. The file is built in your browser; nothing is uploaded to produce '
          + 'it.',
      },
      {
        h: 'Pasted lists come in',
        p: 'An existing list in a spreadsheet or a WhatsApp message can be pasted in and read '
          + 'into the register, with phone numbers normalised and duplicates flagged before '
          + 'anything is saved.',
      },
    ],
    points: [
      'Correct paper size and orientation per document',
      'Excel and CSV export, generated in the browser',
      'Course details joined onto every exported row',
      'Paste or import an existing list',
      'Print headings carry the brand and the association',
    ],
    limits: [
      'Exports are generated on your machine and downloaded — they are never sent anywhere.',
    ],
  },
];

/** Every slug, in catalogue order. */
export const FEATURE_SLUGS = FEATURES.map((f) => f.slug);

/** One feature by slug, or undefined. Case-insensitive; a URL may be shouted. */
export function featureBySlug(slug) {
  const key = String(slug ?? '').trim().toLowerCase();
  return FEATURES.find((f) => f.slug === key);
}

/** The features in one group, in catalogue order. */
export function featuresInGroup(key) {
  return FEATURES.filter((f) => f.group === key);
}

/** The group a feature belongs to, as a whole record. */
export function groupOf(feature) {
  return FEATURE_GROUPS.find((g) => g.key === feature?.group) || null;
}

/**
 * What comes before and after a feature, for the foot of its page.
 *
 * Somebody reading about attendance is reading the manual, and a manual with
 * no next page sends them back to the index every time.
 */
export function featureNeighbours(slug) {
  const i = FEATURE_SLUGS.indexOf(String(slug ?? '').trim().toLowerCase());
  if (i < 0) return { prev: null, next: null };
  return {
    prev: i > 0 ? FEATURES[i - 1] : null,
    next: i < FEATURES.length - 1 ? FEATURES[i + 1] : null,
  };
}

/** The path a feature lives at. One definition, used by pages and tests alike. */
export function featurePath(feature) {
  return `/features/${typeof feature === 'string' ? feature : feature.slug}`;
}
