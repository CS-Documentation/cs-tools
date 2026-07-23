# o-handover.html — O Handover Tool

## Purpose
Overnight / operational shift handover log. Tracks shift notes, alerts, reminders, tasks, key work, young person locations, and missing persons per unit per shift per date.

## Access
- All staff (role: `staff` or `admin`)
- Firebase email/password auth → `staffProfiles/{uid}`

## Layout
**Sidebar** (fixed left, 228px): logo (links to `index.html`/home) + navigation + unit selector at bottom  
**Topbar**: hamburger (mobile), logo, unit `<select>`, date `<input>`, shift tabs, user badge, refresh, sign out  
**Content area** (`#content`): one `.view` active at a time

### Shift Tabs
```
M (Morning)   — color: --shift-m (#1446a0 brand blue)  07:00–15:00
E (Evening)   — color: --shift-e (#7b2d8b purple)      15:00–23:00
S (Sleep-in)  — color: --shift-s (#0e7490 teal)        23:00–07:00
```
Shift value stored as: `'morning'` | `'evening'` | `'sleepin'`

### Sidebar Navigation
```
HANDOVER
  🏠 Handover      → view: handover
  🔴 Missing       → view: missing   (badge shows open count)
  📋 SP/RA Flags   → view: spra

ADMIN
  📅 Rota          → view: rota
  ⚙️ Config        → view: config
  📌 Notice Board  → view: noticeboard
```

---

## View: Handover (main)

### Sections
1. **Shift Info Bar** (`.sib`): shift label + time, assigned staff from rota, submit/edit button + action buttons (Missing, Task, Key Work, Note/Alert, **Unit Task**, **Unit Alert**)
2. **Alerts Banner** (`.alerts-banner`): active alerts + reminders (from `oShiftNotes`) + active unit notices (from `unitNotices`) + open missing cases — all with YP/unit colour tag
3. **Panels Grid** (2 columns):
   - Left: 📝 Notes + ✅ Tasks (shift tasks + notice board tasks in same panel, separated by "Notice Board" divider)
   - Right: 🤝 Key Work/ISS + 📍 Locations
4. **Shift Footer**: submit handover button or "Submitted ✓" + Edit button

### Shift Submission
Doc ID = `{unitId}_{shift}_{date}` in `oShiftSubmissions`. Once submitted, shift is read-only unless admin clicks Edit (which deletes the submission doc).

### Location Table
YP locations per shift stored in `oShiftLocations`. Dropdown from `LOCS` array (predefined location options). Missing YPs show "🔴 Missing" instead of dropdown.

---

## View: Missing
Full list of missing/UA cases for current unit. Cards pulse red when open. Each case has:
- Type: `missing` | `ua` (unauthorised absence)
- Status: `open` | `closed`
- Updates log (append-only array)
- Resolution when closed

---

## View: SP/RA Flags
Aggregated view of all notes that have `flagSP: true` or `flagRA: true` across the unit, for Support Plan and Risk Assessment action items.

---

## View: Rota
Admin sub-tabs: Grid view (visual) | Table view (editable) | Import CSV (wide format: one row per date, columns per shift).

---

## View: Config
Toggle which YPs appear per unit in the handover (checkbox per YP).

---

## View: Notice Board
Unit-level alerts, reminders, tasks (same as cs-handover Notice Board but unit-scoped).

---

## Firestore Collections

### `oShiftNotes`
Notes, alerts, and reminders for a shift.
```js
{
  unitId: string,
  ypId: string,          // service user doc ID
  shift: 'm' | 'e' | 's',
  date: string,          // YYYY-MM-DD
  type: 'note' | 'alert' | 'reminder',
  text: string,
  time: string,          // HH:MM
  done: boolean,
  updates: [{text, time, by}],
  createdBy: string,     // Firebase UID
  createdByName: string,
  createdAt: Timestamp,
  editedBy?: string,
  editedAt?: Timestamp,
  // note-specific:
  cat?: string,          // category (from unit config)
  flagSP?: boolean,
  flagRA?: boolean,
  // alert-specific:
  until?: string,        // YYYY-MM-DD keep active until
  // reminder-specific:
  rtype?: 'today' | 'date',
  rdate?: string,        // YYYY-MM-DD for specific date
  prior?: boolean,       // show day-before also
  priorNote?: string     // day-before note
}
```

