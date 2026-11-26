# super-admin.html — Super Admin Panel

## Purpose
Admin-only management panel for all master data: care units and the young people (service users) in them, staff accounts, and reference data (regulatory bodies).

## Access
- **Admin role only** (`profile.role === 'admin'`)
- Non-admin users who authenticate see the "Access Denied" screen (`#accessDenied`)
- Firebase email/password auth → `staffProfiles/{uid}` role check

## Layout
**Sidebar** (fixed left, 240px): logo (links to `index.html`/home) + navigation + admin user badge + sign out  
**Topbar**: page title + subtitle (updates per view)  
**Content area** (`#content`): `.view` divs, one active at a time

### Sidebar Navigation
```
MANAGEMENT
  🏠 Units & Young People → view: board (count badge = young people currently in care)
  🧑‍💼 Staff Accounts      → view: staff (count badge)

SETTINGS
  🏷️ Regulatory Bodies    → view: regbodies (count badge)
```
On phones (≤700px) the sidebar is hidden; a ☰ button in the topbar opens it.

---

## View: Units & Young People (`v-board`)

One **board**: a horizontally scrolling row of columns, one column per unit, with each young person as a card in their unit's column. Replaces the old separate "Units" and "Service Users" tables (no single long list).

### Board layout
- **Toolbar**: search (name or local authority) · *Show archived units* · *Show moved on (n)* · summary ("4 units · 14 young people") · ‹ › scroll arrows
- **Quick-jump chips** (one per column, with count): click to scroll to that unit; chips for the columns currently in view are highlighted. On phones the chips are a single swipeable row.
- **Columns** (left → right):
  1. **No unit assigned** — only appears if an active young person's `currentUnitId` doesn't match any unit (data safety net). Not a drop target.
  2. **Active units**, alphabetical (then archived units if shown — or if they somehow still contain people). Archived columns are not drop targets.
  3. **Moved on** — only when *Show moved on* is ticked. Cards are not draggable.
  4. **＋ Add a unit** tile.
- Each unit column has its own vertical scroll, a coloured top border (colour = order the unit was created, from `UNIT_COLOURS`), a count pill, a **⋯ unit menu** and an **＋ Add young person** button pinned under the list.
- While searching, counts read "x of y" and chips show matches.

### Young person card
Avatar initials · name · age + DOB · Regulatory Body badge · Local Authority · **Move** button · **⋯ menu**.
Clicking the card opens the edit modal. Cards are keyboard-focusable (Enter = edit).
- Active menu: Edit details · Move to another unit · Mark as moved on · Delete
- Moved-on card: shows move-on date + last unit; button **Reactivate**; menu: Edit details · Reactivate · Delete

### Moving a young person
- **Drag** a card onto another unit's column (board auto-scrolls sideways when you drag near its edges), **or** click **Move**. Both open the *Move modal* (`transferModal`) — dropping pre-selects the unit you dropped on. Nothing is saved until you confirm. (HTML5 drag-and-drop is unreliable on touch screens, so **Move** is the touch path.)
- Move modal: tiles for every other active unit (with current head-count) + move date (default today). Confirm closes the open `unitHistory` entry (`toDate = moveDate`) and appends `{unitId, fromDate: moveDate, toDate: null}`, sets `currentUnitId`.

### Unit rules
- **Add unit**: name required, case-insensitive duplicate names rejected; board scrolls to the new column.
- **Rename / Archive / Restore / Delete** from the unit's ⋯ menu.
- **Archive is blocked** while the unit still has active young people ("move them out first").
- **Delete is only offered** when the unit has no active young people (moved-on people last in it will show "Unknown" for unit).

### Add / edit young person (`suModal`)
Fields: Full Name*, DOB, Unit*, Local Authority, Regulatory Body (from `regulatoryBodies`).
- Opening from a column's **＋ Add young person** (or the unit ⋯ menu) pre-selects that unit and names it in the title; opening from the page header requires choosing a unit.
- **Save & add another** (add mode only) saves, keeps the dialog open with the same unit, clears the rest.
- New people get `unitHistory: [{unitId, fromDate: today, toDate: null}]`; the new card is scrolled to and flashed.
- Edit mode shows read-only **Unit History**. The Unit dropdown there is a *correction only* (changes `currentUnitId`, no history entry) — use **Move** to record a real move.
- If there are no units, "Add Young Person" opens the Add Unit dialog instead.
- Enter saves; Esc closes the top-most dialog/menu.

### Move on / Reactivate
- **Mark as moved on** (`moveOnModal`): sets `status: 'moved-on'` + `moveOnDate`; keeps all history.
- **Reactivate**: confirm dialog; `status: 'active'`, `moveOnDate: null` (they return to their last unit; if it no longer exists they show under *No unit assigned*).

---

## View: Staff Accounts

Manage staff Firebase auth accounts and profiles.

| Column | Notes |
|---|---|
| Name | |
| Initials | 2-3 chars used throughout for attribution |
| Role | Admin / Staff badge |
| Status | Active / Archived badge |
| Email | |
| Actions | Edit · Archive/Unarchive · Delete |

