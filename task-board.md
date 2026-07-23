# task-board.html — Task Board

## Purpose
Kanban-style task management linked to the handover system. Supports two board types:
1. **Custom boards** — fully configurable columns/cards, with per-board access control
2. **Handover-linked boards** — unit-level or YP-level boards backed by `adhocTasks` (same collection used by cs-handover)

## Access
- All staff (Firebase auth + `staffProfiles` lookup)
- Board-level access control: `open` (all staff), `include` (allowlist), or `exclude` (blocklist)

## Layout
**Sidebar** (fixed left, 260px): logo (links to `index.html`/home) + boards list grouped by type + user footer  
**Topbar**: title, notification bell (badge), refresh, mobile menu toggle  
**Board content**: filter bar + lists container

### Sidebar Structure
```
HANDOVER TASKS
  [per active unit]
    📋 [Unit Name] Unit Tasks
    👤 [YP Name]             (one per active service user)

TASK BOARDS
  [custom boards the user has access to]
  + New Board (button)
```

---

## Board Types

### Custom Boards (`taskBoards`)
User-created boards with columns (lists) and cards. Configurable:
- Name, color (from palette)
- Access mode: `open` | `include` | `exclude`
- For `include`: only users in `accessList[]` (UIDs) can see/edit
- For `exclude`: all users except those in `excludeList[]` (UIDs)

Board → Lists (columns) → Cards (tasks)

### Handover-Linked Boards (unit/YP scope)
Not stored as `taskBoards` docs. They render from `adhocTasks` filtered by `unitId` or `serviceUserId`.
- Unit board: tasks with `scope: 'unit'` + matching `unitId`
- YP board: tasks with matching `serviceUserId`
- These tasks also appear in cs-handover's Ad Hoc Tasks section

---

## Filter Bar
Per board: filter by assignee, priority, YP, search text, show/hide completed.

---

## Task Cards
Visual indicators:
- Left border color: red (high), amber (medium), green (low) priority
- Tags: priority badge, YP name, unit, assignees (initials avatars), due date (red if overdue)
- Completed cards: strikethrough + reduced opacity

---

## Task Detail Modal
Opens when clicking a card. Shows full title, description, metadata, and two sub-sections:
- **Activity log**: auto-generated events (created, assigned, completed, etc.)
- **Comments**: threaded comments, add/delete

---

## People Picker
Custom multi-select component used for assignees and board access lists.

```js
// State stored in:
pickerState = { [pickerId]: [{ uid, name, initials, role }] }

// Key functions:
pickerInit(pickerId)
pickerSearch(pickerId, inputId, dropdownId)   // filter staff by name/initials
pickerSelect(pickerId, uid, inputId, dropdownId)
pickerRemove(pickerId, index)
pickerGetInitials(pickerId)  // → string[]  (initials array for storage)
pickerGetUids(pickerId)      // → string[]  (UIDs array for access lists)
pickerSetByInitials(pickerId, initialsArr)  // pre-fill from stored initials
pickerSetByUids(pickerId, uidArr)           // pre-fill from stored UIDs
pickerClear(pickerId)
```

Instances:
- `taskAssigneePicker` — new task modal
- `editAssigneePicker` — edit task modal
- `accessIncludePicker` — board access include list
- `accessExcludePicker` — board access exclude list

---

## Firestore Collections

### `taskBoards`
Custom board definitions.
```js
{
  name: string,
  color: string,         // hex color
  accessMode: 'open' | 'include' | 'exclude',
  accessList: string[],  // UIDs (for include mode)
  excludeList: string[], // UIDs (for exclude mode)
  status: 'active' | 'inactive',
  createdBy: string,     // initials
  createdByName: string,
  createdAt: Timestamp
}
```

### `taskLists`
Columns within a custom board.
```js
{
  boardId: string,
  name: string,
  color: string,   // hex
  order: number,
  status: 'active' | 'inactive',
  createdAt: Timestamp
}
```

### `taskBoardCards`
Cards in custom board lists.
```js
{
  listId: string,
  boardId: string,
  title: string,
  description: string,
  priority: 'high' | 'medium' | 'low',
  assignees: string[],    // initials array
  dueDate: string,        // YYYY-MM-DD
  serviceUserId: string | null,
  unitId: string | null,
  addedBy: string,        // initials
  addedByName: string,
  completed: boolean,
  completionNote: string | null,
  completedBy: string | null,     // initials
  completedByName: string | null,
  completedAt: Timestamp | null,
  status: 'active' | 'inactive',  // soft-delete
  createdAt: Timestamp,
  editedBy?: string,
  editedAt?: Timestamp
}
```

