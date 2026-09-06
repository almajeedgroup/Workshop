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
| **Cards** | The registrations as faces, for checking somebody against their ID card at the door. |
| **Board** | Records as grouped workshops with their people underneath, each rail coloured by what the course needs. |
| **Console** | The screen that answers "what needs me today" — waiting requests, unpaid fees, courses filling up, across every workshop. |
| **Import** | Paste the poster (emoji and all) or labelled text; review the parsed result; save. |
| **Register** | Paste WhatsApp replies in the `*Name:* …` format — as many as you like at once. |
| **Ticket** | Every registrant gets a sequential Ticket ID and a printable ticket + IIC payment receipt. |
| **Overlay** | Open anybody's ticket over the board without losing the groups you expanded to find them. |
| **Find** | One box on the Console and the board that finds a person by name, ticket, number or anything else, across every course at once. |
| **Students** | Everybody on two or more courses, and a printable profile of everything one student has done. |
| **Carry forward** | Bring one, some or all of a previous course's students onto the next one — names and contacts, never last term's fees. |
| **Online class** | Online and Hybrid courses get a Jitsi room on the school's own page, with the register beside it and attendance taken from who is in it. |
| **Class record** | Live notes, an automatic transcript, PDFs and links shared to every screen at once, and a recording saved to the presenter's computer. |
| **Send** | One click opens WhatsApp or email with the ticket already written out. |
| **Contact** | Call or email any registrant directly from the list. |
| **Payments** | Mark Paid / Pending / Waived / Refunded inline; running totals and amount collected. |
| **Seats** | Seat limit tracked, with a warning when it is reached or exceeded. |
| **Duplicates** | A pasted candidate who is already registered is flagged before anything is saved. |
| **Free or paid** | Each course is set Free or Paid when it is established; a free course shows no fee, no QR and no payment chase. |
| **Attribution** | Al-Majeed School is named *in association with* on every document the system produces. |
| **Attendance** | Take the register on a phone, or print a sheet with a signature box per participant per day, and signing lines for the presenter and coordinator. |
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

### The shell

Admin screens sit beside a left sidebar rather than under a top masthead. The
masthead spent a whole line on navigation, the organisation, the signed-in
address and a sign-out button, and left the content whatever was over — and
width is exactly what a board of grouped workshops is spending.

The count beside **Console** is the number of registration requests nobody
has looked at. It is the one number worth carrying in the furniture:
everything else can wait until a screen is opened, but a student who
registered and heard nothing cannot.

Under 860px the sidebar becomes a drawer behind a **Menu** button, with a
scrim to click away and navigation closing it — without that it stays over
the page the link just opened, which on a phone hides the whole thing. It is
`display: none` when printing.

A test reads the routes out of `App.jsx` and the links out of `Sidebar.jsx`
and asserts they agree, both ways: no nav link to a route that does not
exist, no admin route falling outside the regex that decides which shell
renders. Either mistake looks like the app ignoring a click.

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

## 3. The board

**Records** opens as a board: one group per workshop, its registrations
underneath, and a coloured rail down the left saying what that course needs.
**Table** switches back to the flat list, and the choice is remembered.

Groups start collapsed, because four courses of forty is a hundred and sixty
rows and none of them answer the question you opened Records to ask. The
header carries enough to judge a course without expanding it:

- how many registered, and the seat bar
- seats left, or how far over
- paid of total, collected, and how many still owe — omitted entirely on a
  free course, where a zero would only invite the question of what went wrong
  with the takings
- the same reason chips the console shows

**Expand all** and **Collapse all** are there for when you do want the people.

### The rail

| | |
|---|---|
| Jade | Live and healthy |
| Blue | A registration request is waiting |
| Tangerine | Fees unpaid, or nearly full |
| Red | Over the seat limit |
| Grey | Finished and settled |

Grey matters: blue already means "a request is waiting", so giving a finished,
paid-up course the same rail would make the two indistinguishable at exactly
the glance the board exists for.

A group's rail comes from the same `needsAttention()` the console uses, and a
test pins them together — a workshop that is red on one is red on the other.

