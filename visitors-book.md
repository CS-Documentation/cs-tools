# visitors-book.html / visitors-book-log.html — Visitors Book

## Purpose
A digital visitors' book. Anyone who arrives opens **`visitors-book.html`** (no login), taps **Sign in** or **Sign out**, and fills in a short form. Staff read the book in **`visitors-book-log.html`** (staff login): who is on site right now, and a searchable history that can be exported to CSV.

## Access
- **`visitors-book.html`** — public, no login, no PIN. Signs in to Firebase **anonymously** in the background so it can write to Firestore. It can only **add** entries: it never reads the book back, so one visitor can't see who else has visited. Not linked from `index.html` (it's for visitors; staff reach it from the log page's "Open visitor page" / "Copy visitor link" buttons). Has `noindex` so search engines skip it, and no link back to the staff dashboard.
- **`visitors-book-log.html`** — staff email/password login (same sign-in pattern as the other tools: username without `@` gets `@connectedstars.co.uk` appended). Any staff member with an **active** `staffProfiles/{uid}` doc can use it — **not admin-only**, because "who is on site?" is an operational question for whoever is on shift (fire roll call). Archived staff and users with no profile see Access Denied. A leftover **anonymous** session (e.g. from a kiosk on the same browser) is treated as "not signed in" and shows the login form. Listed on the `index.html` dashboard under "Your Tools".

### Separate Firebase app on the public page
`visitors-book.html` calls `initializeApp(config, 'visitors-book')` — a **named** app — instead of the default. Firebase Auth stores its session per app name, so the visitors page's anonymous session lives separately from the staff session the other tools use. Without this, a staff member opening the public page on their own computer would have their login replaced by an anonymous one and be signed out of every other tool on the site.

## Public link and QR code
- **Link visitors use**: `https://cs-documentation.github.io/cs-tools/visitors-book.html` (GitHub Pages serves whatever is on `main`, so a change only goes live once it is merged there). Direct links: `…/visitors-book.html#sign-in` and `…/visitors-book.html#sign-out`.
- **`visitors-book-qr.png`** (1176 px, for printing/sharing) and **`visitors-book-qr.svg`** (scales to any size) are a QR code for the link above, in brand blue with 25% error correction so it still scans if a printout is scuffed. Checked by decoding the PNG (full size and shrunk to 160 px) back to the exact URL.
- If the site address ever changes, regenerate both files — they encode the URL, not the page — e.g. `python3 -m pip install segno`, then `segno.make(URL, error='q').save('visitors-book-qr.png', scale=24, border=4, dark='#1446a0')` (and the same for `.svg`).
- The Pages address was inferred from the repo name (no custom domain file in the repo) and could not be fetched from the build sandbox; open the link once after merging to confirm.

## `visitors-book.html` flow
1. **Home**: two large buttons, *Sign in* (I'm arriving) and *Sign out* (I'm leaving).
2. **Sign in form**: name, young person visiting (free text — a name or initials), purpose of visit, date, time.
3. **Sign out form**: name, date, time.
4. **Done screen**: "You're signed in / out" with the recorded time, then **returns to the start after 10 seconds** (or on *Finished*). The form is cleared on submit and again each time a form is opened, so the next visitor on a shared device never sees the previous visitor's details.
5. Screens are driven by the URL hash so each can be linked directly or put on a QR code: `visitors-book.html#sign-in`, `visitors-book.html#sign-out`. Browser Back returns to the start.

### Date and time (UK time)
- The date and time boxes are **filled in with the current UK time every time a form is opened** (not just when the page first loads, so a tablet left open all day never shows a stale time). Visitors can edit both; **Reset to now** puts the current time back.
- "UK time" means `Europe/London`: `ukNow()` uses `Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hourCycle: 'h23', … })`, so **BST/GMT is handled automatically** and does not depend on the visitor's device timezone. The hint under the boxes shows `BST` or `GMT`. (`hourCycle: 'h23'` avoids some browsers printing midnight as `24:05`.)
- Verified with the device set to another timezone: summer → BST (+1h), winter → GMT, the minute either side of both clock changes (29 Mar 2026 01:00 UTC, 25 Oct 2026 01:00 UTC), and a late-evening UTC time that is already the next day in the UK.
- The boxes are plain `<input type="date">` / `<input type="time">`, so a phone shows its own native picker. The label says just "Time" because a device set to a 12-hour locale shows AM/PM; the **stored** value is always 24-hour `HH:MM`.
- A date/time more than 10 minutes **in the future** is rejected ("please check it"), which catches AM/PM slips.

