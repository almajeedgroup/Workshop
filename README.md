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
| **Console** | The screen that answers "what needs me today" — waiting requests, unpaid fees, courses filling up, across every workshop. |
| **Import** | Paste the poster (emoji and all) or labelled text; review the parsed result; save. |
| **Register** | Paste WhatsApp replies in the `*Name:* …` format — as many as you like at once. |
| **Ticket** | Every registrant gets a sequential Ticket ID and a printable ticket + IIC payment receipt. |
| **Send** | One click opens WhatsApp or email with the ticket already written out. |
| **Contact** | Call or email any registrant directly from the list. |
| **Payments** | Mark Paid / Pending / Waived / Refunded inline; running totals and amount collected. |
| **Seats** | Seat limit tracked, with a warning when it is reached or exceeded. |
| **Duplicates** | A pasted candidate who is already registered is flagged before anything is saved. |
| **Free or paid** | Each course is set Free or Paid when it is established; a free course shows no fee, no QR and no payment chase. |
| **Attribution** | Al-Majeed School is named *in association with* on every document the system produces. |
| **Attendance** | A printable register with a signature box per participant per day, and signing lines for the presenter and coordinator. |
| **ID cards** | Every registrant gets a two-sided colour ID card — colourway and crests chosen for the course, editable per person, printed nine to an A4 sheet. |
| **Delete** | Remove a single registration, or a whole workshop and everything under it. |
| **Self-registration** | Students scan a QR on the poster, fill the form, pay by UPI, and land in a queue for review. |
| **Certify** | Award Completion, Participation, Excellence or Appreciation certificates, in bulk, on either of two designs. |
| **Verify** | Every certificate carries an ID and a QR code that anyone can check publicly, without an account. |
| **Student list** | One button, one clean sheet: a row per student and only the columns that say something. |
| **Export** | Excel, CSV, printable PDF — for all workshops, one workshop, or its registrations. |

---

## 2. The console

Signing in lands on **Console**. The workshop screen could always answer "how
is this course going"; nothing could answer "which course needs me", short of
opening all of them — which is what somebody running four at once opens the
app to ask.

Five figures across the top: workshops, registered, collected, requests
waiting, awaiting payment. Then **Needs attention** — one row per workshop
that has something outstanding, with the reasons as coloured chips, ordered
so the most pressing sits at the top:

| | Ordered | Colour |
|---|---|---|
| Registration requests waiting | first — nobody has looked at these | Blue |
| Over the seat limit | second — already a problem | Red |
| Fees not paid | third | Tangerine |
| Nearly full, or full | last — a warning, not yet a problem | Tangerine / Blue |

Only what is outstanding appears. A course that is full, paid up and has
nothing waiting is not news, and listing it would bury the three that are.

**Coming up** lists courses that have not finished yet, soonest first.

### Seats as a bar

`seatPressure()` in `src/lib/stats.js` turns a seat limit into something you
can see filling: jade under three quarters, tangerine at three quarters,
blue when exactly full, red past the limit. The app already knew when a limit
had been **passed** and said so — afterwards. The bar is the part somebody
can act on.

It never draws past its own track however far over a course has gone; the
label says "2 over 12" instead. A 200%-wide bar tells you nothing the label
does not.

A workshop with no seat limit gets no bar. An empty track beside every
uncapped course would imply a limit that is not there.

### Colour must not contradict itself

A reason chip takes the colour of the bar beside it, not a colour picked from
its own category. A green "nearly full" next to an amber bar is two answers
to the same question — so `needsAttention()` returns a `tone` per reason, and
a test pins it to what `seatPressure()` says.

---

## 3. Data model