### Payment as colour

Every row carries its payment status as a coloured pill, so a group reads as a
block of colour rather than forty words: jade paid, tangerine pending, blue
waived, red refunded.

The pills on the board are **read-only**. The board is for seeing across every
course at once; changing somebody's status belongs on the workshop screen,
beside the rest of their details, where the select is editable.

### The ticket, without leaving the board

A row's **Ticket** chip opens the ticket as an overlay over the board rather
than navigating away. Checking one person's ticket used to cost the whole
board: you left, looked, came back, and every group you had expanded was
collapsed again — the very state you had built up to answer your question.

The overlay is a real dialog, not a styled `div`. `src/components/Overlay.jsx`
portals to `document.body` (so no ancestor's `overflow` or stacking context
can clip it), carries `role="dialog"` and `aria-modal`, takes focus on open
and gives it back to the chip on close, locks the page behind it from
scrolling, and closes on **Escape** or a click on the scrim. A click *inside*
the panel does not close it.

**Print / PDF** prints from the overlay directly: `body.overlay-open` hides
the application shell and the dialog's own chrome, so what comes out is the
ticket on its own page — the same output as the full ticket page. **Open full
page** is still there for when you want the URL.

### Completed

A workshop whose last day has passed carries a blue **Completed** badge — on
its board group and at the top of its own page. `isFinished()` lives beside
the rest of the board logic in `src/lib/overview.js` and compares the end date
(falling back to the start date, for a one-day course) against today.

A workshop with no dates at all is **not** marked completed. It is undated,
which is a different thing from finished, and guessing would stamp Completed
on a course that has not been scheduled yet.

### What it costs

The board needs every workshop's registrations, where the table needed only
the workshops. They are fetched **once, only when the board is actually
shown, and only after the workshops themselves have arrived** — switching to
Table and back does not fetch again.

That last condition is not incidental. The first version guarded on the
fetched array itself, which meant it fetched on mount — before the workshops
had loaded, so for nothing — stored `[]`, and then skipped every later
attempt because **an empty array is truthy**. The board rendered permanently
empty. `shouldFetchBoard()` in `src/lib/overview.js` now states the condition
in one place, with `loaded` tracked separately from the result, and a test
walks the whole mount sequence.

---

## 4. Data model

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

## 5. First-time setup

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

### Forgotten passwords

The sign-in screen has **Email me a reset link**, which sends Firebase's own
reset email. An administrator locked out previously had to be reset from the
Console by somebody who could still get in — which is no help when the person
locked out *is* that somebody.

The confirmation is the same whether or not an account exists. Saying "no
account for that address" on a sign-in screen tells anybody who asks which
addresses are administrators here.

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

## 6. Deploy

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

## 7. What the parser understands

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

## 8. Sending tickets

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

## 9. Self-registration

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

## 10. Free or paid, and ID cards

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

### Checking cards against faces

The **Cards** button on a workshop's registration panel shows the register as
faces: photograph, name, ticket number, and the details a card carries. This
is the view you want at the door, when somebody hands you a card and you are
checking it against the person holding it. A table of names cannot be checked
against a face, and the print sheets are for making cards, not reading one.

Somebody with no photograph still appears, marked as such. Leaving them out
would make the gallery an incomplete register, which is the one thing it must
not be.

Photographs are fetched when that view is first opened and not before, so the
list view stays as fast as it was.

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

## 11. Certificate designs

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

## 12. Attendance sheets

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

### Taking the register

**Attendance → Take the register** marks people on the day. It is built for
somebody standing at a door with a phone: one tap cycles a person through
**Present → Late → Absent → Unmarked**, so the common case is a single tap
and nothing opens. **Mark everyone present** then correcting the few is
usually faster still.

Rows are 63px tall. This is used standing up, where a small target is a
mis-tap and a mis-tap is a wrong record.

Marks appear immediately and are saved behind it. At a door, a tap that waits
on the network before it changes colour gets tapped again.

**Unmarked is a state of its own**, never the same as absent. A register that
cannot tell "nobody reached them" from "they did not come" turns an
unfinished job into an accusation — so it is counted and shown separately,
and the totals say *Not yet marked*.