### `adhocTasks`
Shared with cs-handover. Used for both handover-linked board tasks and direct adhoc tasks.
```js
{
  // Handover-linked (unit scope):
  unitId: string,
  scope: 'unit',
  // OR handover-linked (YP scope):
  serviceUserId: string,
  unitId: string,
  // Common fields:
  title: string,
  description: string,
  priority: 'high' | 'medium' | 'low',
  assignees: string[],   // initials
  recurrence: 'once' | 'today' | 'tomorrow' | 'range' | 'recurring',
  targetDate?: string,
  fromDate?: string, toDate?: string,
  recurDays?: number[], recurFrom?: string, recurTo?: string,
  dueDate?: string,
  mustComplete?: boolean,
  addedBy: string,       // initials
  addedByName: string,
  completed: boolean,
  completionNote?: string,
  completedBy?: string,
  completedByName?: string,
  completedAt?: Timestamp,
  status: 'active' | 'inactive',
  createdAt: Timestamp,
  editedBy?: string,
  editedAt?: Timestamp
}
```

### `taskComments`
Comments on tasks (both `taskBoardCards` and `adhocTasks`).
```js
{
  taskId: string,        // card or adhoc task doc ID
  text: string,
  addedBy: string,       // initials
  addedByName: string,
  createdAt: Timestamp
}
```

### `notifications` (in-app)
```js
{
  recipientInitials: string[],  // initials to notify
  title: string,
  body: string,
  read: boolean,
  createdAt: Timestamp
}
```

---

## State Variables
```js
currentBoard        // taskBoards doc data + id (currently open board)
currentStaffProfile // staffProfiles doc data
staffCache[]        // all staffProfiles (for people picker)
serviceUsersCache[] // all active service users
unitsCache[]        // all active units

// Board/list building:
customBoards[]      // taskBoards docs
selectedBoardColor  // hex string
selectedListColor   // hex string

// Task creation context:
addTaskContext = { listId, listType, unitId, serviceUserId }
// listType: 'card' (custom) | 'unit' | 'yp'

// Pickers:
pickerState = {}   // keyed by pickerId

// Modals:
editingBoardId
```

## Modals
| ID | Purpose |
|---|---|
| `addBoardModal` | Create new custom board (name, color) |
| `boardAdminModal` | Edit board settings + access control (2 tabs) |
| `addListModal` | Add new list/column to board |
| `addTaskModal` | Add new task (adapts UI for custom vs handover-linked) |
| `editTaskModal` | Edit existing task |
| `taskDetailModal` | View full task details + comments |
| `completeTaskModal` | Mark task complete with note |
| `confirmDeleteModal` | Generic delete confirmation |

## Key Functions
| Function | Purpose |
|---|---|
| `loadCustomBoards()` | Fetch all accessible `taskBoards` docs |
| `renderSidebar()` | Rebuild sidebar boards list |
| `loadCustomBoard(boardId)` | Fetch lists + cards for a board, render |
| `loadHandoverBoard(type, id)` | Fetch adhocTasks for unit or YP board |
| `renderBoard(lists, tasks)` | Render list columns + task cards |
| `applyFilters()` | Re-render with filter bar values applied |
| `clearFilters()` | Reset filter bar |
| `openAddTask(listId, listType, unitId?, suId?)` | Open add task modal with context |
| `saveTask()` | Save new task (routes to `adhocTasks` or `taskBoardCards`) |
| `openEditTask(taskId, taskType)` | Fetch task, open edit modal |
| `saveEditTask()` | Update task in correct collection |
| `openTaskDetail(taskId, taskType)` | Open detail modal with comments |
| `openCompleteTask(taskId, taskType)` | Open complete modal |
| `confirmCompleteTask()` | Mark complete, save completion note |
| `reopenTask(taskId, taskType)` | Clear completion data |
| `executeDelete()` | Soft-delete task, list, or board |
| `addComment(taskId, taskType)` | Add comment + notify assignees |
| `deleteComment(commentId, taskId, taskType)` | Delete comment |
| `saveList()` | Create new list in a board |
| `deleteList(listId)` | Soft-delete list |
| `saveBoard()` | Create new custom board |
| `saveBoardAdmin()` | Update board name/color/access settings |
| `setAccessMode(mode)` | Toggle include/exclude/open in board admin |
| `sendNotification(initialsArr, title, body)` | Write notification doc |
| `renderNotifPanel()` | Render notification panel items |
| `toggleCompleted()` | Show/hide completed cards in list |
| `switchBoardTab(tab)` | Switch between settings/access tabs in board admin |
| `esc(str)` | HTML-escape string |
| `showToast(msg, type)` | Show toast |
