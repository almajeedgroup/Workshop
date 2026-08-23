# Workshops — Registration & Ticketing

Web app for **Beyond Guidance, a unit of Islamic Information Centre**, built by
**Al-Majeed School of Research Methodology & Innovation**.

Paste ordinary text — a promotional poster, or the WhatsApp registration replies
your team collects — and it is parsed into structured records, reviewed on
screen, stored in Firestore, and turned into tickets, receipts and spreadsheets.

- **Hosting / database:** Firebase Hosting + Cloud Firestore
- **Target domain:** `workshops.almajeedgroup.in`
- **Access:** email + password, administrators only. No self sign-up.
- **Parsing:** rule-based — no AI, no network calls, nothing leaves the browser

---

## 1. What it does

| | |
|---|---|
| **Import** | Paste the poster (emoji and all) or labelled text; review the parsed result; save. |
| **Register** | Paste WhatsApp replies in the `*Name:* …` format — as many as you like at once. |
| **Ticket** | Every registrant gets a sequential Ticket ID and a printable ticket + IIC payment receipt. |
| **Send** | One click opens WhatsApp or email with the ticket already written out. |
| **Contact** | Call or email any registrant directly from the list. |
| **Payments** | Mark Paid / Pending / Waived / Refunded inline; running totals and amount collected. |
| **Seats** | Seat limit tracked, with a warning when it is reached or exceeded. |
| **Duplicates** | A pasted candidate who is already registered is flagged before anything is saved. |
| **Delete** | Remove a single registration, or a whole workshop and everything under it. |
| **Certify** | Award Completion, Participation, Excellence or Appreciation certificates, in bulk, from the workshop's own screen. |
| **Verify** | Every certificate carries an ID and a QR code that anyone can check publicly, without an account. |
| **Export** | Excel, CSV, printable PDF — for all workshops, one workshop, or its registrations. |

---

## 2. Data model

```
workshops/{workshopId}
    title, code, ticketPrefix, startDate, endDate, time, durationHours,
    mode, venue, presentedBy, collaborators, resourcePersons[],
    coordinators[], audience, seatLimit, feeAmount, contactNumbers[],
    topics, outcome,
    lastTicketSeq, searchText, createdAt, updatedAt

    registrations/{registrationId}
        name, dob, qualification, courseName, whatsapp, area, email,
        paymentStatus, amountPaid, paymentMode, paymentRef,
        ticketId, notes, nameLower, searchText

admins/{uid}            <- the access allow-list, managed from the Console

certificates/{certificateId}    <- PUBLICLY READABLE, one at a time
    certificateId, type, typeLabel, recipientName,
    workshopId, workshopTitle, workshopDates, venue, presentedBy,
    ticketId, holderKey, issuedOn, revoked

holders/{holderKey}             <- PUBLICLY READABLE, the award history
    name, entries[]

holderIndex/{phone|email}       <- ADMIN ONLY, maps a person to their holderKey
```

**Everything is generated from [`src/lib/schema.js`](src/lib/schema.js)** — the
parser, the forms, the table columns, the Excel sheets, the ticket and the
receipt. To add, rename or remove a field, edit that one file.

Organisation names, phone numbers and the currency symbol live in the `ISSUER`
block at the top of the same file.

### Ticket IDs

`PREFIX-001`, `PREFIX-002`, … The prefix comes from the workshop's
**Ticket ID Prefix** field, or its code, or initials of the title plus the year
(`AI Hands-On Workshop` starting 2026 → `AHOW26`).

**A ticket ID never changes once issued.** Three things guarantee that:

- The prefix is worked out **once**, when the workshop is created, and stored on
  the workshop document. Renaming the workshop afterwards does not change it, so
  one event cannot end up with two different ticket series. (Clearing the
  **Ticket ID Prefix** field in the edit form restores the stored one rather
  than deriving a new one; type a different value if you genuinely want to
  change what *future* tickets look like.)
- Numbers are allocated inside a Firestore transaction against `lastTicketSeq`
  on the workshop, so two people importing at the same moment can never be
  handed the same number.
- `lastTicketSeq` only ever climbs. Deleting a registration **retires** its
  number — the next candidate gets a new one rather than inheriting a ticket
  someone else has already been sent.

Editing a registration never rewrites its ticket ID; the field is read-only
once allocated.

---

## 3. First-time setup

### 3.1 Create the Firebase project

1. <https://console.firebase.google.com> → **Add project**.
2. **Build → Firestore Database → Create database** → *Production mode* →
   location `asia-south1`.
3. **Build → Authentication → Get started → Email/Password → Enable.**
4. **Project settings → General → Your apps → Web (`</>`)** → register an app
   and copy the `firebaseConfig` values.

### 3.2 Configure

Copy `.env.example` to `.env` and paste in those values.

`.firebaserc` already names the project this app deploys to —
**`workshops-1649c`**. Change it there if you ever point at a different one.

> These config values are **not secret** — they ship inside the browser bundle
> by design. Security comes from the Firestore rules, not from hiding them.

`.env` is **not** in the repository, and the build will refuse to run without
it (see §4), so whoever deploys needs their own copy.