### Printing what was taken

Once a register exists, the print tab offers it as a **record to file** —
the marks printed into the signature boxes, the heading reading *Attendance
Record*, and the totals filled in — instead of empty boxes to sign. Untick it
to get the blank sheet.

### How it is stored

    workshops/{id}/attendance/{YYYY-MM-DD}
      { marks: { <registrationId>: 'present' | 'late' | 'absent' } }

One document per day, holding a map. The obvious alternative — a document per
person per day — is much worse: a course of forty over six days becomes 240
documents to write and 240 to read back, against six either way. Taking a
register is the one task here done standing up, so it is the one that must
not be slow.

Marks are written one field at a time, so two people taking the register on
different phones do not overwrite each other. Unmarking **deletes** the field
rather than storing an empty string, or "nobody got to them" stops being
distinguishable from a blank mark.

The register is administrator-only, capped at 2000 people per day, and
rejects any field but `marks`. It is deleted with the workshop, and one
person's marks go when their registration does.

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

## 13. Project layout

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
  lib/attendance.js        course days, signature columns, marks and totals
  lib/attendancedb.js      the register: one document per day
  lib/photodb.js           participant photographs, kept off the registration
  lib/search.js            finding one person across every course at once
  lib/people.js            recognising one student across courses
  lib/carryover.js         who comes to the next course, and with what
  lib/meeting.js           room names, join links, and who is in the room
  lib/classroom.js         notes, transcript lines, handouts and recordings
  lib/classroomdb.js       the live side of those three
  lib/speech.js            the browser's speech recogniser, wrapped
  lib/recorder.js          screen + microphone recording, wrapped
  lib/meetingdb.js         opening and closing a class, and moving its room
  lib/phonefix.js          which stored numbers need reshaping, and into what
  lib/phonefixdb.js        running that over the database, scan then apply
  lib/exporters.js         which sheets to build (loaded on demand)
  lib/xlsx.js              the .xlsx and .csv file formats themselves
  lib/certificates.js      the four awards, their wording and their IDs
  lib/certdb.js            issuing, verification, holder history
  lib/certlinks.js         public certificate and verification URLs
  components/              WorkshopForm, RegistrationEditor, RegistrationList,
                           TicketDocument, RequestsPanel, QrCode, ImageField,
                           IdCard, OrderedChoice, AttendanceSheet,
                           FittedName, SeatBar, BoardGroup, Sidebar,
                           RegistrationCards, AttendanceRegister, Overlay,
                           PhoneFixPanel, JitsiRoom, ClassBoard, Finder,
                           CertificateDocument,
                           CertificateStage
  components/site/         PublicShell, SiteHeader, SiteFooter, Icons
  pages/                   the admin tool: Console, Login, List, Import, Workshop,
                           Edit, Ticket, CertificateAllot, IdCard, IdCards,
                           Attendance, Class, People, Person
  pages/site/              the public site: Home, Programmes, Certificates,
                           About, Contact, Register, JoinClass
  AuthContext.jsx          sign-in + admin allow-list check
  class.css                the online classroom, on both sides of it
  styles.css               the admin tool; near-black + the four colours
  site.css                 the public site
  certificate.css          the certificate; the one place with colour
  idcard.css               the ID card, in millimetres against a real card
  attendance.css           the attendance register, A4 portrait
public/fonts, public/crests  certificate typefaces and crests
tests/                     parser, tickets, dedupe, stats, xlsx,
                           certificates, imagefile, idcards, attendance,
                           exporters, association, requests, overview,
                           navigation
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

## 14. Deleting

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

## 15. Returning students

### Bringing them to the next course

The same twenty people come back term after term, and enrolling them again
meant finding the old course, reading twenty names off it and typing them
into the new one — an afternoon's work producing exactly the register that
already existed.

**+ From a previous course**, on the workshop's Registrations panel, opens
with your most recent other course already chosen and lists everybody on it,
**ticked**. Untick whoever is not continuing, or **Clear** and pick the one
person you meant — the button counts what is ticked, so it reads *Bring 1
student* or *Bring 9 students* and never brings more than it says.

