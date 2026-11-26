# task-board-public-sample.html: Task Board revamp, public view (UX prototype)

## Purpose
First look at the **front-end for the revamped Task Board**: the public-facing, PIN-locked list that staff on shift use to work through tasks and mark them done. It is a **clickable prototype with fictional data**, built so the design can be agreed before any real data model or admin side is built.

It is **not linked from `index.html`**, uses **no Firebase and no login**, and **saves nothing**. Reloading resets every task (only the sign-in is remembered, in `localStorage`). Opens as a plain file: `task-board-public-sample.html`. The existing `task-board.html` is untouched.

## The two halves of the revamp
1. **Public view** (this prototype): PIN, then browse, tick steps, mark done.
2. **Admin side** (not built yet): where tasks are created and managed, where card types are configured, and where tasks marked done are **checked**: approved, or sent back with a note.

The prototype's footer has two buttons, **Manager approves one** and **Manager sends one back**, which stand in for the admin side so the whole loop can be seen. They are prototype-only.

## Access (prototype)
- PIN screen with keypad (also takes the keyboard: digits, Backspace, Esc to clear). **Sample PIN: `123456`.**
- After the PIN, asks once for **initials** (2-4 letters) to attribute ticks and completions. Saved in `localStorage` `tbSampleInitials`. Tap the initials chip in the header to change them. Use **JM** to see "Assigned to me" tasks.
- **Stays signed in for 8 hours** on the device (`localStorage` `tbSampleExp`, `SESSION_MS`), so staff are not re-entering a PIN all shift. **Lock** ends it at once. An expired session returns to the PIN screen (checked every 30 s).

## Screen layout
- **Header**: logo, "Task Board", Sample tag, initials chip (with "signed in until"), Lock.
- **Toolbar** (sticky only when the screen is at least 821 wide and 800 tall): the **Who** picker, its selected chips, **Assigned to me**, **Sort by**; second row: **status tabs** and **type chips**.
- **Cards**, grouped under headings.
- **Prototype bar** (fixed bottom on large screens, at the page end on phones).

## Cards
Bigger and bolder than the old board; every card shows:
- **Header filled with the young person's colour**: name large, unit under it. Each young person has their own colour (`YPS[].color`, chosen to keep white text readable). **Whole-house tasks** have no young person: they get a navy **striped** header with the unit name and "Whole-house task".
- **Type pill** in the header (icon + name).
- **Task title**, **priority** chip (High filled red, Medium amber, Low green), **deadline** chip (red "Overdue by N days", amber "Due today", otherwise the date; appointments show the time).
- **Notes**: three lines, then **Show more** for long notes.
- **Steps** (below), **assignee initials** (or "Anyone on shift"), and the action button.

### Card types
`TYPES`: **Task, Key work session, Appointment, Medication, Outing & activity, Review meeting**. Each has a name and an icon. These are the starting set; the admin side will let admins add, rename, re-icon and remove types (settings). The type chips under the toolbar filter by one type.

### Steps (strictly in order)
- Each step has `t` (text), optional `hint` (small grey line), and `by` / `at` (who ticked it and when).
- **Done**: green tick, struck through, "JM · today 14:05".
- **Current** (the first not-done step): card-coloured outline, number ring that pulses, **"Do this now"** tag. Tapping it ticks it, and the next step becomes the current one. A toast says what is next.
- **Locked**: grey with a padlock. Tapping it shakes and says "Finish step N first."
- The **latest** ticked step can be **tapped to undo** (earlier ones cannot, because later steps depend on them).
- Progress bar and "N of M done".
- **Mark done** is greyed ("3 steps to go") until every step is ticked, then turns green and pulses. Tasks with no steps can be marked done straight away.

### Status flow (public side)
`todo` → **Mark done** (dialog with optional note for the manager) → `review` ("Waiting for check") → manager approves → `done` ("Checked off"), **or** manager sends it back → `todo` again with a red **"Sent back by RK"** banner holding their note; the last step is re-opened.
- **To do** tab: the working list. Sorted into groups; sent-back cards carry the red banner.
- **Waiting for check** tab: amber banner "Marked done by JM · time", with the note they left. **Not finished? Undo** returns it to To do.
- **Checked off** tab: green banner "Checked and approved by RK". Read-only.