```
workshops/{workshopId}
    title, code, ticketPrefix, startDate, endDate, time, durationHours,
    mode, venue, presentedBy, collaborators, resourcePersons[],
    coordinators[], audience, seatLimit, feeType, feeAmount,
    contactNumbers[], paymentUpi, paymentQrUrl, registrationOpen,
    idCardTheme, idCardCrests[], idCardLabel, idCardNote,
    topics, outcome,
    lastTicketSeq, searchText, createdAt, updatedAt

    registrations/{registrationId}
        name, dob, qualification, courseName, whatsapp, area, email,
        paymentStatus, amountPaid, paymentMode, paymentRef,
        ticketId, idRole, bloodGroup, emergencyContact, idValidUntil,
        notes, nameLower, searchText

    registrationPhotos/{registrationId}   <- ADMIN ONLY, never public
        photo                              (one field, nothing else)

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

## 4. First-time setup

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

## 5. Deploy

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

## 6. What the parser understands

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

## 7. Sending tickets

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

## 8. Self-registration

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
| **Accept** | Becomes a real registration and gets the next ticket number. A match against somebody already registered *warns*; it never refuses. |
| **Reject** | Marked handled. **Nothing is thrown away** — every field they typed stays on the record. |
| **Restore** | Puts a rejected request back in the queue, intact, to be decided again. |
| **Remove** | Deletes it for good. The only irreversible action here, so it asks first. |

### When somebody looks like a duplicate

Accepting checks the person against everyone already registered — same
WhatsApp number, same email, or same name and date of birth. A match is
reported **next to their row**, naming who they matched and that person's
ticket, with **Register anyway** beside it.

It is a warning and never a refusal. `src/lib/dedupe.js` has said so since it
was written — *"nothing here blocks a save; it reports, and the operator
decides — two cousins really can share a phone"* — and families share an email
address and a phone constantly. A sibling should not have to be retyped by
hand, which is what refusing forced.

### Undoing a rejection

Rejecting is a decision, not a deletion, and decisions get made in haste —
somebody is turned away over a duplicate that turns out to be their sibling,
or the office simply changes its mind.

Open **already handled** under the queue. Rejected people are listed there
with everything they entered — name, date of birth, qualification, course,
WhatsApp, email, area, payment reference and mode — not just a name and a
status, because you cannot reconsider a decision from a name and a status.

**Restore** returns them to the pending list. It only puts the status back and
clears what the decision added (a ticket number, the time it was decided);
every field the student filled in was never touched, so nothing has to be
reconstructed. Restore is offered on rejected requests only — an accepted one
is already in the register, and putting it back would invite a duplicate.

**Remove** is the exception: it really does destroy what the student typed, so
it asks before doing it.

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

## 9. Free or paid, and ID cards

Both are settled when the course is **established**, on the Edit screen, and
every ticket, card and public page follows from there.

### Course Type

**Free** or **Paid**. Choosing Free does more than blank a number:

- the fee, the payment UPI and the payment QR boxes disappear from the edit
  screen, so a stale amount cannot survive the switch;
- the public registration page drops the whole payment card and the payment
  reference box, and says the programme is free;
- the ticket prints *Fee: Free — no payment due* instead of a receipt reading
  "Pending", which is what got free registrants chased for money;
- amount collected stays at zero however the old fee was left behind.

A workshop saved before this field existed has no Course Type. It is read as
free only if it charges nothing — so nothing changes underneath a paid course
that predates the setting.

### ID cards

Every registrant has a two-sided card: the person on the front, the programme
on the back. CR80 portrait, 54mm x 85.6mm — what every lanyard holder on sale
is cut for.

**Chosen for the whole course**, on Edit:

| Field | What it does |
|---|---|
| **ID Card Colour** | Saffron, Emerald, Indigo, Maroon, Teal or Slate. |
| **ID Card Logos** | Which of Al-Majeed School, Kabir IND PU College, Islamic Information Centre and Beyond Guidance appear, **and in what order** — see below. |
| **ID Card Role** | The word under the crests — PARTICIPANT, DELEGATE, VOLUNTEER. |
| **ID Card Note** | A line along the foot of the back — a return address, a condition of entry. |

**Editable per person**, from the *Card* link on the registration list:
photograph, role on that one card, blood group, emergency contact, and valid-
until. Everything else is read from the registration and the workshop, so a
course of forty prints identically unless you deliberately change one.

The colour and the crests are deliberately *not* editable per person. One card
in a different colour from the other thirty-nine is a mistake, not a feature.

### Arranging the crests

**ID Card Logos** is a list you arrange, not a set of tick-boxes. Add the
organisations you want with the **+** buttons, then move each one with **←**
and **→**. The numbered order is exactly what prints across the top of the
card, left to right.

Which crest leads is a statement about who is hosting — a course run by the
college with the centre supporting it should not be forced to print them the
other way round — so the order is yours, not the software's.

Choose none and all four print in the order listed. Unknown entries left by an
old edit are dropped rather than printed as gaps, and a repeated one prints
once.

### Printing them

**ID Cards** on the workshop page lays every card out on A4, nine to a sheet,
with cut lines.

Fronts and backs come out on **separate sheets in the same order**, not
duplexed. Cards at this scale go into a laminating pouch as two pieces anyway,
and two sheets in identical order cannot be collated wrong — whereas flipping
a stack for manual duplex pairs each back with the card from the opposite
column, which you only discover after cutting.

In the print dialog: scale **100%** (not "fit to page", which shrinks the
cards off size) and background graphics **on**, or the coloured bands print
white.

### Photographs

A photograph is the most personal thing this database holds, so it does not
live on the registration. `workshops/{id}/registrationPhotos/{regId}` holds
one field and nothing else, is administrator-only with no public read of any
kind, and is deleted with the person's record and with the workshop.

The second reason is speed: the workshop screen reads every registration each
time it opens, and photos on those documents would mean a course of forty
pulling megabytes down before the table appeared. They are read one at a time
on a card's own page, and in a single batch only when a sheet is printed.

Pictures are shrunk to 320px and stored as PNG data URLs, capped at 400KB by
the rules — comfortably inside Firestore's 1MiB per document.

---

## 10. Certificate designs

A design is **how** a certificate looks; a type is **what** it says. They are
kept apart on purpose — a Youth Parliament course can award all four types on
the parliament sheet without four more entries in `CERTIFICATE_TYPES`.

| Design | |
|---|---|
| **Classic — tricolour** | Saffron and green wave edges, the chakra behind, a three-bar divider. The general-purpose sheet. |
| **Parliament — red** | A red double keyline, a diamond divider, and a panel carrying the course code, duration, time, venue and topics. Made for the Youth Parliament, and suited to any course that records those. |

Choose it on the workshop's **Edit** screen under **Certificate Design**, and
every certificate for that course is printed on it. The allotment screen says
which sheet will be used before you issue.

### What the parliament sheet adds

It prints the workshop's **Topics / Highlights** as a single red line under
the body text, and a facts panel below that:

- **Workshop Code** — the workshop's Code
- **Duration** — the hours, with the dates
- **Time** — the time, with the mode
- **Venue**

Each is dropped when the course did not record it, rather than printed with a
blank beside it, so a workshop with only a title still produces a clean sheet.

### Long names

The recipient's name is the one thing on a fixed sheet whose length nobody
controls. It is **measured and shrunk until it fits on one line**, and its box
has a fixed height — so a long name cannot move anything else on the page.

Both matter. At a fixed size, "SYED RAYYAN HASANI" wrapped to three lines,
pushed the signatures through the frame, and took the certificate ID and the
QR code off the bottom of the sheet entirely, which is the pair that makes it
verifiable at all.

It is measured rather than estimated because width does not follow character
count in a script face: that name sets 170mm wide where "Syed Rayyan Hasani"
sets 129mm — the same eighteen characters. A weighted guess was 12% out on
ordinary names, which is the difference between fitting and not.

`src/components/FittedName.jsx` re-measures once the script webfont has
loaded, since measuring before it lands measures the fallback.

### The design is stored, not looked up

Every certificate records the design it was printed on. That is what makes the
public verification page show the sheet that was actually awarded, rather than
whatever the workshop was changed to afterwards — or nothing at all, once the
workshop is deleted.

The same goes for the facts: the code, duration, time, venue and topics are
copied onto the certificate as it is issued. They are course details, not
personal ones, so they are safe on a document anybody can read. The whitelist
in `certificateRecord()` is still the privacy boundary — no phone number, no
date of birth, no email, no address, ever.

---

## 11. Attendance sheets

**Attendance** on the workshop page produces the register, ready to print and
sign. It is the one document in this system that exists to be written *on*,
and that settles most of its design.

- **Rows are 11mm tall.** That is what a signature needs. A row a pen cannot
  sign in gets signed across two rows, and then the sheet proves nothing.
- **The heading repeats on every page.** A second page of signature boxes with
  no names against them is worthless.
- **One column per day.** A three-day course gets three dated columns on one
  sheet, each about 24mm wide.
- **The presenter and coordinator sign the foot**, named from the workshop
  where those are recorded, with a third blank line for whoever signs on the
  day.

People are listed by ticket number — numerically, so `IIC-010` follows
`IIC-009` rather than `IIC-001` — and anyone not yet issued one is listed
after them by name. Sorting by name alone would reshuffle the sheet every time
somebody new joined, which is exactly what you do not want between the day one
sheet and the day two sheet.

The crests are the ones chosen for this course's **ID Card Logos**, in the
same order, so a course's paperwork reads as one set of documents.

### Courses longer than six days

Six columns across A4 leaves about 22mm each, which is a signature; ten would
leave 13mm, which is an initial at best. Past six days the page switches to
one sheet per day and says so, with a date picker at the top.

A shorter course can be printed that way too — choose a single day instead of
*The whole course* if you would rather each day were signed on its own sheet.

### Dates

Days are worked out from the course's start and end dates, in UTC, so a sheet
is never dated a day out because of where the machine is. A course with only a
start date is one day. Dates typed into the wrong boxes are read as the range
between them rather than refused — somebody transposed them, and an empty
sheet helps nobody.

---

## 12. Project layout

```
src/
  lib/schema.js            field + organisation definitions — THE file to edit
  lib/parser.js            text -> structured records
  lib/tickets.js           ticket IDs, share links, ticket & receipt text
  lib/dedupe.js            spotting a candidate who is already registered
  lib/stats.js             registration counts, amount collected, seat pressure
  lib/overview.js          the console's figures and what needs attention
  lib/db.js                Firestore reads/writes, ticket-ID allocation
  lib/publicdb.js          the public workshop copy and the request queue
  lib/imagefile.js         shrinking a picked image to fit in a document
  lib/idcards.js           card colourways, crests, and what each face says
  lib/attendance.js        course days, signature columns, who signs the foot
  lib/photodb.js           participant photographs, kept off the registration
  lib/exporters.js         which sheets to build (loaded on demand)
  lib/xlsx.js              the .xlsx and .csv file formats themselves
  lib/certificates.js      the four awards, their wording and their IDs
  lib/certdb.js            issuing, verification, holder history
  lib/certlinks.js         public certificate and verification URLs
  components/              WorkshopForm, RegistrationEditor, RegistrationList,
                           TicketDocument, RequestsPanel, QrCode, ImageField,
                           IdCard, OrderedChoice, AttendanceSheet,
                           FittedName, SeatBar,
                           CertificateDocument, CertificateStage
  components/site/         PublicShell, SiteHeader, SiteFooter, Icons
  pages/                   the admin tool: Console, Login, List, Import, Workshop,
                           Edit, Ticket, CertificateAllot, IdCard, IdCards,
                           Attendance
  pages/site/              the public site: Home, Programmes, Certificates,
                           About, Contact, Register
  AuthContext.jsx          sign-in + admin allow-list check
  styles.css               the admin tool; near-black + the four colours
  site.css                 the public site
  certificate.css          the certificate; the one place with colour
  idcard.css               the ID card, in millimetres against a real card
  attendance.css           the attendance register, A4 portrait