Everybody starts ticked because bringing a whole course forward is the common
case: unticking two is less work than ticking eighteen. Past eight students a
**find a name** box appears; narrowing the list is a way of finding somebody,
never a way of choosing them, so filtering does not disturb a single tick.

Courses with nobody on them are not offered, and neither is this one —
bringing a course's students onto itself would duplicate every one of them.
Changing course clears the ticks, because a different course is a different
list of people and the old ticks mean nothing on it.

**What comes across is the person, not the enrolment.** Name, date of birth,
qualification, course, phone, email, area, blood group, emergency contact —
facts about somebody, which do not change between courses.

**What stays behind** is the ticket number, the payment status, the amount,
the mode, the reference, last term's notes and the ID card's validity date.
Carrying those forward would open a new course with twenty people already
marked *Paid* for a fee nobody has collected, holding tickets issued by
another course. Everybody arrives **Pending**, with a fresh ticket number
from this course's own series, and a note saying where they came from — six
months on, that note is the only thing explaining why somebody is on a
register nobody remembers adding them to.

The carried list is an **allow-list**, so a field added to the schema later
is not carried by accident.

**It reports; it does not decide.** Anybody who matches somebody already
registered — on the usual identity of phone, then email, then name with date
of birth — is shown **unticked**, with what they matched and who:

> ☐ Fathima Zohra · *same WhatsApp number as Aaliya Fatima — already on this
> course*

They are never removed from the list. This office types a shared contact — an
office number, a parent's phone, one email between siblings — into the
records of students who have none of their own, so four different people can
carry one number. An earlier version withheld all four with a message saying
they were already registered, which was untrue and impossible to argue with.
`dedupe.js` has always taken the other line for pasted registrations — *"it
reports, and the operator decides — two cousins really can share a phone"* —
and there was no reason for this screen to be the exception.

Somebody listed twice on the **old** course is a different problem from
somebody already on **this** one, and each says which it is. Somebody with no
phone, email or date of birth has nothing to match on and is ticked.

The line under the row says *"all 9 would be added"* while everybody is
ticked and *"5 of 9 chosen · 4 left unticked — they match somebody already
registered"* once they are not, so the button's number and the list on screen
can never disagree without explanation. It counts only what is **still**
unticked: tick a flagged row and it stops being reported as held back. If the
course has a seat limit, the warning follows the **selection**, not the whole
course — bringing one student into one free seat is not a problem and is not
reported as one.


A registration belongs to a workshop. Somebody who comes to three courses is
three documents with three ticket IDs, and nothing in the system said they
were one person — so the school could not answer the question every school
eventually asks, and a returning student got the same blank welcome as a
stranger.

**Students** in the sidebar lists everybody on two or more courses. Each name
opens a profile: every course they have been on, the ticket for each, what
they attended, what they paid, and every certificate they have been awarded.
It prints, because that is what gets asked for.

### Who counts as the same person

The same identity the duplicate check uses — **phone, then email, then name
with date of birth** (`matchKeys` in `dedupe.js`). Inventing a second answer
here would let the app call two records a duplicate on one screen and two
different people on another.

**A name alone is not an identity.** There are two Mohammed Khans, and
merging them puts one student's attendance and certificates on the other's
profile. Somebody with no phone, no email and no date of birth has nothing
to match on and stays on their own; their profile says so.

Joining is **transitive**: a phone on the first registration, an email on the
second, and both on a third is one person, not three. Anything less gives an
answer that depends on the order the records were read in.

Two tickets on **one** course is a duplicate registration, not a second
visit, so courses are counted distinct — that person is not a returning
student and has not attended twice.

### Registered, or actually there

The list switches between two counts, and the difference is real:

- **Registered on 2+** — signed up for two or more courses.
- **Attended 2+** — *marked present* on two or more.

A register is not taken on every course here, so counting only marked
attendance hides most returning students, while counting only registrations
includes somebody who signed up twice and came once. Both questions are
legitimate; neither is presented as the other, and the screen says which one
you are looking at.