## Filtering and sorting
**Who picker** (the dropdown at the top-left): one panel listing every unit with its young people, tick boxes throughout, plus a name search.
- Tick a **unit** = everyone in it, including whole-house tasks.
- Tick **Whole-house tasks** under a unit = just that unit's own tasks.
- Tick **individual young people** (one, two, three, from any units). Units and individuals can be mixed (for example all of Oak House plus just Tyler).
- Ticking every row under a unit collapses it to the whole unit; un-ticking one row of a whole unit turns the rest into individual ticks. A half-ticked unit shows a dash.
- Selections show as removable chips next to the button; **Show all** clears. On a phone the panel is a bottom sheet.
- Nothing selected means everyone.

Other controls: **Assigned to me** toggle, **Type** chips, **Sort by** Deadline (groups: Overdue, Today, Tomorrow, This week, Later, No deadline), Priority (High / Medium / Low / None) or Young person (one group per person, whole-house first per unit). The status tab counts follow the filters. Waiting and Checked tabs sort newest first.

## Responsive
Grid is `auto-fill minmax(350px, 1fr)`: three columns on a wide screen, two on a landscape or portrait tablet, one on a phone (at 740 px and below). Tap targets are at least 44 px. The header drops to icons on a phone.

## Data model in the prototype (plain JS, not Firestore)
```js
UNITS = [{ id, name }]
YPS   = [{ id, name, unit, color }]                    // 8 fictional young people in 3 units
TYPES = [{ id, name, icon }]
task  = {
  id, type, unit,
  yp: id | null,                  // null = whole-house task
  title, notes,
  priority: 'high'|'medium'|'low'|null,
  due: 'YYYY-MM-DD'|null, time: 'HH:MM'|null,
  assignees: ['JM'],              // initials
  steps: [{ t, hint, by: initials|null, at: epoch ms|null }],
  status: 'todo' | 'review' | 'done',
  doneBy, doneAt, doneNote,       // set by the public Mark done
  checkedBy, checkedAt,           // set by the manager approving
  sentBack: { by, at, note } | null
}
```
Dates are generated **relative to today** (`addDays(n)`), so the sample always looks current.

## State variables
```js
tasks, me{initials}, tab('todo'|'review'|'done'), sel(Set of 'u:unit' | 'h:unit' | 'y:yp'),
typeSel, mine, sortBy('due'|'prio'|'yp'), pkSearch, pinBuf, expanded(Set of task ids), doneId
```

## Key functions
| Function | Purpose |
|---|---|
| `buildTasks()` | Builds the 22 fictional tasks |
| `pinKey` / `checkPin` / `startSession` / `lockNow` | PIN entry, 8-hour session, lock |
| `askWho` / `saveWho` | Initials dialog |
| `toggleSel(key)` / `matchesWho(task)` / `filtered()` | The unit / young person selection logic and filtering |
| `renderPickerList` / `renderChips` / `renderTabs` / `renderTypeBar` | Toolbar pieces |
| `cardHTML(task)` / `stepsHTML` / `bannerHTML` / `footHTML` | Card markup |
| `groupsFor(list)` | Sort and group for each tab and sort mode |
| `render()` / `refreshCard(id)` | Redraw everything / redraw one card (used for step ticks) |
| `onStep` / `onDone` / `confirmDone` / `undoDone` | Step ticks, mark done, undo |
| `simApprove` / `simSendBack` | Prototype-only stand-ins for the admin check |

## Planned for the real build (not built)
- **Admin page** (Firebase staff login, `role === 'admin'`): create and edit tasks, steps and card types; a **Check** queue to approve or send back marked-done tasks; PIN management; colour per young person.
- Likely new collections (names to be confirmed): tasks (with embedded `steps`), card types, PINs, and a check/audit trail. Young people and units would come from the existing `serviceUsers` and `units`.
- Per the repo conventions: attribution as `initials`, dates as `YYYY-MM-DD`, times as `HH:MM`, soft delete via `status`, `serverTimestamp()` for `createdAt` / `updatedAt`.
- Open question for the real build: whether the public view signs in anonymously and relies on PIN as an app-level lock (as `task-manager-pro.html` does), and what Firestore rules that needs.