### 3.3 Install and run

```bash
npm install
```

```bash
npm run dev
```

### 3.4 Create the owner account

Signing in is *not* the same as being authorised. Firebase's Email/Password
provider lets anyone holding the public API key create an account, so the app
asks one question and only one:

> does a document exist at `admins/{uid}`?

That allow-list is the whole of authorisation. The permanent owner address gets
exactly one privilege, and it is **not** data access: it may create its own
`admins` record, which is what makes the very first sign-in work without anyone
hand-creating a document in the Console.

The owner account is **`almajeed.work@gmail.com`**, defined as
`BOOTSTRAP_ADMIN_EMAIL` in `src/lib/schema.js` **and** in `firestore.rules`.
Both copies must match — the rules file cannot import from JavaScript.

**Register that address before or immediately after deploying the rules:**

1. **Authentication → Users → Add user** → `almajeed.work@gmail.com` + a password.

On its first sign-in the app writes the owner's own record into `admins`, and
access begins from that moment. If the write fails — rules not deployed yet, no
connection — the app says so and you can sign out and in again to retry.

> Until that address is registered, the email is unclaimed. Anyone who knew the
> rule could register it, add themselves to the allow-list and inherit
> administrator access, so do this first.

Email verification is deliberately *not* required: accounts created from the
Firebase Console are unverified, which is how every account here is made.

### 3.5 Add other administrators

1. **Authentication → Users → Add user** — their email and password.
2. Copy the generated **User UID**.
3. **Firestore → Start collection** → ID `admins` → document ID = that UID →
   fields `email` and `name`.

To revoke access, delete their `admins` document. That works for the owner too,
but they can re-add themselves by signing in again — to remove them for good,
delete the account in **Authentication** as well, or change
`BOOTSTRAP_ADMIN_EMAIL` in both files and redeploy.

### 3.6 Hardening the deployment

`firebase.json` sends a Content-Security-Policy along with the usual
`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` and HSTS. The
policy is tight — no inline scripts, no framing — and lists the exact Google
origins the Firebase SDK needs, including `www.google.com` for the image
Firestore's transport uses to probe the connection.

It has been verified against a real build in Chromium, but **if you add a
Firebase feature** (Storage, Analytics, popup sign-in) its origin must be added
to `connect-src` or the call will be silently blocked. Check the browser
console for `Refused to connect` after any such change.

---

## 4. Deploy

```bash
npm run deploy
```

That runs `vite build` and deploys both the Firestore rules and the site.
First time only, run `firebase login` before it.

### Connect `workshops.almajeedgroup.in`

1. **Hosting → Add custom domain** → `workshops.almajeedgroup.in`.
2. Add the **TXT** record Firebase shows, at your DNS provider for
   `almajeedgroup.in`.
3. Once verified, add the two **A** records it gives you, on the host
   `workshops`.
4. SSL is issued automatically; allow up to 24 hours.

---

## 5. What the parser understands

| Input | Example |
|---|---|
| `Label: value` | `Venue: Kabir Independent PU College` |
| WhatsApp bold labels | `*Name:* Ayesha Siddiqua` |
| `Label - value` | `Topic - Academic Writing` |
| label with no separator | `held on 03/09/2025` |
| **poster emoji** | 📅 date · ⏰ time · 📍 venue · 💰 fee · 🎓 eligibility · 📱 contact · ⚠️ seat limit |
| date ranges | `15th – 22nd August 2026` fills start **and** end |
| date formats | `03/09/2025`, `May 12, 2025`, `2026-08-15` |
| registration blocks | the `*Name:* / *DoB:* / …` reply format, repeated per candidate |
| registration tables | tab, pipe, comma or wide-space separated, with or without a header row |
| headerless rows | email, phone and date-of-birth are found by pattern wherever they sit |
| several workshops | separated by `---`, or a repeated `Title:` line |

Dates are read **day-first** (`03/09/2025` = 3 September), matching Indian
convention.

**If a label isn't recognised**, the review screen lists it under "Unmatched
labels". Add that spelling to the `aliases` array for the right field in
`src/lib/schema.js` and it will be picked up from then on.

---

## 6. Sending tickets

The ticket page gives you three routes:

- **Send on WhatsApp** — opens WhatsApp (app or web) with the full ticket and
  receipt already written into the message box. Review, then send.
- **Send by email** — opens your mail client with the subject and body filled in.
- **Print / Save as PDF** — produces the formatted ticket on one page; attach
  the saved PDF if you want a document rather than text.

Unpaid registrants get a **payment reminder** message from the WhatsApp button
on the list instead of a ticket.

### Note on automation

Sending happens through *your* WhatsApp and *your* mail client — the app never
sends on its own. Fully automated delivery (a ticket emailed the instant someone
registers) would need Cloud Functions on the Blaze plan plus an email provider
such as SendGrid, and the WhatsApp Business API for messages. The ticket text
and PDF are already generated by shared code (`src/lib/tickets.js`,
`src/components/TicketDocument.jsx`), so that can be added later without
reworking anything.