A course whose register was **never taken** counts towards neither side.
Not zero — counting an untaken register as absence says a student skipped a
course when the truth is that nobody wrote anything down.

### The profile address

`/people/:id`, where the id is a digest of the identity key, not the key
itself. That key is a phone number or an email address, and a profile page
whose address carries a student's phone leaks it into browser history,
screenshots, and anything the link is pasted into. The digest is stable, so a
profile keeps the same address, and meaningless on its own. It is not doing
security work — the administrator login is.

### From a search result

Look somebody up in the finder and, if they turn out to be on more than one
course, the overlay offers their profile. Finding out they have been here
before is usually how you find out at all.

### What it costs

One read per course for the registers, and one per course on a profile for
the certificates — only on these two screens. The registrations themselves
were already fetched.

---

## 16. Finding one person

The rest of the app is organised by workshop, which is right — a course is
the thing that gets run, printed and paid for. But the question that arrives
by phone is never organised that way. It is *"Adifaah says she registered"*,
or *"who is AIHOW26-014"*, or a WhatsApp number with no name attached, and
answering it meant opening courses one at a time until she turned up.

There is a search box at the top of the **Console**, and on **Records** in
board view. It searches everything already on the screen.

### What it searches

Everything, not just names. A registration is findable by name, ticket ID,
either phone number, email, area, course, qualification, date of birth,
payment reference or notes — and by its workshop's title or code. A pending
self-registration is findable by its `REQ-` reference. A course is findable
by title, code, venue, presenter, resource person or topic.

Numbers match however either side punctuated them: `9339214522`,
`+91 9339214522` and `09339214522` all find the same person. Accents and
capitals are ignored on both sides. Several words with no name among them
still work — *"marathahalli bba"* is two facts about somebody whose name you
have forgotten.

### The order results come in

Certainty first, coincidence last:

| | |
|---|---|
| A ticket ID or reference typed in full | somebody reading off a ticket |
| A name typed in full | |
| A code the query is the start of | |
| A phone number | |
| A name the query is the start of | |
| A word *inside* the name | half the office searches by second name |
| The query anywhere in the record | |
| Every word somewhere, in any order | the last resort |

A single letter is not a search — it would match half the register and rank
none of it — so nothing runs under two characters.

Twelve results are shown and **the total is always reported**. A search that
quietly shows ten of forty looks like an answer when it is a sample.

### Choosing one

It opens **over** the page rather than navigating away, for the same reason
the board's tickets do: you are usually looking somebody up in the middle of
something else, and coming back to find your filters cleared and your groups
collapsed is its own small tax.

- a **person** opens their ticket, with *Print*, *Open full page* and *The
  course*
- a **request** opens what they typed, with a link to review it
- a **course** opens its figures and who is on it

It is the ARIA combobox pattern rather than a `div` with a click handler, so
it works from the keyboard the way every other search box does: `/` or
`Ctrl`/`⌘`-`K` focuses it, `↑` `↓` move, `Enter` opens, `Escape` closes the
list and then clears. The highlighted row is the same whether it was reached
by arrow key or by hovering, so the two can never disagree.

The list floats over the page instead of pushing it down — a results list
that reflows the screen under your cursor is how you click the wrong thing on
the third keystroke.

### Why it is not on the table view

It searches what has already been fetched, and costs no query at all. The
Console has every workshop with its registrations; the board fetches them
when it is shown. The table view has only the workshops, so the box appears
with the board and not beside the table.

---

## 17. Online classes

An Online or Hybrid course gets a **classroom**: a Jitsi Meet room embedded in
the school's own pages. Jitsi is open source and its public server is free,
which is the whole reason it is here — an online course should not cost a
room licence a month.

It is not just a video call bolted on. The presenter's screen at
`/w/:id/class` has the class and the **register** side by side, so who is in
the room and who is on the course are one question, not two.

### Opening a class

**Class** appears on the workshop page when the mode is Online or Hybrid.
Pressing **Open the class** mints a room, publishes the join link and lets
students in — one press, the same shape as publishing a registration page.
**Close the class** takes the room off the public page again.

