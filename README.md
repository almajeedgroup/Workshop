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
| **Self-registration** | Students scan a QR on the poster, fill the form, pay by UPI, and land in a queue for review. |
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

### 3.5 Google sign-in (owner only)

The sign-in page offers **Sign in with Google** as well as a password. It is
deliberately restricted to `almajeed.work@gmail.com`: Google will sign anyone
in, so any other account is signed straight back out with a plain message
rather than being left on "Not authorised". This changes no permissions — the
server still consults the `/admins` allow-list and nothing else.

Other administrators sign in with an email and password, because their
`/admins` record is keyed to that account.

To enable it: **Authentication → Sign-in method → Google → Enable.**

> **Custom domains need adding by hand.** `*.web.app` and `*.firebaseapp.com`
> are authorised automatically, but `workshops.almajeedgroup.in` is not — until
> you add it under **Authentication → Settings → Authorized domains**, Google
> sign-in there fails with `auth/unauthorized-domain`. The sign-in page names
> that error and where to fix it.

### 3.6 Add other administrators

1. **Authentication → Users → Add user** — their email and password.
2. Copy the generated **User UID**.
3. **Firestore → Start collection** → ID `admins` → document ID = that UID →
   fields `email` and `name`.

To revoke access, delete their `admins` document. That works for the owner too,
but they can re-add themselves by signing in again — to remove them for good,
delete the account in **Authentication** as well, or change
`BOOTSTRAP_ADMIN_EMAIL` in both files and redeploy.

### 3.7 Hardening the deployment

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

## 7. Self-registration

Students scan a QR code on the poster, fill the form themselves, pay, and land
in a queue you review by hand. Nothing is admitted automatically: you decide
who becomes a registration, and you decide who is marked paid.

### Publishing the page

On the workshop page, press **Publish the registration page**. That one press
does both halves of the job — it turns registration on, and it writes the
public copy of the workshop that the form reads. A workshop created before
this feature existed has no public copy at all, which is why its link used to
report *"link is not valid"*; publishing creates it.

The panel then shows the link and a QR code. **Show poster QR** prints at any
size — put it on the poster, on a standee, in the WhatsApp broadcast.

**Close registration** withdraws it. The link stops accepting entries the
moment you press it; nothing already submitted is lost.

### What the student sees

Workshop title, dates, venue, fee, the form, and the payment QR. The form asks
only what a ticket needs. They pay, type the UPI reference, and submit.

### What you do

Pending requests appear on the workshop page under **Registration requests**:

| Action | What happens |
|---|---|
| **Accept** | Becomes a real registration, gets the next ticket number, runs through duplicate detection first. |
| **Reject** | Marked handled, kept for the record, no ticket issued. |
| **Delete** | Removed entirely. |

Accepting is where the ticket number is issued — never before. Payment status
starts as whatever the student claimed and is yours to confirm: mark **Paid**
on the registration list once you have checked the bank.

The panel gives you a receipt message per accepted request, ready to paste
into WhatsApp to the number they gave.

### The payment QR

This is the one part students actually have to use, so it is worth getting
right. Two ways, and an image beats a UPI ID wherever both are set.

**Upload the QR from your bank** — the usual route. On the workshop's **Edit**
screen, under **Payment QR Image**, press *Choose an image* and pick the QR
your bank gave you (a BharatQR or merchant standee). It is shrunk to 480px and
stored on the workshop itself: no file to copy into the repository, no deploy,
and it can be changed by anyone who can edit the workshop.

This route accepts cards as well as UPI, but **carries no amount** — bank QRs
never do — so the form tells the student to type the fee in themselves.

**Or set a UPI ID** — **Payment UPI** on the workshop, or `ISSUER.upiId` in
`src/lib/schema.js` for every workshop. The page then draws the QR itself with
the fee already filled in, and offers an *Open my UPI app* button next to it.

If neither is set, the form tells students to telephone instead, and the
workshop page shows a warning saying so — a payment screen with nothing on it
looks like a QR that failed to load, which is not a thing to leave to chance.

`ISSUER.paymentQrImage` also accepts a path to a file shipped in `public/`
(e.g. `/payment-qr.png`) if you would rather the QR travel with the site.
Uploading is preferred: a path pointing at a file that is not there shows
nothing, and gives no clue why.

Uploaded images are stored as data URLs. `src/lib/imagefile.js` caps them at
320 KB, well under Firestore's 1 MiB per document, and re-encodes as PNG —
JPEG's ringing around hard black-and-white edges is exactly what stops a
scanner reading a QR.

### Why a separate public document

`publicWorkshops` is a whitelisted copy — title, dates, venue, fee, payment
details. The workshop document itself carries internal notes and counters, and
Firestore rules cannot expose half a document. `src/lib/publicdb.js` builds
the copy from a fixed list, so a field added to workshops later cannot leak
onto the public page by accident.

Requests are **create-only** for the public: a stranger may write one and can
never read one back, not even their own. The rules also require the workshop
to exist and be open, cap every field's length, and reject anything carrying a
key they do not expect. A hidden honeypot field must arrive empty.

---

## 8. Project layout

```
src/
  lib/schema.js            field + organisation definitions — THE file to edit
  lib/parser.js            text -> structured records
  lib/tickets.js           ticket IDs, share links, ticket & receipt text
  lib/dedupe.js            spotting a candidate who is already registered
  lib/stats.js             registration counts, amount collected, seats left
  lib/db.js                Firestore reads/writes, ticket-ID allocation
  lib/publicdb.js          the public workshop copy and the request queue
  lib/imagefile.js         shrinking a picked image to fit in a document
  lib/exporters.js         which sheets to build (loaded on demand)
  lib/xlsx.js              the .xlsx and .csv file formats themselves
  lib/certificates.js      the four awards, their wording and their IDs
  lib/certdb.js            issuing, verification, holder history
  lib/certlinks.js         public certificate and verification URLs
  components/              WorkshopForm, RegistrationEditor, RegistrationList,
                           TicketDocument, RequestsPanel, QrCode, ImageField,
                           CertificateDocument, CertificateStage
  components/site/         PublicShell, SiteHeader, SiteFooter, Icons
  pages/                   the admin tool: Login, List, Import, Workshop,
                           Edit, Ticket, CertificateAllot
  pages/site/              the public site: Home, Programmes, Certificates,
                           About, Contact, Register
  AuthContext.jsx          sign-in + admin allow-list check
  styles.css               the admin tool; monochrome only
  site.css                 the public site
  certificate.css          the certificate; the one place with colour
public/fonts, public/crests  certificate typefaces and crests
tests/                     parser, tickets, dedupe, stats, xlsx,
                           certificates, imagefile
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

## 9. Deleting

- **One registration** — *Remove* column on the workshop page. Asks first. The
  ticket number is retired, not reissued.
- **A whole workshop** — *Remove* column on the Records list, or the Delete
  button on the workshop page. Asks first, and takes every registration under
  it with it. The public copy of the workshop goes too, so its registration
  link stops working.
- **A registration request** — *Delete* on the requests panel, for entries you
  never want to see again. Rejecting keeps the record instead.

Deletion is immediate and there is no undo, so both routes require a second
click to confirm.

---

## 10. Tests

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

## 11. Notes

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

## 12. Verifying the security rules

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