### Note on ticket links

Ticket pages are behind the admin login, so the link is not shareable with
students — the ticket travels as text or PDF. Making tickets publicly viewable
would mean allowing unauthenticated `get` on registration documents (their
20-character random IDs act as the secret). That is a deliberate privacy
trade-off; ask before enabling it.

---

## 7. Project layout

```
src/
  lib/schema.js            field + organisation definitions — THE file to edit
  lib/parser.js            text -> structured records
  lib/tickets.js           ticket IDs, share links, ticket & receipt text
  lib/dedupe.js            spotting a candidate who is already registered
  lib/stats.js             registration counts, amount collected, seats left
  lib/db.js                Firestore reads/writes, ticket-ID allocation
  lib/exporters.js         which sheets to build (loaded on demand)
  lib/xlsx.js              the .xlsx and .csv file formats themselves
  lib/certificates.js      the four awards, their wording and their IDs
  lib/certdb.js            issuing, verification, holder history
  lib/certlinks.js         public certificate and verification URLs
  components/              WorkshopForm, RegistrationEditor,
                           RegistrationList, TicketDocument
  pages/                   Landing, Login, List, Import, Workshop, Edit,
                           Ticket, CertificateAllot, Certificate, Verify
  AuthContext.jsx          sign-in + admin allow-list check
  styles.css               the admin tool; monochrome only
  certificate.css          the certificate; the one place with colour
  landing.css              the public landing page
public/fonts, public/crests  certificate typefaces and crests
tests/                     parser, tickets, dedupe, stats, xlsx
firestore.rules            access control
firebase.json              hosting, caching and security headers
```

### On the spreadsheet writer

`lib/xlsx.js` writes `.xlsx` directly — it is a zip of a few XML parts, and
fflate provides the zip. This replaced SheetJS, which has been stuck at 0.18.5
on npm since the project moved to its own distribution, carrying an unpatched
prototype-pollution advisory with no fix available. The replacement is a
fraction of the size (the export bundle went from 286 kB to 16 kB) and removed
the only high-severity finding from `npm audit`.

Values are written as inline strings, never formulas, so a name such as
`=cmd|calc` pasted into a registration lands in the sheet as text. CSV has no
way to say "this is text", so there such a value is prefixed with an
apostrophe — otherwise Excel would run it on open.

## 8. Deleting

- **One registration** — *Remove* column on the workshop page. Asks first. The
  ticket number is retired, not reissued.
- **A whole workshop** — *Remove* column on the Records list, or the Delete
  button on the workshop page. Asks first, and takes every registration under
  it with it.

Deletion is immediate and there is no undo, so both routes require a second
click to confirm.

---

## 9. Tests

```bash
npm test
```

Runs the parser, ticket and duplicate-detection suites (`tests/`) on Node's
built-in test runner — no extra dependencies, no config. The parser is
heuristic and fails **silently** when it fails at all, so anything you teach it
belongs in `tests/parser.test.js` alongside a paste that used to break it.

The Firestore layer in `src/lib/db.js` is not covered here; testing it needs
the Firebase emulator.

---

## 10. Notes

- Search and filtering happen on the client, so no composite Firestore indexes
  are needed. Comfortable into the low thousands of records. Past that, the
  fix is server-side search — paging the list alone would break the search
  box, which is the point of loading everything.
- Exports read only the workshops currently on screen, not the whole database.
- Dates are validated as real calendar days: `31/04/2026` is refused and
  reported rather than stored and printed on a ticket.
- The seat limit is not a hard stop — going over asks for confirmation, since
  a coordinator may well have authorised the extra places.
- Editing a workshop makes its registration list match the screen — rows
  deleted there are deleted from the database. Registrations added by somebody
  else *while the edit screen was open* are kept, not wiped, and you are told
  they appeared.
- Registrations that match someone already on the list (same WhatsApp number,
  same email, or same name and date of birth) are held back for a decision
  rather than being issued a second ticket.
- Phone numbers are normalised to `+91` when a bare 10-digit number is given.

---

## 11. Verifying the security rules

`firestore.rules` is the only thing standing between the public internet and
every student's phone number, so it is worth testing rather than trusting.
The Firestore emulator runs the real rules engine locally:

```bash
mkdir -p /tmp/rules && cd /tmp/rules
npm init -y && npm pkg set type=module
npm install firebase-tools @firebase/rules-unit-testing@^4 firebase@^11
# write a test with initializeTestEnvironment({ rules: <this repo's firestore.rules> })
npx firebase emulators:exec --only firestore --project demo-workshops "node verify.mjs"
```

This is kept out of `package.json` on purpose: it needs firebase-tools and a
Java runtime, and `npm test` is deliberately dependency-free.

The current rules were checked this way — 28 assertions covering: signed-out
and not-on-the-list accounts are refused everything; a listed administrator
can read and write workshops and registrations but cannot add, read or delete
another administrator; the owner address has **no** data access until it adds
itself to the allow-list, cannot add anyone else, and cannot claim a record
under a different email; oversized and bloated documents are rejected; and
every unmatched path is closed.