`meet.jit.si` asks whoever opens a room to sign in once, with Google, GitHub
or Facebook. Students are never asked to. The screen says so, because being
asked to log into something you were not expecting is alarming if nobody
warned you.

### Room names are minted, never typed

A Jitsi room has no guest list: anyone who knows the name can walk in, and a
room called `physics-class` on a public server **will** be walked into. So a
room is `beyond-guidance-aihow26-` plus sixteen random characters — a
readable half so a presenter running three courses knows which room they just
opened, and about eighty bits of randomness so nobody arrives by guessing.
The alphabet leaves out `l`, `o`, `0` and `1`, because these get read down a
phone.

Typing a short name over it is allowed and **warned about** on the spot.
Somebody moving a class onto a room their institution already uses has a
reason, and a warning is the right way to disagree with them.

**New room** moves the class and kills every link already sent — the only way
to shut out a link that has been forwarded.

### The link a student gets

`/class/:workshopId`, on the school's own site. **The room name is never in
it.** That indirection is the design: the room can be replaced after a leak,
and the class can be closed between sessions, without forty phones needing a
new link. It is added to the ticket and the WhatsApp message automatically —
but only while a class is actually open, so a message kept for weeks never
carries a link that does nothing.

The student is asked for a name before joining, and optionally their ticket
ID. Nobody attends as "Fellow Jitster": a register has to know who was there,
and a class has to know who is talking.

The room reaches the public mirror **only while the class is open**. That is
what makes closing a class close it, rather than hiding a button on a page
anyone can skip. A course switched from Online to Offline stops publishing
too — `classOpen` and `meetingRoom` outlive a change of mode, so the mode is
checked every time rather than trusted once.

### The lobby, and who can do what

The presenter's room turns its **lobby on** without being asked. It is the
one control that still works after a link has been forwarded: the room stops
being open and starts being knocked on. The safe setting should be the one
you get without knowing to ask for it.

| | Presenter | Student |
|---|---|---|
| Microphone, camera, chat, raise hand, tile view | ✓ | ✓ |
| Screen share | ✓ | — |
| Mute everyone, lobby and security, recording | ✓ | — |
| Arrives muted | — | ✓ |

Screen sharing is a presenter's, as it is on every teaching platform — a
class where anyone can put their screen on the wall is a class that gets
interrupted. The presenter can still hand it over from the participants pane.

### Attendance from the room

The side panel lists three things, and the last two are the interesting ones:
who is **present** (on the register and in the room), who is a **stranger**
(in the room, not on the register), and who is **missing**. Matching is by
ticket ID first — the student only has to have typed it somewhere in their
name — then by exact name.

Nothing is guessed. A near-miss is reported as a stranger rather than quietly
credited to somebody with a similar name, and two people of the same name are
matched to neither. This feeds attendance, and attendance is a record about a
person.

**Mark N present** writes today's register. It only ever marks people
**present** — never absent. Students join late and connections drop, and a
register that records that as absence is lying about them. Absence stays a
decision somebody makes on the attendance screen.

### What the class leaves behind

A live class is the one thing this system produces that vanishes when it
ends. Somebody who missed it, or who was there and is revising, had nothing.
Three things are written **while the class runs**, because afterwards nobody
remembers to, and all three appear on the student's screen live:

| | |
|---|---|
| **Notes** | One page the presenter types on. Everyone in the class reads it as it is written. |
| **Transcript** | What was said, line by line, with the time. |
| **Handouts** | A link, or a small PDF, on every screen at once. |

There is also **Record the class**, which saves a video of the session.

### What these cannot do, said plainly

There is no server here — Firebase Hosting serves files and Firestore holds
documents, and nothing runs in between. That is what keeps this app free to
operate, and it sets three real limits. Each is stated **on screen where it
matters**, not buried here:

- **The transcript hears the presenter, not the class.** It is the browser's
  own speech recogniser listening to the microphone of the machine it runs
  on. A student's voice arrives as decoded audio inside the meeting frame and
  never passes that microphone. A lecture transcribes well; a discussion does
  not. Chrome and Edge have the recogniser; Safari and Firefox largely do
  not, and are told so rather than given a button that does nothing.
