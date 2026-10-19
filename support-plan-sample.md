# support-plan-sample.html: Interactive Support Plan (no-login sample)

## Purpose
An editable support plan for one young person (default "Leslie") in a CQC-regulated supported living service. One long page: a **cover**, a list of **sections**, and a **version log**. Built from `Interactive Support Plan: Build Specification`, **Phase 1 only** (storage option A, prototype on one device).

This is a **sample for testing before it goes into the live workflow**. It is not linked from `index.html`, uses **no Firebase and no login**, and sends nothing anywhere. Everything lives in the browser (IndexedDB) on the device it is opened on.

**It opens with fictional demo content.** The first time it is opened in a browser it loads a made-up plan for "Leslie Example" (see *Demo content* below) so there is something to look at. Add `?blank` to the web address (`support-plan-sample.html?blank`) to start with an empty plan instead. A browser that already has a saved plan keeps it; use Settings, "Load the fictional demo content" to load the demo into it.

## Access
- No sign-in. When the page opens it asks **"Who is using the plan?"**. The typed name is written into the version log against every change.
- A tick box, "I am acting as a manager", stands in for roles. It is needed to: restore a deleted block or section, delete a section, open a log entry (before/after + restore), and sign off a review. Real roles (manager / staff / viewer) arrive with sign-in in Phase 2.
- Opens in **view mode** (nothing can be typed into). **Edit** switches on block handles, plus buttons and the reason bar.
- The page has `noindex`. The data is not in the repo or on the server; the file is just the app.

## Four rules from the spec
1. Every section has exactly three fixed headings: `know` "What you need to know about me", `like` "How I like to be supported", `further` "How Connected Stars can support me further". Created by `makePanels()`; there is no UI to add, remove or rename them.
2. Under any heading, blocks in any order: text, bullet points, tables, photos, videos, files.
3. New sections get the three headings automatically and are placed before "Review and sign-off".
4. Every change goes to an append-only version log.

## Screens / areas
- **Top bar**: logo, search, text size (A- / A+), high contrast, Print or PDF, Backup, Settings, user chip, Edit.
- **Edit bar** (edit mode): "Reason for these changes" box, pending-changes note, Saved indicator, Done editing.
- **Alert bar** (sticky, all screens): red strip naming any severe allergy.
- **Left menu**: Cover, numbered sections, Version log. Edit mode adds drag handles, up/down arrows and **+ Add section**. Becomes a slide-out menu under 900 px.
- **Cover**: logo band, large square photo (click in edit mode: upload, take photo, crop, re-crop, consent, remove), title "[Preferred name]'s support plan", facts list, severe-allergy strip under the photo.
- **Sections**: three collapsible headings each. Hidden sections show a "Show section" placeholder in edit mode and disappear in view mode, menu and print.
- **Version log** (last page): filter by section / person / date, Export CSV, Print, manager sign-off.

## Cover facts
Typed: preferred name, full name, date of birth, address, moved in, how I communicate (one line), funder. Picked from **Support team** rows: key worker, registered manager (defaults to the row whose Role matches "key worker" / "manager"). Automatic: plan created, **last reviewed** and **next review date** (from the latest row of the Reviews table by Review date), plan version (from the log).

## Blocks
| Type | Stored as | Notes |
|---|---|---|
| `text` | `html` (sanitised: p, br, b, strong, i, em, ul, ol, li, h4, div) | Bold, bullet and numbered lists, small sub-heading. Pastes as plain text. "Bullet points" in the add menu is a text block that starts as a list. |
| `table` | `columns[]`, `rows[]` | See below. |
| `image` | `items[{mediaId, caption, alt}]` | 1 to 6 photos as a grid. Resized to 2000 px long side (JPEG 0.85, which also drops EXIF/GPS). Click to enlarge (lightbox, arrows, Esc). Upload or camera (`capture`). |
| `video` | `mediaId`, `caption` | MP4 / WebM. No autoplay. Poster taken at about 1 s and stored as `posterRef`. Size limit in Settings (default 200 MB). |
| `file` | `mediaId`, `name`, `date` | PDF / Word. Opens in a new tab (Word downloads). |

Every block: move up/down, **Move to...** (any section/heading), Delete (soft: `deleted: true`, `deletedBy`, `deletedAt`; managers see a "deleted blocks" tray and can restore), and a small "Last edited by ..., date" line. Every photo/video has a **consent** chip (who agreed + date); a warning shows until filled.

