# super-admin.html — Super Admin Panel

## Purpose
Admin-only management panel for all master data: care units, service users, staff accounts, and reference data (regulatory bodies).

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
  🏠 Units           → view: units      (count badge)
  👥 Service Users   → view: serviceusers (count badge)
  🧑‍💼 Staff Accounts → view: staff       (count badge)

SETTINGS
  🏷️ Regulatory Bodies → view: regbodies  (count badge)
```

---

## View: Units

Manage care units. Table with search + status filter.

| Column | Notes |
|---|---|
| Unit Name | |
| Status | Active / Archived badge |
| Active Users | Count of non-moved-on service users in this unit |
| Created | Formatted Firestore timestamp |
| Actions | Edit · Archive/Unarchive · Delete (only if 0 active users) |

**Rules**: Cannot delete a unit that has active service users.

### Unit Modal
Fields: Unit Name (text)  
Save creates doc in `units` with `status: 'active'`.

---

## View: Service Users

Manage residents/young people. Table with search + unit filter + status filter.

| Column | Notes |
|---|---|
| Name | |
| Unit | Badge showing current unit name |
| DOB | YYYY-MM-DD, monospace |
| Local Authority | |
| Regulatory Body | Badge (purple) |
| Status | Active / Moved On badge |
| Actions | Edit · Transfer · Move On / Reactivate · Delete |

### Service User Modal
Fields: Name, Date of Birth, Local Authority, Regulatory Body (dropdown from `regulatoryBodies`), Unit (dropdown)

When editing, shows **Unit History** panel (read-only list of past units with date ranges).

**Direct unit change in edit modal** (no history entry): for corrections only.

### Transfer Modal
Moves user to a different unit. Records history entry: closes current `unitHistory` entry (sets `toDate`), adds new entry with `fromDate = transferDate`.

### Move On Modal
Sets `status: 'moved-on'` and `moveOnDate`. Keeps all historical data intact.

### Reactivate
Resets `status` back to `'active'`, clears `moveOnDate`.

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

Reference list used as dropdown options in Service User profiles. Simple label-only records.

| Column | Notes |
|---|---|
| Label | e.g. "Ofsted", "CQC" |
| In Use | Count of service users with this value |
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
units[]          // all units (loaded once, re-loaded after mutations)
serviceUsers[]   // all service users
staffList[]      // all staff profiles
regBodies[]      // all regulatory bodies

// Modal edit state (null = creating new):
editingUnitId
editingSUId
editingStaffId
editingRBId

// Transfer / move-on:
transferSUId
moveOnSUId

confirmAction    // async fn stored for confirm dialog callback
```

## Modals
| ID | Purpose |
|---|---|
| `unitModal` | Add/edit unit |
| `suModal` | Add/edit service user |
| `transferModal` | Transfer service user to new unit |
| `moveOnModal` | Mark service user as moved on |
| `staffModal` | Add/edit staff account |
| `rbModal` | Add/edit regulatory body |
| `confirmModal` | Generic confirm dialog (destructive actions) |

## Key Functions
| Function | Purpose |
|---|---|
| `loadUnits()` | Fetch all units from Firestore into `units[]` |
| `loadServiceUsers()` | Fetch all service users into `serviceUsers[]` |
| `loadStaff()` | Fetch all staff profiles into `staffList[]` |
| `loadRegBodies()` | Fetch regulatory bodies into `regBodies[]` |
| `updateCounts()` | Update sidebar badge counts for all views |
| `renderUnits()` | Re-render units table (with search/filter applied) |
| `renderSUs()` | Re-render service users table |
| `renderStaff()` | Re-render staff table |
| `renderRBs()` | Re-render regulatory bodies table |
| `openUnitModal(id?)` | Open unit add/edit modal |
| `saveUnit()` | Create or update unit in Firestore |
| `toggleUnitArchive(id)` | Toggle unit status active↔archived |
| `deleteUnit(id)` | Delete unit (with confirm dialog) |
| `openSUModal(id?)` | Open service user add/edit modal |
| `saveSU()` | Create or update service user |
| `deleteSU(id)` | Delete service user (with confirm dialog) |
| `openTransferModal(id)` | Open transfer modal for a service user |
| `confirmTransfer()` | Execute unit transfer, update `unitHistory` |
| `openMoveOnModal(id)` | Open move-on confirmation modal |
| `reactivateSU(id)` | Reset status to active |
| `openRBModal(id?)` | Open regulatory body add/edit modal |
| `saveRB()` | Create or update regulatory body |
| `deleteRB(id)` | Delete regulatory body (with in-use warning) |
| `showConfirm(title, msg, warn, icon)` | Show confirm dialog, stores callback in `confirmAction` |
| `populateUnitFilters()` | Refresh unit dropdown in service users filter bar |
| `toast(msg, type)` | Show toast notification |
| `fmtDate(ts)` | Format Firestore Timestamp to readable date |
| `esc(str)` | HTML-escape string for safe insertion |