### Validation and saving
- Required: name, young person, purpose (sign in); name (sign out); date and time. Inline errors under each field; names are trimmed and internal spaces collapsed.
- `sending` flag + disabled button: a double tap or repeated Enter **cannot create a duplicate entry** while a save is in flight.
- If the connection is slow, after 10 s a note says "Still saving… don't tap again". The write stays queued in the Firestore SDK and completes when the connection returns. **Limitation**: it is held in memory only, so reloading the page while offline loses it.
- If the save fails, the form stays filled in, an error appears and the button is re-enabled. If anonymous sign-in itself fails, a red banner asks the visitor to check the Wi-Fi and reload.

## `visitors-book-log.html` flow
- **On site now** tab (default): everyone who has signed in but not out, oldest first, with their time on site and a **Sign out** button. Looks back **14 days** and refreshes itself every minute (plus a manual **Refresh**). Visitors whose sign-in was on an earlier day carry an amber **Earlier day** chip (probably forgot to sign out). The count shows on the tab.
- **Staff sign-out** (button on each row): opens a small modal that writes an `out` entry on the visitor's behalf, stamped with the staff member's initials (`recordedBy`). For a same-day visit the time is pre-filled with UK now; for an **earlier-day** visit the date is the sign-in date and the **time is left blank** — staff must enter when they actually left, so the sign-out isn't recorded as "just now". Rejected if it is before the sign-in or in the future.
- **Visit log** tab: date range (defaults to today; *Today / Last 7 days / Last 30 days* shortcuts; From/To swap themselves if entered backwards), free-text search over name / young person / purpose, newest first, with a summary line. Each row shows sign-in, sign-out (with a "by XX" chip when staff signed them out) and time on site. **Export CSV** downloads exactly the rows shown.
- Sign-outs that match no sign-in are **never hidden** — they appear as rows marked "No sign-in found". Sign-ins with no sign-out show "On site" (today) or "Not signed out" (earlier days).

## Firestore collection: `visitorLog`
One document per **event** (a sign-in or a sign-out are separate documents; they are joined when displayed).
```js
{
  type: 'in' | 'out',
  name: string,          // as typed (trimmed, spaces collapsed), max 100
  nameKey: string,       // lowercase, accents and extra spaces removed — used to match a sign-out to its sign-in
  date: string,          // YYYY-MM-DD, UK local date (pre-filled, may have been edited)
  time: string,          // HH:MM, 24h, UK local time (pre-filled, may have been edited)
  youngPerson: string,   // 'in' only, max 100
  purpose: string,       // 'in' only, max 300
  recordedBy: string,    // staff initials — only on a sign-out entered by staff in the log page
  createdAt: Timestamp   // serverTimestamp() — when the entry was actually submitted (audit trail)
}
```
`date`/`time` are the visitor's (editable) values; `createdAt` is the real server time, so an edited time is still traceable. Entries are **never edited or deleted** by either page.