public/fonts, public/crests  certificate typefaces and crests
tests/                     parser, tickets, dedupe, stats, xlsx,
                           certificates, imagefile, idcards, attendance,
                           exporters, association, requests, overview
firestore.rules            access control
firebase.json              hosting, caching and security headers
```

### The student list

**Download student list** on the Registrations panel gives one sheet, one row
per student, and only the columns that carry something. It drops three kinds
of column the full export has to keep:

- **the workshop repeated on every row.** It is in the file name and the sheet
  name instead. A title row above the header would be worse than leaving it
  out — it breaks sorting and filtering in every spreadsheet program there is.
- **payment, on a free course**, where there is nothing to record.
- **anything blank for every student.** A course that never collected blood
  groups has no business printing a Blood Group column.

People are ordered by ticket number, compared numerically, so the sheet reads
in the same order as the attendance register. Dates are written the way they
appear on the ticket and the ID card.

It is Excel rather than CSV on purpose: CSV has no way to say "this is text",
so a WhatsApp number lands in a column as `9.33921E+09` by the time anyone
reads it.

The buttons beside it are unchanged — **Full Excel** is the complete export
with every schema field, which is the right shape for an archive and the wrong
shape for a list somebody is going to read.

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

## 13. Deleting

- **One registration** — *Remove* column on the workshop page. Asks first. The
  ticket number is retired, not reissued, and the photograph goes with the
  record rather than being left behind in its own collection.
- **A whole workshop** — *Remove* column on the Records list, or the Delete
  button on the workshop page. Asks first, and takes every registration under
  it with it — registrations and photographs alike, since Firestore does not
  delete a sub-collection with its parent. The public copy of the workshop
  goes too, so its registration link stops working.
- **A registration request** — *Delete* on the requests panel, for entries you
  never want to see again. Rejecting keeps the record instead.

Deletion is immediate and there is no undo, so both routes require a second
click to confirm.

---

## 14. Tests

```bash
npm test
```

Runs 218 assertions on Node's built-in test runner — no extra dependencies,
no config — over the parser, ticket allocation, duplicate detection, totals,
the spreadsheet writer, certificates, image shrinking, ID cards and
attendance sheets. The parser
is heuristic and fails **silently** when it fails at all, so anything you teach
it belongs in `tests/parser.test.js` alongside a paste that used to break it.

The Firestore layer in `src/lib/db.js` is not covered here; testing it needs
the Firebase emulator.

---

## 15. Colour

Black text on a white page, and the four colours on everything else.

| | Hex | Where |
|---|---|---|
| Jade Green | `#00CA72` | Flag segment 1; the primary button; the ticket band; chips under the pointer |
| Tangerine Yellow | `#FFCC00` | Flag segment 2; table headings; the import preview header; solid tags |
| Radical Red | `#FB275D` | Flag segment 3; the delete button; warning notices |
| Dodger Blue | `#1E90FF` | Flag segment 4; the current page; buttons and links under the pointer; the focus ring; notices |
| Near-black | `#0A0A0A` | **All** text, keylines and rules |
| White | `#FFFFFF` | Page background |

