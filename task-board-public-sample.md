# task-board-public-sample.html: Task Board revamp, public view (UX prototype)

## Purpose
First look at the **front-end for the revamped Task Board**: the public-facing, PIN-locked list that staff on shift use to work through tasks and mark them done. It is a **clickable prototype with fictional data**, built so the design can be agreed before any real data model or admin side is built.

It is **not linked from `index.html`**, uses **no Firebase and no login**, and **saves nothing**. Reloading resets every task (only the sign-in is remembered, in `localStorage`). Opens as a plain file: `task-board-public-sample.html`. The existing `task-board.html` is untouched.

## The two halves of the revamp
1. **Public view** (this prototype): PIN, then browse, tick steps, attach links and files, mark done.
2. **Admin side** (not built yet): where tasks are created and managed, where card types are configured, and where tasks marked done are **checked**: approved, or sent back with a note.

**The check is admin-only.** The public page has no "waiting for check" or "checked off" views and no approve / send-back controls. When staff mark a task done it leaves their list and goes to the admin side. The only trace on the public page is:
- a toast with **Undo** for 9 seconds after marking done (a mis-tap safety net), and
- a red **"Sent back by RK"** banner with the manager's note if the admin sends a task back, so staff know what to fix. One sample card (Tyler's risk assessment) shows this.

## Access (prototype)
- PIN screen with keypad (also takes the keyboard: digits, Backspace, Esc to clear). **Sample PIN: `123456`.**
- After the PIN, asks once for **initials** (2-4 letters) to attribute ticks, attachments and completions. Saved in `localStorage` `tbSampleInitials`. Tap the initials chip in the header to change them. Use **JM** to see "Assigned to me" tasks.
- **Stays signed in for 8 hours** on the device (`localStorage` `tbSampleExp`, `SESSION_MS`), so staff are not re-entering a PIN all shift. **Lock** ends it at once. An expired session returns to the PIN screen (checked every 30 s).

## Screen layout
- **Header**: logo, "Task Board", Sample tag, initials chip (with "signed in until"), Lock.
- **Toolbar** (sticky from 821 px wide; scrolls away on phones): the **Who** picker, then three dropdown / toggle controls: **Type** (select), **Sort** (select), **Assigned to me**. Selected units and young people show as chips on a second line.
- **Cards**, grouped under headings.
- **Prototype bar** (fixed at the bottom on wide screens, at the page end on phones): only a **Reset sample data** button.

## Cards
Bigger and bolder than the old board; every card shows:
- **Header filled with the young person's colour**: name large, unit under it. Each young person has their own colour (`YPS[].color`, chosen to keep white text readable). **Unit tasks** (no young person) get a navy **striped** header with the unit name and "Unit task".
- **Type pill** in the header (icon + name).
- **Task title**, **priority** chip (High filled red, Medium amber, Low green), **deadline** chip (red "Overdue by N days", amber "Due today", otherwise the date; appointments show the time).
- **Notes**: three lines, then **Show more** for long notes.
- **Links & files**, **Steps**, assignee initials (or "Anyone on shift") and the **Mark done** button.