### Tables
- Column types: `text`, `longtext`, `date`, `dropdown`, `tick`, `number`, `rating`, `contact`. Column settings (the "⋮" button): rename, change type (entries that do not fit are cleared but stay in the log), dropdown choices, move left/right, sort A-Z / Z-A, delete.
- Rows: add, delete (asks first if it holds data), up/down, drag by the handle. Sort reorders the stored rows.
- Start **blank** or from any of the **34 ready-made tables** (`TPL`), which the 12 default sections are built from. Each template names its section, default heading and columns; some have pre-filled rows (NHS details, Eating and drinking, Missing person, Support team).
- `Rating (calculated)` in Risk assessment is a `text` column with `calc: 'risk'`: likelihood x severity, 1-4 Low, 5-12 Medium, 15-25 High.
- Signature cells (Sign-off) are `text` columns with `sig: true`: type a name, or **Draw signature** (stored as a PNG data URL in the cell).
- **Contacts are stored once** in `S.contacts`. The Contacts directory block has `bound: 'contacts'` and edits that list directly. A `contact` cell holds a contact id only and shows the name, role and phone live, so a change in the directory shows everywhere. Only one Contacts directory is allowed.

### Behaviours the spec asks for
1. Contacts stored once (above).
2. Any Allergies row with Severity = Severe shows a red strip on every screen (sticky), under the cover photo, and in the print footer. Looks at all non-deleted allergy tables, including ones in hidden sections.
3. Section 9 (Behaviour support), or any section, can be hidden: content is kept and the change is logged.

## Version log
Entry fields: `id, version, at (ISO UTC), by, sectionId, panelKey, blockId, action, summary, reason, approvedBy, snapshotRef`, plus `sectionTitle`, `panelHeading`, and `before` / `after` (block snapshots) so a manager can see what changed and restore it.

- **One entry per editing session on a block.** Keystrokes call `Log.session()`; the session ends when the user leaves the block, after 5 minutes without edits, or on Done editing. A session that changed nothing (typed then undone) writes nothing.
- **One-off events** (add, move, delete, restore, upload, consent, row/column changes, section changes) call `Log.event()` / `rowOp()`.
- Finished sessions and events wait in `Log.queue` and are written together by `Log.commit()` on **Done editing**, so one **reason** (asked then, or typed in the edit bar) applies to the whole editing period. They are also committed after 5 minutes idle, when the page is hidden, before print/backup, and immediately for events made outside edit mode. The waiting queue and open sessions are saved with the plan (`plan.pending`) so a closed tab loses nothing; they are recovered into the log on next open ("saved when the page was closed").
- Version `major.minor`: minor +1 on every entry. **Manager sign-off** makes major +1, minor 0, stores a full JSON snapshot (`snapshotRef`, downloadable from the entry) and records `approvedBy`.
- Entries can be opened by a manager: before/after text, **Restore this** (puts the earlier block back, or un-deletes a block/section) which is itself logged.
- Filter by section / person / date, Export CSV (current filter, UTF-8 with BOM), Print. Shows the newest 100; "Show all" or printing shows everything.
- The page has no way to edit or delete an entry. This is only a **page rule** in Phase 1 (see limits).

## Storage interface
`Storage` (in the script) is the only code that touches IndexedDB:
`loadPlan()`, `savePlan(data)`, `uploadFile(ref, blob)`, `fetchFile(ref)`, `addLog(entry)` (+ `listLog()`, `listFileRefs()`, and `wipe()` used only by "erase" and "import"). There is deliberately **no update or delete for log entries**. Phase 2 swaps this object for one that calls the online service; the screens do not change.

IndexedDB database `cs-support-plan-sample`, stores `kv` (key `plan` = `{plan, sections, contacts, media}`), `files` (blobs by `storageRef`, posters as `<ref>-poster.jpg`, sign-off snapshots as `plan-001/snapshot-vN.0.json`), `log` (auto-increment). If IndexedDB is unavailable (some private windows) it falls back to memory and warns that nothing will be kept.

