# The harness

Every admin screen needs a live Firestore to render, and a development
machine without production credentials has none. Rather than look at the
admin through screenshots taken elsewhere, this mounts the **real**
components against fabricated records.

```
npm run harness          # http://localhost:4180
```

Then open a screen by path:

```
http://localhost:4180/?at=/                       the board
http://localhost:4180/?at=/w/AIHOW26              one workshop
http://localhost:4180/?at=/w/AIHOW26/attendance   taking the register
http://localhost:4180/?at=/w/AIHOW26/t/r0         a ticket
http://localhost:4180/?at=/w/AIHOW26/cards        ID cards
http://localhost:4180/?at=/register/AIHOW26       the public form
http://localhost:4180/?at=/class/AIHOW26          the class page
```

## How it works

`vite.config.js` aliases the data modules to the stubs beside it. The
aliases match only **relative** specifiers that walk straight up into
`lib/` — the ones the app itself writes — so a stub can import the real
module as `../../src/lib/…` without matching its own alias.

Each stub therefore re-exports the real module first and overrides only
the calls that would reach the network:

```js
export * from '../../src/lib/publicdb.js';
export async function getPublicWorkshop() { return WORKSHOP; }
```

An explicit local export wins over `export *`, so the overrides take
effect and everything else stays real. A stub that listed its exports by
hand went stale the first time somebody added one, and failed as "does
not provide an export named …" on a screen unrelated to the change.

`AuthContext.jsx` is stubbed the same way: a signed-in administrator,
always.

## What it is not

Nothing here is loaded by the app. It is a development view, not a test
fixture, and it proves nothing on its own — a screen that renders is not
a screen that works. It is how the admin gets LOOKED at.