**The colours are never text.** Measured against white they come out at 2.17,
1.51, 3.78 and 3.24 to one, and 4.5 is the floor for readable text —
tangerine is nowhere near it. So they are fills, borders and bars, always
with black on top, which clears the floor on all four: 9.14, 13.09, 5.23 and
6.12 to one. Nothing in `styles.css` sets `color` to a palette colour, and
nothing should.

Each colour means something, so the interface stays readable at a glance:

- **jade** — the action that moves work forward
- **red** — the one that destroys, and anything wrong
- **blue** — where you are, where you are going, what has focus
- **tangerine** — headings and labels over data

Colour is never the only signal: the delete button is dashed as well as red,
and a warning notice is dashed as well as red.

### The flag

`--flag` is one segment of each colour, in palette order. It rules off the
masthead, a page heading and the login panel — the three places that divide
the screen, and nowhere else. Four colours on every edge is wallpaper.

It is painted as a background rather than a border-image, because only the
bottom edge is wanted and `border-image` applies its slice to all four sides.

The statistics strip and the numbered badges in the logo picker walk the same
four in the same order, so a row of figures reads as four things rather than
one long strip.

### Printing

Every coloured fill carries `print-color-adjust: exact`, or the buttons, bars
and the ticket band come out of the printer white and the sheet loses half
its meaning.