## Data model
Matches the spec's five lists, held in `S = { plan, sections, contacts, media }` and `LOG`:
```js
plan: { id, personLabel, preferredName, fullName, dob, address, movedIn, commLine, funder,
        keyWorkerRowId, managerRowId, coverPhotoMediaId, createdAt, updatedAt, version,
        settings: { logoUrl, maxVideoMB }, pending: { sessions[], queue[] } }
sections: [{ id, key, title, order, isDefault, visible, deleted, deletedBy?, deletedAt?,
             panels: [{ key: 'know'|'like'|'further', heading, blocks: [block] }] }]
block (common): { id, type, order, deleted, deletedBy?, deletedAt?, createdBy, createdAt, updatedBy, updatedAt }
table block:    + { title, templateKey, bound?: 'contacts', columns: [{ id, label, type, options?, max?, calc?, sig? }],
                    rows: [{ id, cells: { [columnId]: value } }] }
contacts: [{ id, name, role, organisation, phone, email, involvement, shareInfo, lastContact, deleted }]
media: [{ id, kind: 'image'|'video'|'file', fileName, mimeType, sizeBytes, storageRef, posterRef,
          consent: { recorded, agreedBy, date }, uploadedBy, uploadedAt }]
```
`nextReviewDate` is worked out from the Reviews table when shown, not stored. Ids are unique strings, times ISO 8601 UTC, dates `YYYY-MM-DD`. Nothing is hard-deleted except table rows removed by the user, which are kept in the `before` snapshot of the log entry.

## Search
One box in the top bar searches the cover facts, section titles, text blocks, every table cell (contact cells by name/role/phone), table titles, photo captions and alt text, video captions and file names. Click a result to jump to it (panel opens, block flashes). Hidden sections are not searched in view mode.

## Backup and restore
**Backup** makes one `.zip` (files stored uncompressed, valid ZIP with CRC): `plan.json`, `versionLog.json`, `files/<storageRef>` for every photo, video, file, poster and sign-off snapshot. **Restore** replaces everything in this browser from such a file (after a warning), then logs "Backup imported". Version log also exports as CSV on its own. Settings has **Load the fictional demo content (Leslie Example)** and **Erase everything** (must type ERASE; this gives a blank plan, not the demo).

## Demo content
Everything is fictional. "Leslie Example" is not a real person; phone numbers use the reserved UK drama range (`020 7946 0xxx`) and emails end in `.invalid`. Medicine names are generic placeholders ("Example medicine A").

