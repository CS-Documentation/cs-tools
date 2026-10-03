# body-map-tracker.html / body-map-admin.html — Body Map Tracker

## Purpose
A read-only, PIN-locked daily dashboard for body maps. Staff fill in a Fillout form; Fillout writes each submission as a row in a Google Sheet; this tool **reads that sheet** and shows, for a chosen date, one section per young person (YP) — how many body maps were filled in, at what time, by whom, whether an injury/mark was recorded, and the details and photos if so. Structured like Task Manager Pro / the Hounslow kiosk: a PIN-locked viewer plus a Firebase-login admin panel.

Nothing is copied into Firestore — the Google Sheet is the single source of truth for entries. Firestore only holds the tool's own config (sheet link, YP list, PINs).

## Access
- **`body-map-tracker.html`**: no staff login. Signs in to Firebase anonymously; a 6-digit PIN (any active PIN in `bodyMapPins` — its own pool) is the UI-level gate. Same app-level-lock trust model as the Hounslow kiosk: the PIN list is readable by any anonymous client, so this keeps casual viewers out but is **not** per-user authentication. Auto-locks after 10 minutes idle; the Lock button (and auto-lock) clears the loaded entries from memory and the screen.
- **`body-map-admin.html`**: normal staff email/password login + `staffProfiles/{uid}.role === 'admin'`. An anonymous Firebase session (left over from opening the tracker in the same browser) is treated as "not signed in" and shows the login form rather than Access Denied. Listed on the `index.html` dashboard under Administration; the tracker itself is **not** linked from the dashboard (reachable by direct URL, like the kiosk).

