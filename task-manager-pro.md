# task-manager-pro.html / task-manager-pro-admin.html — Task Manager Pro

## Purpose
A task manager for unit- and young-person-level care tasks, separate from Task Board/`adhocTasks`. Structured like the Hounslow kiosk: a PIN-locked front-end viewer for browsing/completing/commenting on tasks, plus a Firebase-login admin backend for creating tasks and managing tags/PINs.

## Access
- **`task-manager-pro.html`**: no staff login. Signs in to Firebase anonymously in the background; a 6-digit PIN (any active PIN in `taskManagerPins`) is the UI-level gate — its own PIN pool, not shared with the Hounslow kiosk. This is an app-level lock for shared use, not per-user authentication.
- **`task-manager-pro-admin.html`**: normal staff Firebase email/password login + `staffProfiles/{uid}.role === 'admin'` check (same pattern as `hounslow-admin.html`/`super-admin.html`). Non-admins see an Access Denied screen.

Neither file links back to `index.html`/home, and neither is listed on the dashboard's tools grid — `task-manager-pro-admin.html` is reachable only via a bookmarked/direct URL, matching how `hounslow-kiosk.html` is handled (only `hounslow-admin.html` gets a dashboard card; the kiosk itself doesn't). The viewer stays kiosk-style deliberately: it's a PIN gate, not a logged-in navigation surface.

## Attribution without login
The viewer has no per-user account, so anything written from it (comments, completions) needs some way to say who did it. On first PIN unlock each browser session, an **initials modal** asks for 2-4 characters, stored in `sessionStorage` (`tmProInitials`) and reused for every comment/completion made afterward in that tab — not asked again on manual/idle re-lock within the same session. The admin panel, by contrast, always has a real signed-in `currentStaff` profile, so admin-created content uses real initials/name throughout.

## Filters & sort (identical in both files)
Four filters plus a sort control, applied client-side over the loaded active/completed task set:
1. **Unit** — active `units`; blank = all units.
2. **Young Person** — disabled until a unit is picked. Options: blank (all tasks for that unit), **"🏢 Unit Tasks"** pseudo-option (`serviceUserId == null` tasks only), then each active service user in that unit (`currentUnitId` match). Picking a specific YP shows only that YP's own tasks.
3. **Priority** — All / High / Medium / Low / No Priority.
4. **Assigned To** — in the viewer, built from the distinct `assignees` initials present in the loaded tasks (no `staffProfiles` read, to avoid depending on anonymous-auth read access to that collection); in the admin, built from all active `staffProfiles`.
5. **Sort** (not a filter) — Due Date (soonest first, no-date last) or Priority (High → Medium → Low → None).

An **Active / Archive** segmented toggle switches the same grid+filters between `completed: false` and `completed: true` tasks.

Tags are a card/label attribute (colored chips), not a filter dimension — deliberately not added as a 5th filter, since it wasn't requested.

