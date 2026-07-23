# cs-handover.html — CS Handover Tool

## Purpose
Daily care handover notes for Connected Stars residential care. Staff record activities, alerts, reminders, and tasks per service user per day. Admin users can manage routine task templates and the notice board.

## Access
- All staff (role: `staff` or `admin`)
- Firebase email/password auth → lookup `staffProfiles/{uid}`
- Observer mode: toggle to view-only (no edits); shown via `.observing` class on topbar button and orange banner

## Layout
**Topbar**: Logo (links to `index.html`/home), unit selector (admin), date picker, user badge, observer toggle, refresh button  
**Nav Tabs**: Handover · Notice Board · Tasks (admin only) · Config (admin only)

---

## Tab: Handover (main)

### Structure
- **Handover Controls bar**: unit selector + date picker + Print button
- **Service user selector**: shows YPs for selected unit; clicking opens their handover card
- **Handover card sections** (per service user per date):
  - 🔴 Alerts
  - 🔔 Reminders
  - 📋 Ad Hoc Tasks
  - ✅ Routine Tasks (shift-grouped: Morning / Afternoon / Evening / Night)
  - 📖 Activities Log
  - 📝 Notes

### Routine Task Types
| Type | Input | Stored value |
|---|---|---|
| `checkbox` | Tick | `{by, byName, time, note}` |
| `yesno` | Yes/No buttons | `{by, byName, time, value: 'yes'|'no', note}` |
| `paragraph` | Textarea + Submit | `{by, byName, time, note}` |
| `time` | Time input + textarea | `{by, byName, time, value: 'HH:MM', note}` |

### Print Modal (`printModal`)
Configurable sections: attribution, alerts, reminders, ad hoc, tasks, activities, notes.

---

## Tab: Notice Board
Unit-level notice board with:
- 🚨 Unit Alerts (active until date or persistent)
- 📌 Unit Reminders
- ✅ Unit Tasks (with priority, completion)

---

## Tab: Tasks (admin only)
Manage routine task templates. Add/edit/deactivate templates at global / unit / service-user level.

---

## Tab: Config (admin only)
Toggle which service users appear in the handover per unit. Checkbox tree: unit → service users.

---

## Firestore Collections

### `logEntries`
Activity log entries.
```js
{
  serviceUserId: string,
  unitId: string,
  date: string,         // YYYY-MM-DD
  type: 'activity' | 'note',
  text: string,
  addedBy: string,      // initials
  addedByName: string,
  createdAt: Timestamp,
  editedBy?: string,
  editedAt?: Timestamp
}
```

### `alerts`
Persistent alerts for a service user.
```js
{
  serviceUserId: string,
  unitId: string,
  text: string,
  addedBy: string,
  createdAt: Timestamp
}
```

### `reminders`
Date-based reminders. Two sub-types:
```js
// Standard reminder
{
  serviceUserId: string,
  unitId: string,
  type: undefined,       // (not 'carryforward')
  title: string,
  eventDate: string,     // YYYY-MM-DD
  showOnDay: boolean,
  showDayBefore: boolean,
  onDayNotes: string,
  dayBeforeNotes: string,
  addedBy: string,
  createdAt: Timestamp,
  editedBy?: string
}

// Carry-forward reminder (from past note)
{
  serviceUserId: string,
  unitId: string,
  type: 'carryforward',
  targetDate: string,    // date this should appear
  sourceDate: string,    // date it was carried from
  sourceNoteId: string,  // ref to logEntries doc
  text: string,          // snapshot at carry time
  extraNote: string,
  addedBy: string,
  createdAt: Timestamp,
  editedBy?: string
}
```