## Google Sheet columns (header row, matched case/punctuation-insensitively)
| Header in sheet | Used as |
|---|---|
| `Submission_ID` | entry id |
| `Submission_DateTime` | fallback date/time only (when `Date and Time` is blank/unreadable — the entry is then labelled "Date taken from the form submission time") |
| `Date and Time` | when the body map was done |
| `YP Initials` | which young person (uppercased, non-alphanumerics stripped) |
| `Staff Name` | shown as "by …" |
| `Any Injury or Mark` | `Yes` / `None` → red / green tag |
| `BM_number`, `Location`, `Descrtiption`, `Further Actions` | detail fields (the form's header is misspelt "Descrtiption"; `Description` also accepted) |
| `Images` | one or more photo URLs (comma-separated; extracted with a URL regex) |

Required columns: a date column and `YP Initials`. If they're missing the tracker shows a "columns weren't recognised" error rather than an empty page.

## British Summer Time handling
The form's `Date and Time` is stored **in UTC**, so a body map done at 10:25 BST appears in the sheet as 09:25. The tracker converts it back to UK local time with `Intl.DateTimeFormat` / `Europe/London` (so it is correct on both sides of each clock change, and the date rolls over correctly for entries just after midnight BST) and prints `BST` or `GMT` beside each time so the conversion is visible.
- A bare date, or a time of exactly `00:00:00`, is treated as "date picked, no time entered" — it's shown as **"Time not recorded"**, never shifted. (Side-effect: a genuine 01:00 BST entry stores as 00:00 UTC and is indistinguishable from this; the date is still right.)
- Admin → Sheet & Times has a **time mode** setting: `utc` (default, convert) or `local` (sheet times already UK local, show as written) as a safety hatch if the form's behaviour ever changes. **Test connection** shows "sheet says … → shown as …" for the latest entries so a mismatch is obvious.
- Accepted date formats: `YYYY-MM-DD[ T]HH:MM[:SS]` (what the sheet exports) and UK `DD/MM/YYYY HH:MM[:SS]`. Anything else is reported, not guessed.
- **Not applied** to `Submission_DateTime` for display; it is only used as the fallback above, treated with the same time mode.

## Injury / mark classification
Per entry, from `Any Injury or Mark`:
- `Yes`, `Y`, `True`, or text starting `Yes` / `Injury` / `Mark` → **red** "⚠ Injury / mark recorded"
- `None`, `No`, `Nil`, `N/A`, `No injury (or mark)` etc. → **green** "✓ No injury / mark"
- Blank **but** any detail field/photo is filled → red (fail-safe)
- Anything else (blank with no details, or unexpected text such as "Maybe") → **amber** "? … — check", never silently treated as "no injury"

A YP's section header is red if any of that day's entries is red (with "n of m"), else amber if any needs checking, else green, else grey "No body maps". Injury/check entries show their detail fields (body map no., location, description, further actions) and photo thumbnails; photos open in a lightbox (←/→/Esc), with an "Open original" link. A photo that fails to load degrades to an "open link" box.

## Nothing is silently dropped
- Rows with no YP initials, or no readable date, are listed in an amber notice ("n rows couldn't be read" with sheet row numbers).
- Entries whose initials aren't in the YP list (e.g. a new arrival not yet added) appear under **"Entries for initials that aren't in your list"**.
- All sheet text is HTML-escaped; photo URLs must match `https?://…` or they're not extracted.

## `body-map-tracker.html` flow
1. Anonymous sign-in → PIN screen (`checkPin()` against active `bodyMapPins`).
2. On unlock: load `bodyMapSettings/config` + active `bodyMapYoungPeople` (sorted client-side by `order`, avoiding a composite index), then fetch the sheet CSV.
3. Date bar: date picker, ◀ ▶ day stepping, Today (London date, not browser date). Day summary: total body maps + injury/check counts.
4. One card per YP (responsive grid), entries sorted by time, no-time entries last.
5. Sheet re-fetched every 2 minutes while unlocked and the tab is visible, plus a manual **Refresh**; "Updated HH:MM" shown. Note Google's own "publish to web" cache can lag a few minutes behind the sheet.

## `body-map-admin.html` flow
- **Sheet & Times**: paste the sheet link, choose the time mode, **Save**, **Test connection** (fetches, parses, reports entries read / sample raw→shown times / initials found vs. your list / unreadable rows).
- **Young People**: add / edit initials, ▲▼ reorder, Hide/Show (soft, `status`), Delete. Seeded once with **BC, KW, JJ, RK, EG** on first load (guarded by `ypSeeded` so removing everyone later doesn't re-seed). Initials must be unique, 2–4 chars.
- **Access PINs**: add/edit/deactivate/delete, masked with show/hide — identical pattern to `hounslow-admin.html`.

### Connecting the sheet
`sheetCsvUrl(link)` turns what's pasted into a fetchable CSV URL:
- **Publish-to-web link** (`…/spreadsheets/d/e/…/pub…`) → `…/pub?[gid=…&]single=true&output=csv`. **Recommended** — a plain export of the tab.
- **Normal share/edit link** (`…/spreadsheets/d/<id>/…`) → `…/d/<id>/gviz/tq?tqx=out:csv&gid=<gid>` (gid from `?gid=`/`#gid=`, default 0). Requires "Anyone with the link → Viewer". Google's `gviz` endpoint infers a type per column and can blank out cells that don't fit it, so prefer the publish-to-web link if a value ever goes missing.
- Only `https://docs.google.com/spreadsheets/…` links are accepted.

The fetch is a cross-origin `fetch()` from the site's origin to Google; if it fails the browser gives the same generic error for a CORS block, an unshared sheet and a network drop, so the error text lists the likely causes instead of guessing.

## Firestore Collections
### `bodyMapPins`
Same shape as `hounslowPins` / `taskManagerPins` — `{ label, pin (plain-text 6 digits), status: 'active'|'inactive', createdAt, createdBy, updatedAt, updatedBy }`. Its own pool.

### `bodyMapYoungPeople`
```js
{ initials: string,            // must equal the form's "YP Initials" value
  order: number, status: 'active' | 'inactive',
  createdAt: Timestamp, createdBy: string, updatedAt?: Timestamp, updatedBy?: string }
```
Freeform initials — deliberately **not** linked to `serviceUsers` (the sheet only carries initials).

### `bodyMapSettings`
Single doc `bodyMapSettings/config`:
```js
{ sheetUrl: string,                 // any Google Sheets link; converted by sheetCsvUrl()
  timeMode: 'utc' | 'local',        // default 'utc'
  ypSeeded: boolean,                // default YP list already created once
  updatedAt: Timestamp, updatedBy: string }
```

## Assumptions to be aware of
- **Firestore rules**: the viewer needs anonymous-auth read access to `bodyMapPins`, `bodyMapYoungPeople`, `bodyMapSettings`; the admin needs admin read/write on all three. If the project's rules are per-collection rather than a blanket "signed in" rule, these three must be added — it will show as "permission denied" (viewer: "Couldn't load the tracker settings"; PIN screen: "Could not verify PIN").
- **The sheet is the access boundary for the data**: anyone holding the sheet link can read the sheet, and the photo URLs on Fillout's S3 are readable by anyone with the URL. The PIN gates the dashboard UI, not the underlying data. Stronger protection would need a server-side proxy (not in this no-backend repo).
- Whole-sheet fetch on each refresh: fine for now, but the CSV grows with every submission (photo URLs make rows long); if it gets slow, narrow the published range/tab.

## Shared code
No build step, so the **`// ── BEGIN CORE … END CORE ──`** block (CSV parser, header mapping, date parsing/BST conversion, injury classification, `buildEntries`, `sheetCsvUrl`, `esc`) is duplicated **verbatim** in both HTML files. Edit one → copy to the other.

## State Variables (viewer)
```js
enteredPin, unlocked, idleTimer, refreshTimer   // PIN/lock + 2-min auto-refresh
settings        // { sheetUrl, timeMode } from bodyMapSettings/config
ypList[]        // active bodyMapYoungPeople, ordered
entries[], skipped[]   // parsed sheet rows / rows that couldn't be read
selectedDate    // 'YYYY-MM-DD' (London)
loading         // guards overlapping fetches
lbPhotos[], lbIndex    // lightbox
```

## State Variables (admin)
```js
currentUser, currentStaff, settings, yps[], pins[]
editingYpId, editingPinId, revealedPins (Set), confirmAction
```

## Key Functions
| Function | Purpose |
|---|---|
| `parseCsv(text)` | RFC-4180 CSV parser (quoted commas/newlines/`""`, CRLF, BOM) |
| `buildEntries(rows, mode)` | Map header → columns, parse/convert dates, classify injury, extract photo URLs; returns `{entries, skipped, missing}` |
| `parseStamp(s)` / `resolveWhen(stamp, mode)` | Parse the sheet timestamp; convert UTC → Europe/London (`BST`/`GMT`) or pass through |
| `classifyInjury(raw, hasDetails)` | `'injury' \| 'none' \| 'check'` (fail-safe) |
| `sheetCsvUrl(link)` | Pasted Google Sheets link → CSV endpoint (or `null`) |
| `todayLondon()` | Today's `YYYY-MM-DD` in UK time |
| `checkPin()` / `lockViewer()` / `resetIdleTimer()` (viewer) | PIN gate, lock + clear data, 10-min idle lock |
| `refreshData()` (viewer) | Fetch + parse the sheet, surface errors/unreadable rows, re-render |
| `render()` / `entryHtml(e)` / `ypStatus()` (viewer) | Build the day summary, YP cards and entries |
| `openLightbox()` / `lbStep()` (viewer) | Photo viewer |
| `saveSettings()` / `testConnection()` (admin) | Save `bodyMapSettings/config`; fetch + report on the sheet |
| `seedDefaultYps()` / `saveYp()` / `toggleYp()` / `moveYp()` / `deleteYp()` (admin) | `bodyMapYoungPeople` CRUD + reorder |
| `savePin()` / `togglePin()` / `deletePin()` / `togglePinReveal()` (admin) | `bodyMapPins` CRUD + show/hide |