### Why events, not one record per visit?
Matching a sign-out to its sign-in needs a lookup. Doing that from the public page would mean letting every anonymous visitor **read the whole book** (names of everyone who has visited a children's home, and who they visited). Instead the public page is **write-only** and the joining happens on the staff page. The trade-off: matching is by name, see below.

### How a sign-out is matched (`pairVisits`)
Events are sorted by `date`+`time` (a sign-in sorts before a sign-out at the same minute, then by `createdAt`). Walking forward, each sign-in is "open" under its `nameKey`; a sign-out closes the **most recent open** sign-in with the same `nameKey`. So:
- `Jane Smith`, `jane smith` and `JANE  SMITH` match; `Jane Smyth` or `Jane` do not. An unmatched sign-out shows as an orphan row and the person stays "on site" until staff sign them out. That's why the sign-out page asks visitors to type their name as before.
- Someone who forgot to sign out yesterday and signs in again today has two open visits; today's sign-out closes today's visit and yesterday's stays flagged "Earlier day" for staff to close with the real time.
- Visit log lookback: the query starts 2 days before *From*, so a sign-out near the start of the range still finds its overnight sign-in; only visits whose **sign-in** date is in range are listed.

Queries filter on `date` only (`>=` and `<=` on one field), which needs **no composite index**; sorting and pairing happen in the browser.

## Firestore security rules (must be added once, in the Firebase console)
The rules are not stored in this repo. Without these, the public page's writes are denied (it shows "Sorry, that didn't save") and the log page shows a "you don't have permission" message. Add inside `match /databases/{database}/documents { … }`:
```
match /visitorLog/{entryId} {
  // Visitors (anonymous sign-in) can only ADD entries — never read, edit or delete.
  allow create: if request.auth != null
    && request.resource.data.keys().hasOnly(['type','name','nameKey','date','time','youngPerson','purpose','recordedBy','createdAt'])
    && request.resource.data.type in ['in', 'out']
    && request.resource.data.name is string
    && request.resource.data.name.size() > 0 && request.resource.data.name.size() <= 100
    && request.resource.data.nameKey is string && request.resource.data.nameKey.size() <= 100
    && request.resource.data.date is string && request.resource.data.date.size() == 10
    && request.resource.data.time is string && request.resource.data.time.size() == 5
    && request.resource.data.createdAt == request.time
    && (request.resource.data.type == 'out'
        || (request.resource.data.youngPerson is string
            && request.resource.data.youngPerson.size() > 0 && request.resource.data.youngPerson.size() <= 100
            && request.resource.data.purpose is string
            && request.resource.data.purpose.size() > 0 && request.resource.data.purpose.size() <= 300))
    // recordedBy (staff initials) may only be set by a real staff login, not an anonymous visitor
    && (!('recordedBy' in request.resource.data) || request.auth.token.firebase.sign_in_provider != 'anonymous');

  // Only signed-in staff can read the book.
  allow read: if request.auth != null && request.auth.token.firebase.sign_in_provider != 'anonymous';
}
```
**Check your existing rules first.** Firestore combines every matching rule with OR. If the project already has a broad rule such as `match /{document=**} { allow read, write: if request.auth != null; }`, then anonymous visitors **can already read** `visitorLog`, and the block above won't stop them. In that case tighten that rule (or exclude `visitorLog` from it).

Anonymous sign-in must be enabled in Firebase Authentication (the Hounslow kiosk and the other PIN-locked viewers already rely on this).

Public input is **untrusted** — anyone with the link can submit text. Hence: the log page escapes every visitor-supplied value (`esc()`) before it goes into the page, and the CSV export prefixes any cell starting with `=`, `+`, `-` or `@` with `'` so a spreadsheet never runs it as a formula. A determined person with the (public) Firebase key could still add junk entries within the size limits; the rules cap size and shape but can't rate-limit.

## State variables
`visitors-book.html`
```js
authReady    // promise for the anonymous sign-in; submit awaits it
doneTimer    // setInterval handle for the done-screen "returning in N seconds" countdown
sending      // boolean, true while a save is in flight (blocks duplicate submits)
```
`visitors-book-log.html`
```js
currentStaff   // the signed-in staffProfiles doc ({ id, name, initials, … })
activeTab      // 'site' | 'log'
autoTimer      // setInterval handle for the 60 s On-site refresh (only while that tab is open)
siteVisits     // Map of sign-in doc id → open visit, used by the Sign out buttons
soVisit        // the visit currently shown in the staff sign-out modal
logData        // { visits, orphans } for the current date range, before search filtering
logRows        // the rows currently displayed (what Export CSV writes)
logSeq         // counter so a slow earlier query can't overwrite a newer one
```

## Key functions
| Function | File | Purpose |
|---|---|---|
| `ukNow()` | both | Current UK date/time as `{ date: 'YYYY-MM-DD', time: 'HH:MM', tz: 'BST'|'GMT' }` via `Europe/London` |
| `fillNow(kind)` / `openForm(kind)` | public | Fill the date/time boxes with UK now; reset and prepare a form when it is opened |
| `validate(kind)` | public | Required fields + "not in the future" check, inline errors |
| `submitEntry(kind, e)` | public | Build the `visitorLog` doc and `addDoc` it; guards against double submit; shows the done screen |
| `nameKey(s)` | both | Normalise a name for matching (case, accents, spaces) — **keep the two copies identical** |
| `route()` / `navigate(name)` | public | Hash-based screen switching (`#sign-in`, `#sign-out`) |
| `pairVisits(events)` | log | Join sign-outs to sign-ins → `{ visits, orphans }` |
| `fetchEvents(from, to)` | log | One-field date-range query on `visitorLog` |
| `loadSite()` / `renderSite()` | log | On-site list (14-day lookback) |
| `openSignOut(id)` + confirm handler | log | Staff sign-out modal; writes an `out` event with `recordedBy` |
| `loadLog()` / `renderLog()` | log | Visit log for the chosen range, search filter, summary |
| `esc(s)` | log | HTML-escape visitor-supplied text — use for **every** value inserted into `innerHTML` |
| `csvCell(v)` | log | Quote a CSV cell and neutralise spreadsheet formulas |

## Not included (easy to add if wanted)
Company/organisation, vehicle registration, ID badge number, a "who are you visiting" picker (deliberately free text — a picker would expose the young people's names to anyone with the link), photo capture, and printing a visitor badge. Deleting or correcting an entry isn't supported from the UI; a wrongly-named sign-in can be closed with a staff sign-out, and bad rows can be removed in the Firebase console.