### `adhocTasks`
One-time or recurring tasks for a specific service user. Shared with task-board.html.
```js
{
  serviceUserId: string,
  unitId: string,
  title: string,
  priority: 'high' | 'medium' | 'low',
  recurrence: 'today' | 'once' | 'tomorrow' | 'range' | 'recurring',
  targetDate?: string,   // for once/today/tomorrow
  fromDate?: string,     // for range
  toDate?: string,       // for range
  recurDays?: number[],  // 0-6, for recurring
  recurFrom?: string,    // for recurring
  recurTo?: string,      // for recurring
  mustComplete: boolean,
  addedBy: string,       // initials
  addedByName: string,
  completed: boolean,
  completionNote?: string,
  completedBy?: string,
  completedByName?: string,
  completedAt?: Timestamp,
  carriedFrom?: string,  // date if carried forward
  createdAt: Timestamp,
  editedBy?: string
}
```
**Access rule**: non-admin staff can only set `recurrence: once/today/tomorrow`; `range` and `recurring` are admin-only.

### `taskTemplates`
Routine task definitions (repeat daily).
```js
{
  level: 'global' | 'unit' | 'serviceuser',
  unitId?: string,
  serviceUserId?: string,
  name: string,
  type: 'checkbox' | 'yesno' | 'paragraph' | 'time',
  shift: 'morning' | 'afternoon' | 'evening' | 'night',
  status: 'active' | 'inactive',
  expiryDate?: string,   // YYYY-MM-DD, task removed after this
  mustComplete?: boolean,
  order?: number,        // sort order within shift
  createdAt: Timestamp
}
```

### `dailyRecords`
Task completion records. Doc ID = `{serviceUserId}_{date}`.
```js
{
  serviceUserId: string,
  unitId: string,
  date: string,
  tasks: {
    [taskTemplateId]: {
      by: string,         // initials
      byName: string,
      time: string,       // HH:MM
      note: string,
      value?: string      // for yesno ('yes'|'no') or time ('HH:MM')
    }
  }
}
```

---

## State Variables
```js
currentHandover = { serviceUserId, unitId, date }
currentStaffProfile  // staffProfiles doc data
isObserverMode       // boolean
pendingAdhocId       // for complete-adhoc modal
pendingEditNoteId    // for edit alert
pendingCarryForwardId
```

## Modals
| ID | Purpose |
|---|---|
| `alertModal` | Add alert for service user |
| `reminderModal` | Add reminder (standard) |
| `adhocModal` | Add ad hoc task |
| `completeAdhocModal` | Mark ad hoc task complete with note |
| `carryForwardModal` | Carry a note forward to today |
| `printModal` | Configure and trigger print |
| `addTaskModal` | Add routine task template (admin) |
| `editTaskModal` | Edit routine task template (admin) |
| `nbAlertModal` | Add unit notice board alert |

## Key Functions
| Function | Purpose |
|---|---|
| `renderAlerts(suId, date)` | Load + render alerts section |
| `renderReminders(suId, date)` | Load + render reminders (filters by showOnDay/showDayBefore) |
| `renderAdhocTasks(suId, date)` | Load + render ad hoc tasks (filters by recurrence + date) |
| `renderRoutineTasks(suId, date)` | Load templates + completions, render by shift |
| `renderLogEntries(type, suId, date)` | Render activity/note log entries |
| `saveReminder()` | Save new reminder from modal |
| `saveAdhocTask()` | Save new ad hoc task from modal |
| `completeRoutineTask(taskId, type, el, value)` | Record completion in `dailyRecords` |
| `saveRoutineNote(taskId)` | Edit completion note on already-completed task |
| `startLogEdit(id)` / `saveLogEdit(id, type)` | Inline edit log entry |
| `deleteLogEntry(id, type)` | Delete log entry |
| `editAlertItem(id, text)` / `deleteAlertItem(id)` | CRUD alerts |
| `editCarryForwardNote(id, extra)` | Edit extra note on carried reminder |
| `confirmCarryForward()` | Create carryforward reminder doc |
| `saveTask()` | Save new task template (admin) |
| `saveEditTask()` | Update existing task template (admin) |
| `executePrint()` | Trigger print with modal options |