- **A recording is saved to the presenter's computer.** It captures a screen
  they pick — share the tab the class is in and you get everybody's video and
  everybody's voice — with their own microphone mixed in, because a shared
  tab carries every voice except the sharer's own. There is nowhere to upload
  an hour of video to, so it downloads as a `.webm` named for the course and
  the day.
- **A handout PDF must be under 600 KB.** A Firestore document is 1 MiB in
  total and base64 costs a third more than the bytes it carries. Anything
  larger is shared as a link, and the refusal says the actual size, the
  actual limit, and to put it on Drive instead.

Transcription is flushed on a timer rather than written line by line: a class
produces a line every few seconds, and a document write each would be a write
every few seconds for an hour. A dropped connection costs seconds of speech
rather than the hour. The day's lines live in **one** document, capped at
200,000 characters, and a class that runs past it drops its **oldest** lines
— the end of a lecture is the part people revise from.

### Who may read them

Students have no account, so the rules allow the read **only while the class
is open** — the same switch that publishes the meeting room. Closing a class
closes its notes with it, and a course that never met online exposes nothing.
Verified against the emulator: with the class open a stranger reads the
notes, the transcript and the handouts and **nothing else** — not the
workshop, not a registration, not a photograph, not the attendance register —
and can write none of them. Deleting a workshop takes all three with it, or
orphaned notes would stay readable for as long as the mirror said the class
was open.

### When it will not load

The meeting software is a script from another origin, so it is blocked by a
firewall, by a locked-down browser, and by a Content-Security-Policy that has
not been told about it. The default outcome of all three is a silent empty
box a minute before a class starts. So the load is timed out, and failure
shows the way in that does not depend on us: a direct link to the room on the
Jitsi server itself.

### What had to be allowed

Three lines in `firebase.json`, and the third is the one that bites:

- `script-src` — `external_api.js`
- `frame-src` — the meeting itself
- `Permissions-Policy` — **`camera=()` and `microphone=()` deny the device to
  every origin including our own.** Left alone, the class would have loaded a
  video call that could never see or hear anybody.

The room's own traffic is inside that frame and governed by its origin, so no
`connect-src` entry is needed.

Self-hosting a Jitsi means changing `ISSUER.meetingHost` in
`src/lib/schema.js` and those three places. Everything else addresses the
server by that one name.

---

## 18. Phone numbers

Everything is stored as `+91 98452 89298` — country code, then the number.
The sanitisers in `src/lib/db.js` and `src/lib/publicdb.js` put every `tel`
field, and every list marked `phones: true`, into that shape on the way in,
so the register, the tickets and duplicate detection all compare the same
thing.

Records written before that are however somebody typed them: `9845289298`,
`09845289298`, `+919845289298`. Two spellings of one number is not untidiness
— it is the office dialling a number that duplicate detection thinks it has
never seen.

**Console → Phone numbers** fixes those in place.

- **Check** writes nothing. It reads every workshop, every registration and
  every request, and lists exactly which fields it would rewrite and what
  each becomes.
- **Rewrite** applies it, in batches, as merge patches — so a document keeps
  every field this has no opinion about, and `updatedAt` is deliberately left
  alone: that date should say when a person last changed the record, not when
  a formatter passed over it.

It only ever moves a number **into** the standard shape, never out of one, so
running it twice is safe: the second pass finds nothing.

**What it will not touch.** Anything `formatPhone` cannot confidently read is
returned exactly as it was given — a foreign number, or a note somebody typed
into the field instead of a number. Mangling those would destroy information
that a bad format merely makes ugly. Nor does it touch lists of *names*:
resource persons and coordinators are lists too, and only a list the schema
marks `phones: true` is treated as numbers.

An Indian landline **is** migrated, and correctly — `080 2345 6789` becomes
`+91 8023456789`, which is country code, then Bangalore's area code with the
trunk `0` dropped, which is what that `0` is for.