### Card types
`TYPES`: **Task, Key work session, Appointment, Medication, Outing & activity, Review meeting**. Each has a name and an icon. These are the starting set; the admin side will let admins add, rename, re-icon and remove types (settings). On the public page they are chosen from the **Type dropdown** (one native `<select>`, which becomes the phone's own picker), with a count of matching tasks beside each option.

### Links and files
Each task has a **Links & files** list, shown above the steps.
- Each row shows an icon, the name, and a line such as `PDF · 212 KB · added by RK` or `example.com · added by RK`. Tapping opens it in a new tab (`target="_blank" rel="noopener noreferrer"`).
- Items added by an **admin** when the task was created (`admin: true`) are read-only for staff.
- Staff can add their own with **Add a link or file** (the dashed button on every card). A dialog (a bottom sheet on phones) has two tabs:
  - **Link**: web address plus an optional name. `www.example.com` is accepted and becomes `https://`. Only `http` and `https` addresses with a dot in the host are allowed (rejects `javascript:` and junk). Without a name, the host name is used.
  - **File or photo**: pick a file, take a photo (phones offer the camera), or drag and drop on a computer. PDF, Word, Excel, text and images, **up to 10 MB** (`MAX_FILE`); too-big and empty files are refused with a message. Shows name, type and size before adding, with **Change**.
- Items staff added (`admin: false`) have an **X** to remove them.
- In the prototype a chosen file is held in the browser only (`URL.createObjectURL`); nothing is uploaded. The sample "uploaded" files open a placeholder page.

### Steps (strictly in order)
- Each step has `t` (text), optional `hint` (small grey line), and `by` / `at` (who ticked it and when).
- **Done**: green tick, struck through, "JM · today 14:05".
- **Current** (the first not-done step): card-coloured outline, number ring that pulses, **"Do this now"** tag. Tapping it ticks it, and the next step becomes the current one. A toast says what is next.
- **Locked**: grey with a padlock. Tapping it shakes and says "Finish step N first."
- The **latest** ticked step can be **tapped to undo** (earlier ones cannot, because later steps depend on them).
- Progress bar and "N of M done".
- **Mark done** is greyed ("3 steps to go") until every step is ticked, then turns green and pulses. Tasks with no steps can be marked done straight away.
- **Mark done** opens a dialog (optional note for the manager), then the card leaves the list and a toast offers **Undo**.

## Filtering and sorting
**Who picker** (the dropdown at the top-left): one panel listing every unit with its young people, tick boxes throughout, plus a name search.
- Tick a **unit** = everyone in it, including its unit tasks.
- Tick **Unit tasks** under a unit = just that unit's own tasks (the ones with no young person).
- Tick **individual young people** (one, two, three, from any units). Units and individuals can be mixed (for example all of Oak House plus just Tyler).
- Ticking every row under a unit collapses it to the whole unit; un-ticking one row of a whole unit turns the rest into individual ticks. A half-ticked unit shows a dash.
- Selections show as removable chips (`Oak House · whole unit`, `Oak House · unit tasks`, `Tyler · Willow Lodge`); **Show all** clears. On a phone the panel is a bottom sheet.
- Nothing selected means everyone.

Other controls: **Type** dropdown, **Assigned to me** toggle, and **Sort** dropdown: Deadline (groups: Overdue, Today, Tomorrow, This week, Later, No deadline), Priority (High / Medium / Low / None) or Young person (one group per person, unit tasks first per unit). The counts in the Type dropdown follow the Who and Assigned filters.

## Responsive
Grid is `auto-fill minmax(350px, 1fr)`: three columns on a wide screen, two on a tablet (portrait or landscape), one at 740 px and below. Tap targets are at least 44 px; inputs are 16 px so phones do not zoom. On phones (600 px and below) dialogs slide up as **bottom sheets**, the toast spans the width, the toolbar is three compact rows (Who; Type + Sort; Assigned to me), and the header drops to icons.

## Data model in the prototype (plain JS, not Firestore)
```js
UNITS = [{ id, name }]
YPS   = [{ id, name, unit, color }]                    // 8 fictional young people in 3 units
TYPES = [{ id, name, icon }]
task  = {
  id, type, unit,
  yp: id | null,                  // null = unit task
  title, notes,
  priority: 'high'|'medium'|'low'|null,
  due: 'YYYY-MM-DD'|null, time: 'HH:MM'|null,
  assignees: ['JM'],              // initials
  steps: [{ t, hint, by: initials|null, at: epoch ms|null }],
  attachments: [{ id, kind: 'link'|'file', name, url, size?, mime?, by, at, admin }],
  status: 'todo' | 'review',      // 'review' = marked done, now with the admin; hidden from the public list
  doneBy, doneAt, doneNote,       // set by Mark done
  sentBack: { by, at, note } | null   // set by the admin sending it back
}
```
Dates are generated **relative to today** (`addDays(n)`), so the sample always looks current. The prototype hides `status: 'review'` tasks; the real build moves them to the admin check queue.

## State variables
```js
tasks, me{initials}, sel(Set of 'u:unit' | 'ut:unit' | 'y:yp'),
typeSel, mine, sortBy('due'|'prio'|'yp'), pkSearch, pinBuf, expanded(Set of task ids),
doneId, attId, attMode('link'|'file'), attFile
```

## Key functions
| Function | Purpose |
|---|---|
| `buildTasks()` | Builds the 17 fictional tasks (some with admin-added links and files) |
| `pinKey` / `checkPin` / `startSession` / `lockNow` | PIN entry, 8-hour session, lock |
| `askWho` / `saveWho` | Initials dialog |
| `toggleSel(key)` / `matchesWho(task)` / `inScope` / `filtered()` | The unit / young person selection logic and filtering |
| `renderPickerList` / `renderChips` / `renderTypeSel` | Toolbar pieces |
| `cardHTML(task)` / `attsHTML` / `stepsHTML` / `bannerHTML` / `footHTML` | Card markup |
| `groupsFor(list)` | Sort and group for each sort mode |
| `render()` / `refreshCard(id)` | Redraw everything / redraw one card (used for step ticks and attachments) |
| `onStep` / `onDone` / `confirmDone` / `undoDone` | Step ticks, mark done, undo |
| `openAttach` / `setAttMode` / `pickFile` / `saveAttach` / `removeAttach` | Add and remove links and files |
| `normUrl` / `safeUrl` | Address clean-up and the http(s)-only rule |
| `toast(msg, kind, action?)` | Message, optionally with one button (Undo) |

## Planned for the real build (not built)
- **Admin page** (Firebase staff login, `role === 'admin'`): create and edit tasks, steps, attachments and card types; a **Check** queue to approve or send back marked-done tasks; PIN management; colour per young person.
- **Attachments**: links stored as `{ type: 'link', url, name }`; files uploaded to Firebase Storage (as `task-manager-pro-admin.html` does) and shown as plain open links, so no Storage CORS setup is needed. Open question: whether staff on the public page can really add them, or only admins (the sample lets both).
- Likely new collections (names to be confirmed): tasks (with embedded `steps` and `attachments`), card types, PINs, and a check/audit trail. Young people and units would come from the existing `serviceUsers` and `units`.
- Per the repo conventions: attribution as `initials`, dates as `YYYY-MM-DD`, times as `HH:MM`, soft delete via `status`, `serverTimestamp()` for `createdAt` / `updatedAt`.
- Open question for the real build: whether the public view signs in anonymously and relies on PIN as an app-level lock (as `task-manager-pro.html` does), and what Firestore rules that needs.