### `oShiftTasks`
Tasks attached to a shift.
```js
{
  unitId: string,
  ypId: string,
  name: string,
  desc: string,
  due: string,           // YYYY-MM-DD
  done: boolean,
  cnote: string,         // completion note
  completedBy: string,   // UID
  completedByName: string,
  completedAt: Timestamp,
  createdBy: string,
  createdByName: string,
  createdAt: Timestamp,
  editedBy?: string,
  editedAt?: Timestamp
}
```

### `oShiftKeywork`
Key Work and ISS session records.
```js
{
  unitId: string,
  ypId: string,
  shift: 'm' | 'e' | 's',
  date: string,
  type: 'kw' | 'iss',
  text: string,
  time: string,
  createdBy: string,
  createdByName: string,
  createdAt: Timestamp,
  editedBy?: string,
  editedAt?: Timestamp
}
```

### `oShiftMissing`
Missing person / unauthorised absence cases.
```js
{
  unitId: string,
  ypId: string,
  mtype: 'missing' | 'ua',
  note: string,          // initial report details
  time: string,
  status: 'open' | 'closed',
  updates: [{text, time, by}],
  date: string,
  resolution?: string,   // resolution category
  closeNote?: string,
  closeTime?: string,
  closedBy?: string,     // UID
  closedByName?: string,
  createdBy: string,
  createdByName: string,
  createdAt: Timestamp
}
```

### `oShiftSubmissions`
Shift submission records. Doc ID = `{unitId}_{shift}_{date}`.
```js
{
  unitId: string,
  shift: 'm' | 'e' | 's',
  date: string,
  rotaStaffName: string, // from rota at time of submit
  submittedBy: string,   // UID
  submittedByName: string,
  submittedAt: Timestamp
}
```

### `oShiftLocations`
YP location records per shift. Doc ID = `{unitId}_{ypId}_{date}_{shift}`.
```js
{
  unitId: string,
  ypId: string,
  date: string,
  shift: 'm' | 'e' | 's',
  location: string,      // from LOCS dropdown
  locNotes: string,
  updatedBy: string,     // UID
  updatedAt: Timestamp
}
```

### `rota`
Rota assignments.
```js
{
  unitId: string,
  shift: 'm' | 'e' | 's',
  date: string,
  staffName: string,
  staffInitials?: string
}
```

---

## YP & Unit Colour System
```js
const YP_COLORS = ['#1446a0','#27ae60','#7b2d8b','#e67e22','#0e7490','#c0392b','#0d9488','#9333ea','#d97706','#059669'];
const UNIT_COLOR = '#64748b';  // slate — used for unit-scoped items
const ypColor = idx => YP_COLORS[idx % YP_COLORS.length];
function ypTagHtml(ypId)  // returns <span class="yp-tag"> with YP initials+color, or "Unit" in UNIT_COLOR if ypId is null
```
Every YP gets a stable color based on their index in `currentUnitYPs`. Unit-level items always use `UNIT_COLOR`.

---