## `task-manager-pro.html` flow
1. Anonymous sign-in on load.
2. **PIN screen**: numeric keypad + 6-dot indicator, checked against active `taskManagerPins` (same `checkPin()` shape as `hounslow-kiosk.html`).
3. On first unlock in the session (no `tmProInitials` in `sessionStorage` yet): blocking **initials modal**, then into the main screen. Subsequent unlocks that session skip straight to the main screen.
4. **Main screen**: filter bar + responsive card grid (`auto-fill minmax(280px,1fr)`). Each card: title, priority badge + left border color (red/amber/green/grey), unit badge, YP badge (or "Unit Task"), tag chips, assignee initials avatars, due date (red if overdue), attachment count.
5. Card click → **detail modal**: full description, unit/YP/priority/due-date badges, tags, assignees, attachments (open/download links — no Storage `fetch()`, so no CORS dependency), comments thread with an add-comment box (attributed to the session's initials), and a **Mark Complete** button (hidden once the task is completed).
6. **Mark Complete** opens a small modal for an optional completion note, then sets `completed / completionNote / completedBy / completedByName / completedAt` and refreshes the grid — the task then only shows up under the Archive tab.
7. **Archive** tab: same filter bar, `completed: true` tasks, read-only (view attachments/comments, no reopen — reopen is admin-only).
8. Manual **"🔒 Lock"** button + 10-minute idle auto-lock (`IDLE_LIMIT_MS`, same shape as `hounslow-kiosk.html`'s `resetIdleTimer`/`lockKiosk`) — re-locking clears the PIN/unlocked state but keeps `tmProInitials` for the rest of the browser session.
9. No PWA manifest/service worker, no Hounslow-style rainbow tile skin — standard Connected Stars brand palette, since this is a general staff tool used from any device/browser, not one fixed installed kiosk app.

## `task-manager-pro-admin.html` flow
- **Tasks** view (default): same filter bar + card grid as the viewer, plus an **Active/Archive** toggle. **"+ New Task"** opens a combined create/edit/detail modal:
  - Title, description, Unit (required select), Young Person (optional, populated from the chosen unit), Priority, Due Date, Tags (click-to-toggle chip picker from `taskManagerTags`), Assignees (people-picker component ported from `task-board.html` — `pickerInit`/`pickerSearch`/`pickerSelect`/`pickerGetInitials`/`pickerSetByInitials`/`pickerClear`, keyed by `taskAssigneePicker`).
  - Attachments: "+ Add Link" stages a `{type:'link',url,name}` row; a file input stages `File` objects — both are only written on Save. Files upload to Storage after the task doc exists (new tasks: doc created first so a `taskId` exists for the path, then `updateDoc` appends the resulting URLs).
  - When editing an existing task, the modal also shows: a completed-banner (if applicable), the comments thread (post/delete), and footer actions **Delete** (hard delete, also removes attached Storage files), **Mark Complete** / **Reopen**, and **Save Changes**.
- **Tags** view: add/edit (name + one of 8 preset colors)/reorder (▲▼)/soft-toggle/delete. Seeded with 3 starter tags (**Urgent**/red, **Follow-up**/amber, **Routine**/teal) the first time the view loads with zero tags — freely renamable/removable afterward.
- **Access PINs** view: identical CRUD/mask/reveal pattern to `hounslow-admin.html`'s PIN view, targeting `taskManagerPins` (its own pool, separate from the Hounslow kiosk's).

## Firestore Collections

### `taskManagerPins`
Same shape as `hounslowPins` (see [hounslow.md](hounslow.md)) — plain-text 6-digit PIN, `label`, `status: 'active'|'inactive'`. Its own collection; not shared with `hounslowPins`.

### `taskManagerTags`
```js
{
  name: string,
  color: string,          // hex, one of 8 presets offered in the admin color picker
  order: number,
  status: 'active' | 'inactive',
  createdAt: Timestamp, createdBy: string  // initials
}
```

### `taskManagerTasks`
```js
{
  title: string,
  description: string,
  unitId: string,                    // required
  serviceUserId: string | null,      // null = unit-only task
  tags: string[],                     // taskManagerTags doc IDs
  priority: 'high' | 'medium' | 'low' | null,
  dueDate: string | null,              // YYYY-MM-DD
  assignees: string[],                 // staff initials
  attachments: [{ type: 'link'|'file', url: string, name: string }],
  addedBy: string, addedByName: string,          // admin: real initials/name
  completed: boolean,
  completionNote: string | null,
  completedBy: string | null, completedByName: string | null, completedAt: Timestamp | null,
                                        // viewer: session initials for both fields; admin: real initials/name
  status: 'active' | 'inactive',        // soft-delete (admin delete is currently a hard delete instead — see below)
  createdAt: Timestamp,
  updatedAt: Timestamp, updatedBy: string
}
```
Note: the admin's **Delete** action hard-deletes the task doc (and its Storage file attachments), matching the precedent set by `hounslow-admin.html`'s tile/option delete — `status: 'inactive'` is reserved for a future soft-delete if one is needed, but nothing currently sets it.

### `taskManagerComments`
```js
{
  taskId: string,
  text: string,
  addedBy: string, addedByName: string,   // viewer: session initials; admin: real initials/name
  createdAt: Timestamp
}
```

### Storage path
`taskManagerPro/tasks/{taskId}/{timestamp}_{filename}` — file-type attachments, uploaded via `uploadBytes`/`getDownloadURL` (same pattern as `hounslow-admin.html`). Attachments are surfaced as plain `<a href>` open/download links rather than fetched into a viewer, so — unlike the Hounslow kiosk's PDF.js viewer — this doesn't depend on any Storage CORS configuration.

## Assumption to be aware of
The viewer needs anonymous-auth read (and, for comments/completion, write) access to `units`, `serviceUsers`, and the `taskManager*` collections — not just collections of its own like the Hounslow kiosk's `hounslow*` collections. This assumes the project's Firestore security rules permit this for any authenticated request, anonymous included. If they don't, it'll surface as a permission-denied error in the viewer's console/network tab, and would need a rules change outside this repo.

## State Variables (viewer)
```js
enteredPin, unlocked, idleTimer          // PIN/lock state, same shape as hounslow-kiosk.html
unitsCache[], serviceUsersCache[], tagsCache[], tasks[]
viewingArchive     // boolean, Active vs Archive tab
openTaskId         // task currently open in the detail modal
completingTaskId   // task pending confirmation in the complete modal
sessionInitials    // sessionStorage-backed, set once via the initials modal
```

## State Variables (admin)
```js
currentUser, currentStaff
staffCache[], unitsCache[], serviceUsersCache[]
pins[], tags[], tasks[]
editingPinId, editingTagId, editingTaskId   // null = creating new
revealedPins                                 // Set, PIN show/hide
selectedTagIds                               // Set, tag picker state in the task modal
existingAttachments[], pendingNewLinks[], pendingFiles[]   // task modal attachment staging
viewingArchive, completingTaskId
selectedTagColor
pickerState   // people-picker state, keyed by pickerId (taskAssigneePicker)
```

## Key Functions (shared shape between both files)
| Function | Purpose |
|---|---|
| `checkPin()` (viewer only) | Compare entered PIN against active `taskManagerPins`, unlock on match |
| `onFilterUnitChange()` | Repopulate the Young Person filter for the selected unit, including the "Unit Tasks" pseudo-option |
| `getFilteredSortedTasks()` | Apply the four filters + Active/Archive toggle, then sort by date or priority |
| `renderTasks()` | Rebuild the card grid from `getFilteredSortedTasks()` |
| `openTaskDetail(id)` (viewer) / `openTaskModal(id)` (admin) | Open the detail/edit modal for a task, loading its comments |
| `postComment()` / `addComment` | Add a `taskManagerComments` doc attributed to the current session/staff identity |
| `openCompleteModal(id)` / `confirmCompleteTask()` | Set `completed`/`completionNote`/`completedBy`/`completedAt` |
| `saveTask()` (admin only) | Create/update a `taskManagerTasks` doc, upload any staged attachments |
| `deleteTaskConfirm()` / `reopenTaskConfirm()` (admin only) | Hard-delete a task (and its Storage files) / clear its completion fields |
| `saveTag()` / `toggleTag()` / `deleteTag()` / `moveTag()` (admin only) | CRUD + reorder for `taskManagerTags` |
| `savePin()` / `togglePin()` / `deletePin()` / `togglePinReveal()` (admin only) | CRUD + show/hide for `taskManagerPins` |