`applyDemo()` (in the `FICTIONAL DEMO CONTENT` block) fills:
- the cover facts, and a cartoon cover photo (with consent recorded);
- every one of the 34 ready-made tables from `DEMO_ROWS` (rows follow each template's column order; a value such as `'@gp'` in a Contact column becomes that contact), including a severe peanut allergy (so the red strip shows), calculated risk ratings, and Reviews dates that drive "Last reviewed" and "Next review date";
- the Contacts directory (`DEMO_CONTACTS`, stored once, picked by the Legal representatives and Emergency contacts tables);
- text and bullet blocks (About me, Daily support), a 3-photo block (two with consent, one left without so the warning icon shows), a 3 second cartoon video with poster (a 20 KB WebM embedded as base64 in `DEMO_WEBM_B64`), a PDF file block (built in the page by `demoPdf()`), and an extra **School and college** section placed before Review and sign-off.
- Pictures are small SVG drawings (`DEMO_ART`) turned into JPEGs by `demoPicture()`. Nothing is downloaded.

Demo blocks are marked `demo: true`, the extra section `demoSection: true`, and `plan.demo = true` changes the top bar subtitle. Running the load again first removes those blocks and the section, so it never duplicates. Demo blocks and rows show "Last edited by Demo data (fictional)". The log records one entry "Fictional demo content loaded", attributed to whoever was using the page. On a brand-new browser the demo loads right after the name prompt, unless the address has `?blank`.

## Look, access and print
- Brand blue `#1446a0` for headings, buttons, links; gold appears only inside the star logo (the logo is gold star + white wordmark, so it sits on a blue band). Roboto body, Roboto Black (900) headings, as the spec requires (the other tools use DM Sans). Logo loaded from the address in Settings (default: the official logo in `CS-Documentation/invoice`).
- **No em dashes and no horizontal divider lines** in page content or print: structure comes from tinted cells and spacing, not rules.
- Keyboard works throughout (real buttons, visible focus, Esc closes dialogs), alt text on photos, text size A- / A+ (12 to 24 px), high contrast toggle; both remembered in `localStorage` (`csPlanSamplePrefs`, with the last name).
- Large touch targets on touch screens; works as a slide-out menu + horizontally scrolling tables on tablets and phones.
- **Print / Save as PDF**: view layout, cover photo on page 1, each section starts a new page, every heading expanded, name + version + date (+ severe allergy note) in every footer, videos print as their poster picture with caption, full version log at the end.

## Known limits of Phase 1 (from the spec, plus what testing showed)
- **The log is not tamper-proof.** The page offers no edit/delete, but anyone with the browser's dev tools can change IndexedDB. Locking it at storage level is Phase 2.
- **"Changed by" is a typed name**, not a verified identity, and the manager tick is not security.
- **One device only.** No sharing, and data is lost if site data is cleared. **Not suitable as the live record.** Use Backup regularly.
- Health information and photos are special category data. Before live use: sign-in with roles, encryption in transit and at rest, UK/EEA hosting, no public links, recorded consent, backups and a DPIA (spec "Data protection").
- Demo content is for looking at and testing only. The cover, tables and contacts are fictional; delete it (Settings, Erase everything) before anyone types real information, and do not use the demo on a live plan.
- The Phase 2 overdue-date alert strip (review/expiry dates that have passed) is not built.
- Roboto and the logo load from the internet; offline they fall back to a system font and the logo is hidden.
- Word files download rather than open in a tab (browser behaviour). HEIC photos only work where the browser can decode them.
- Unsaved edits are saved on every change, and the log is written on Done editing / idle / hide. A forced browser kill between a change and the next save debounce (about 0.4 s) could lose that last change.

## State variables
```js
S                 // { plan, sections, contacts, media } the live plan
LOG               // version log entries (append only)
ui                // { edit, printing, user:{name,manager}, collapsed{}, reason, editCount, logFilter{}, logShowAll }
prefs             // { name, manager, fs, hc } mirrored to localStorage
Log.sessions      // open editing sessions by block id ('cover' for the cover)
Log.queue         // finished entries waiting for Done editing
Media.urls        // object-URL cache by storageRef
```

## Key functions
| Function | Purpose |
|---|---|
| `defaultState()`, `makeTableBlock(tpl)`, `makePanels()` | Build the 12 default sections and ready-made tables |
| `Storage.*` | The five-method storage interface (IndexedDB, memory fallback) |
| `Log.session / event / commit / append / recover` | Version log: sessions, one-off events, writing, crash recovery |
| `scheduleSave()` / `doSave()` / `flushNow()` | Debounced save of `S`, "Saved" indicator |
| `renderAll()`, `renderCover()`, `renderSection()`, `renderPanel()`, `renderBlock()` | Build the page (DOM, no innerHTML except sanitised text) |
| `rerenderBlock()` / `rerenderPanel()` | Redraw only what changed so scroll and focus are kept |
| `renderTable()`, `renderRow()`, `renderCell()` | Tables and the eight column types |
| `rowOp(loc, action, summary, fn)` | Snapshot, change, log with before/after, redraw |
| `openColumnDialog()`, `sortRows()`, `moveRowBy/To()` | Column settings, sorting, row order |
| `openAddMenu()`, `openTablePicker()`, `addPhotoFlow()`, `addVideoFlow()`, `addFileFlow()` | Add content |
| `resizeImage()`, `videoPoster()`, `openCropper()` | Photo resize, video poster, cover square crop |
| `openConsent()`, `consentChip()` | Consent record + warning icon |
| `severeAllergies()`, `reviewInfo()`, `teamRows()` | Facts worked out from the tables |
| `moveSection()`, `setSectionVisible()`, `deleteSection()`, `addSectionDialog()` | Section management |
| `openLogEntry()`, `restoreFromEntry()`, `signOffDialog()`, `exportLogCsv()` | Log page tools |
| `runSearch()` / `searchIndex()` | Search |
| `exportBackup()` / `importBackup()`, `zipWrite()` / `zipRead()` | Backup file |
| `printPlan()`, `enterPrintMode()` / `leavePrintMode()` | Print layout |
| `applyDemo()` / `fillDemo()` | Load the fictional demo plan (`fillDemo` is the Settings button: asks first, then calls `applyDemo`) |
| `demoPicture()`, `demoPdf()` | Draw a demo picture from SVG; build the demo PDF |
| `window.__plan` | Console/test handle: `{ S, LOG, ui, Storage }` |

## Moving to Phase 2 (online, with sign-in)
Replace `Storage` with calls to the chosen service (database + file storage in the UK/EEA); replace the typed name and manager tick with the signed-in user and a role; make the service refuse updates and deletes on log entries; store sign-off snapshots server side; add the overdue-date strip. The data model above is already shaped for it (media referred to by id, log append-only, ids as strings).

## Open decisions (from the spec)
- Whether section 9 stays on for Leslie (it is on by default; hide it from the section's Hide button).
- Whether the first live build is option A only or goes straight to option B.
- Which GitHub repository the live build goes into (this sample is in `cs-tools`).