---

## View: Regulatory Bodies

Reference list used as dropdown options in young people's profiles. Simple label-only records.

| Column | Notes |
|---|---|
| Label | e.g. "Ofsted", "CQC" |
| In Use | Count of young people with this value |
| Actions | Edit · Delete |

**Delete warning**: if in use, value remains on existing profiles but disappears from dropdown.

---

## Firestore Collections

### `units`
```js
{ name: string, status: 'active' | 'archived', createdAt: Timestamp }
```

### `serviceUsers`
```js
{
  name: string,
  dob: string,             // YYYY-MM-DD
  currentUnitId: string,
  localAuthority: string,
  regulatoryBody: string,  // matches regulatoryBodies label
  status: 'active' | 'moved-on',
  moveOnDate: string | null,
  unitHistory: [{ unitId: string, fromDate: string, toDate: string | null }],
  createdAt: Timestamp
}
```

### `staffProfiles`
```js
{
  name: string,
  initials: string,  // 2-3 chars
  role: 'admin' | 'staff',
  email: string,
  status: 'active' | 'archived',
  createdAt: Timestamp
}
```
Note: Doc ID = Firebase Auth UID.

### `regulatoryBodies`
```js
{ label: string, createdAt: Timestamp }
```

---

## State Variables
```js
units[]          // all units (loaded once, re-loaded after unit mutations)
serviceUsers[]   // all young people (re-loaded after every change)
staffList[]      // all staff profiles
regBodies[]      // all regulatory bodies
dataLoaded       // false until units + serviceUsers first arrive (board shows "Loading…")

// Modal edit state (null = creating new):
editingUnitId
editingSUId
editingStaffId
editingRBId

// Move / move-on:
transferSUId          // who is being moved
transferTargetId      // unit chosen in the Move modal (pre-set by drag-drop)
moveOnSUId

// Board:
unitColourMap{}       // unitId -> [accent, tint]; rebuilt in loadUnits() (order of createdAt)
dragSUId, dropHoverCol // drag-and-drop tracking

confirmAction    // async fn stored for confirm dialog callback
```

## Modals
| ID | Purpose |
|---|---|
| `unitModal` | Add / rename unit |
| `suModal` | Add / edit young person (has Save & add another) |
| `transferModal` | Move a young person to another unit (unit tiles + date) |
| `moveOnModal` | Mark young person as moved on |
| `staffModal` | Add/edit staff account |
| `rbModal` | Add/edit regulatory body |
| `confirmModal` | Generic confirm dialog (destructive actions) |

Plus a lightweight pop-up menu (`#popMenu`, built by `showMenu()`) used by the ⋯ buttons.

## Key Functions
| Function | Purpose |
|---|---|
| `loadAll()` | Load everything, then set `dataLoaded` and render |
| `loadUnits()` / `loadServiceUsers()` / `loadStaff()` / `loadRegBodies()` | Fetch a collection into its state array and re-render |
| `updateCounts()` | Update sidebar badge counts |
| `renderBoard()` | Re-render chips, summary and all columns/cards (applies search + toggles; preserves scroll positions) |
| `ypCardHTML(s, moved)` | HTML for one young person card |
| `updateActiveChip()` | Highlight chips for columns in view (called on board scroll) |
| `scrollToCol(key)` / `scrollBoard(dir)` / `flashCard(id)` | Navigation helpers |
| `showMenu(btn, items)` / `closeMenu()` | ⋯ pop-up menus (`openUnitMenu`, `openYPMenu` build the items) |
| `openUnitModal(id?)` / `saveUnit()` | Add / rename unit |
| `toggleUnitArchive(id)` / `deleteUnit(id)` | Archive (blocked if occupied) / delete (only if empty) |
| `openSUModal(id?, presetUnitId?)` / `saveSU(addAnother?)` | Add / edit young person |
| `deleteSU(id)` | Delete (confirm dialog) |
| `openTransferModal(id, targetUnitId?)` / `refreshTransferPicker()` / `confirmTransfer()` | Move between units, writes `unitHistory` |
| `openMoveOnModal(id)` / `confirmMoveOn()` / `reactivateSU(id)` | Move on / reactivate |
| `renderStaff()` / `openStaffModal()` / `saveStaff()` / `deleteStaff()` | Staff accounts |
| `renderRBs()` / `openRBModal()` / `saveRB()` / `deleteRB()` | Regulatory bodies |
| `showView(view)` | Switch between `board`, `staff`, `regbodies` |
| `showConfirm(title, msg, warn, icon)` | Show confirm dialog, stores callback in `confirmAction` |
| `toast(msg, type)` | Show toast notification |
| `fmtDate(ts)` / `fmtYMD(str)` / `ageOf(dob)` / `esc(str)` | Formatting + HTML-escape helpers |

Board events use **event delegation** on `#board` (`data-act` / `data-id` / `data-unit` attributes) because the board's HTML is re-created on every render.