The public site (`site.css`) and the certificate (`certificate.css`) keep
their own schemes, and the ID card keeps its six colourways.

---

## 16. Attribution

Al-Majeed School of Research Methodology and Innovation is named **in
association with** on everything this system produces: the ticket and its
WhatsApp message, the receipt, the attendance sheet, the ID card, the
certificate, the public registration page and the confirmation a student
keeps.

`associationLine()` in `src/lib/schema.js` is the single place that decides
how. A partner named for a particular course leads and the school follows; a
course with no collaborators still credits the school.

If somebody has already typed the school into **In association with** — and
they will — it is not repeated. The match ignores case, punctuation, and `&`
against `and`, because those are exactly the differences a person types
without thinking.

The name itself lives once, as `ISSUER.operator`. It had been written three
different ways across the code — with a comma after "Research", with `&`, and
with `and` — which on a certificate and the ticket for the same course is the
sort of thing people notice.

## 17. Notes

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

## 18. Verifying the security rules

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

The current rules were checked this way — 43 assertions covering: signed-out
and not-on-the-list accounts are refused everything; a listed administrator
can read and write workshops and registrations but cannot add, read or delete
another administrator; the owner address has **no** data access until it adds
itself to the allow-list, cannot add anyone else, and cannot claim a record
under a different email; oversized and bloated documents are rejected; and
every unmatched path is closed.

Fifteen of those cover participant photographs specifically, since they are
the most personal thing stored: no read of any kind by a stranger or an
anonymous visitor, no listing, no write, no delete; a document carrying any
field but `photo` refused; a non-string refused; and the 400KB cap enforced
at the boundary rather than trusted from the browser.