## State Variables
```js
currentUnitId    // string
currentShift     // 'morning' | 'evening' | 'sleepin'
currentDate      // YYYY-MM-DD string
currentUser      // Firebase Auth user
currentStaff     // staffProfiles doc data

// Caches (loaded per unit+date+shift):
notesCache[]        // oShiftNotes for this unit+date
tasksCache[]        // oShiftTasks for this unit
kwCache[]           // oShiftKeywork for this unit+date+shift
missingCache[]      // oShiftMissing for this unit
locsCache           // { [ypId]: { location, locNotes } }
rotaCache[]         // all rota entries for this unit (recent range)
allUnitsCache[]     // all active units
currentUnitYPs[]    // serviceUsers for current unit
nbTasksCache[]      // adhocTasks for unit (incomplete, active) — shared with notice board
nbUnitNoticesCache[] // unitNotices for unit (done==false) — shared with notice board

// Edit state:
pendingEditNoteId
pendingEditTaskId
pendingEditKWId
pendingTaskId        // for complete-task modal
pendingMissingId     // for close-missing modal
pendingUpdCtx / pendingUpdId  // for update modal
priorOn              // boolean for day-before reminder toggle
kwTypeVal            // 'kw' | 'iss' current selection
```

## Modals
| ID | Purpose |
|---|---|
| `m-note` | Add/edit note, alert, or reminder |
| `m-task` | Add/edit task |
| `m-ctask` | Complete task (requires note) |
| `m-kw` | Add/edit key work or ISS |
| `m-missing` | Report missing / UA |
| `m-close-missing` | Close missing case with resolution |
| `m-update` | Add update to alert/reminder or missing case |

## Key Functions
| Function | Purpose |
|---|---|
| `loadShiftData()` | Loads all caches incl. `loadNoticeBoardData()` for current unit/date/shift |
| `renderHandover()` | Re-renders shift info bar, alerts banner, all panels |
| `renderAlertsBanner()` | Shows active alerts + reminders + open missing |
| `renderNotes()` | Renders notes panel from `notesCache` |
| `renderTasks()` | Renders tasks panel from `tasksCache` |
| `renderKW()` | Renders key work/ISS panel from `kwCache` |
| `renderLocTable()` | Renders YP location table from `locsCache` |
| `setLoc(ypId, val)` | Write location to Firestore + update `locsCache` |
| `setLocNote(ypId, val)` | Write location notes to Firestore |
| `submitShift()` | Create `oShiftSubmissions` doc |
| `editShift()` | Delete `oShiftSubmissions` doc to re-open |
| `saveNote()` | Add or update `oShiftNotes` doc |
| `saveTask()` | Add or update `oShiftTasks` doc |
| `completeTask()` | Mark task done with note |
| `uncompleteTask(id)` | Re-open completed task |
| `deleteTask(id)` / `deleteNote(id)` / `deleteKW(id)` | Hard delete |
| `saveKW()` | Add or update `oShiftKeywork` doc |
| `saveMissing()` | Create `oShiftMissing` doc |
| `closeMissing()` | Update missing case to `status: 'closed'` |
| `renderMissingView()` | Render full missing persons view |
| `saveUpdate()` | Append update to alert or missing case |
| `renderSPRA()` | Render SP/RA flagged notes view |
| `openNoteModal()` / `selNType(type)` | Open note modal, switch type tabs |
| `openKWModal()` / `selKWType(type)` | Open KW modal, switch type |
| `openMissingModal()` / `selMType(type)` | Open missing modal, switch type |
| `togPrior()` | Toggle day-before reminder option |
| `getYPInit(ypId)` | Get initials for a YP |
| `getYPColorIdx(ypId)` | Get color index for YP tag |
| `ypColor(idx)` | Returns one of ~8 preset colors for YP tags |
| `fmtD(dateStr)` | Format YYYY-MM-DD to readable date |
| `nowT()` | Returns current time as HH:MM |

## Helpers (shorthand used throughout)
```js
g(id)       // document.getElementById(id)
gv(id)      // document.getElementById(id).value
sv(id, v)   // document.getElementById(id).value = v
om(id)      // open modal (add class 'open')
cm(id)      // close modal (remove class 'open')
empt(icon, text)  // returns empty-state HTML
toast(msg, type)  // show toast ('ok' | 'err')
```