Handled requests are included, not just waiting ones: a rejected request can
be restored and its number dialled, so it has to be right too.

Where a workshop has a published registration page, its public mirror is
rewritten in the same pass — otherwise the poster and the office would end up
quoting different numbers. Where a workshop has **no** mirror, none is
created; merging into a document that does not exist would publish a workshop
consisting of nothing but a phone number.

It runs from the app as the signed-in administrator, over the ordinary client
SDK, so the security rules are the thing permitting it rather than something
being bypassed. A `firebase-admin` script would have meant creating and
looking after a permanent service-account key for a one-off tidy-up.

---

## 19. Tests

```bash
npm test
```

Runs 469 assertions on Node's built-in test runner — no extra dependencies,
no config — over the parser, ticket allocation, duplicate detection, totals,
the spreadsheet writer, certificates, image shrinking, ID cards, attendance
sheets, online classes, the class record, search, returning students,
carry-forward and the phone-number migration. The parser
is heuristic and fails **silently** when it fails at all, so anything you teach
it belongs in `tests/parser.test.js` alongside a paste that used to break it.

The Firestore layer in `src/lib/db.js` is not covered here; testing it needs
the Firebase emulator.

---

## 20. Colour

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

## 21. Attribution

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

## 22. Notes

**The sidebar does not move.** It was an ordinary flex item as tall as the
document, so scrolling a board of forty registrations carried the navigation
off the top of the screen. It is now `position: sticky` at the viewport
height — sticky rather than fixed, so it stays in the flex row and the work
column still measures itself against its real width instead of a margin kept
in step by hand. A stretched flex item is already the height of everything
and has nowhere to stick to, so it takes `align-self: flex-start`.

Its right edge is a **drag handle**: pull it between 168 and 420 pixels,
double-click to reset, and the width is remembered. It is a `separator` you
can reach with Tab — arrows nudge it, `Home` puts it back — because a control
that only exists as a six-pixel strip of cursor is a control some people do
not have. The clamp lives in `src/lib/sidebar.js` and is tested: a sidebar
dragged to nothing is a navigation you cannot get back, since the control
that widens it is inside the thing that vanished.

The one place a scrollbar is allowed inside it is the link list, and only in
a window too short to hold the nav at all. The brand and the sign-out button
stay where they are either way.


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
- Phone numbers are stored one way — `+91 9339214522` — however they were
  typed. A bare ten digits, a leading zero, `0091`, spaces, dashes or brackets
  through the middle, or an existing `+91` all end up identical, so the same
  number cannot appear in the register in four shapes.

  It never guesses. A number it cannot confidently read as Indian — too short,
  an odd length, or an explicit country code that is not `+91` — is stored
  exactly as it was typed. Mangling somebody's landline into a mobile is worse
  than leaving it untidy.

  This applies to a workshop's **Enquiry Numbers**, a registrant's
  **WhatsApp #** and **Emergency Contact**, and numbers arriving from the
  public registration form. Lists of *names* — resource persons, coordinators
  — are untouched; the field carries a `phones` flag to say which is which.

  `formatPhone()` is for storage and display; `normalizePhone()` still returns
  the digits-only form the `wa.me` links and duplicate detection use, and both
  read the new shape.

---

## 23. Verifying the security rules

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

The current rules were checked this way — 58 assertions covering: signed-out
and not-on-the-list accounts are refused everything; a listed administrator
can read and write workshops and registrations but cannot add, read or delete
another administrator; the owner address has **no** data access until it adds
itself to the allow-list, cannot add anyone else, and cannot claim a record
under a different email; oversized and bloated documents are rejected; and
every unmatched path is closed.

Fifteen cover the attendance register — no read, list, write or delete by a
stranger or an anonymous visitor, any field but `marks` refused, a non-map
refused, and the 2000-per-day cap enforced at the boundary. Another fifteen
cover participant photographs specifically, since they are
the most personal thing stored: no read of any kind by a stranger or an
anonymous visitor, no listing, no write, no delete; a document carrying any
field but `photo` refused; a non-string refused; and the 400KB cap enforced
at the boundary rather than trusted from the browser.
