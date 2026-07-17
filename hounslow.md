# hounslow-kiosk.html / hounslow-admin.html — Hounslow On-Site Database

## Purpose
An on-site PIN-locked kiosk for an Android tablet at Hounslow. Staff tap through **service user → document category → PDF** without the usual staff login. A separate admin panel controls which service users appear, their tile image/name, the document categories per service user, and the PDF behind each one.

## Access
- **`hounslow-kiosk.html`**: no staff login. Signs in to Firebase anonymously in the background; a 6-digit PIN (any active PIN in `hounslowPins`) is the UI-level gate. This is an app-level lock for a shared on-site device, not per-user authentication — anyone with the PIN and physical access to the tablet can view documents.
- **`hounslow-admin.html`**: normal staff Firebase email/password login + `staffProfiles/{uid}.role === 'admin'` check (same pattern as `super-admin.html`). Non-admins see an Access Denied screen.

## `hounslow-kiosk.html` flow
1. Anonymous sign-in on load.
2. **PIN screen**: on-screen numeric keypad, 6-digit dot indicator. Entered PIN is SHA-256 hashed client-side and compared against every `status: 'active'` doc in `hounslowPins` — a match on any of them unlocks.
3. **Home screen**: tiles from `hounslowTiles` (`status: 'active'`, ordered by `order`) — custom image or initials fallback, `displayName`.
4. **Options screen**: tiles from `hounslowOptions` for the tapped `tileId` (`status: 'active'`, ordered by `order`). Options with no `fileUrl` yet render muted/disabled ("Not yet available") instead of a dead tap.
5. **PDF viewer**: full-screen `<iframe>` over the option's `fileUrl`, with a persistent Back button — never opens a new tab.
6. **Back navigation**: always one level up (viewer → options → home).
7. **Idle auto-lock**: 10 minutes of no touch/click/keydown/scroll re-locks to the PIN screen. A manual "🔒 Lock" button is always visible on the home/options screens.
8. Registers `hounslow-manifest.json` + `hounslow-sw.js` for "Add to Home Screen" / offline app-shell caching. The service worker only caches the static shell (HTML/manifest/icon) — Firestore and Storage requests always go to the network so data and PDFs are never stale.

## `hounslow-admin.html` flow
- **Access PINs** view: create/deactivate/delete PINs (label + 6-digit value, hashed before writing). Multiple PINs can be active at once; the PIN value itself is never shown again after creation.
- **Service User Tiles** view: add/edit/delete tiles — set a freeform `displayName` (not linked to the `serviceUsers` collection) and optionally upload a tile image (Firebase Storage), soft activate/deactivate. Deleting a tile hard-deletes it and all of its options + their uploaded PDFs.
- **Manage Options** (drill into a tile): add/edit/delete option tiles for that specific service user (name, icon from a small inline SVG set, PDF upload), reorder via up/down buttons, activate/deactivate. **"Duplicate from…"** copies name/icon/order from another tile's options (PDFs left empty) so staff aren't rebuilding the same categories from scratch for every new service user — options are still fully independent per service user after duplicating.

## Firestore Collections

### `hounslowPins`
```js
{
  label: string,        // admin-facing only, e.g. "Reception" — never the PIN itself
  pinHash: string,       // SHA-256 hex digest of the 6-digit PIN
  status: 'active' | 'inactive',
  createdAt: Timestamp, createdBy: string,  // initials
  updatedAt: Timestamp, updatedBy: string
}
```

### `hounslowTiles`
```js
{
  displayName: string,     // freeform — not linked to the serviceUsers collection
  imageUrl: string | null, // Firebase Storage download URL
  order: number,
  status: 'active' | 'inactive',
  createdAt: Timestamp, updatedAt: Timestamp, updatedBy: string
}
```
Tiles are intentionally standalone — no `serviceUserId` reference. An earlier version linked each tile to a `serviceUsers` doc via a required dropdown, but that dropdown query hit a Firestore composite-index issue and was removed at the user's request rather than fixed, since the link added a hard dependency without being needed for the kiosk to function.

### `hounslowOptions`
```js
{
  tileId: string,          // ref to hounslowTiles
  name: string,
  icon: string,             // key into the inline SVG icon set (see below)
  order: number,
  status: 'active' | 'inactive',
  fileUrl: string | null,   // Firebase Storage download URL of the PDF
  fileName: string | null,
  fileType: 'pdf',           // reserved for future 'video' | 'html'
  uploadedAt: Timestamp | null, uploadedBy: string | null,
  createdAt: Timestamp, updatedAt: Timestamp, updatedBy: string
}
```

## Firebase Storage paths
- `hounslow/tiles/{tileId}/{timestamp}_{filename}` — tile images
- `hounslow/docs/{optionId}/{timestamp}_{filename}` — PDFs

This is the first tool in the repo to use Firebase Storage (every other tool stores content as text/HTML directly in Firestore).

## Icon set
Both files define the same inline SVG icon dictionary (`ICONS` object, 14 outline glyphs: document, shield, heart, calendar, users, clipboard, alert, book, phone, home, star, filetext, briefcase, chat) rendered via a local `iconSvg(key, size)` helper. No emoji icons are used for option tiles, per the project's UI/UX conventions.

## PWA assets
| File | Purpose |
|---|---|
| `hounslow-manifest.json` | Web app manifest — name, brand colors, `display: standalone`, icon references. Linked only from `hounslow-kiosk.html`. |
| `hounslow-sw.js` | Service worker — cache-first for the static shell, network-only passthrough for everything else. |
| `hounslow-icon.svg` | Brand-colored app icon (blue gradient square + checkmark mark, matching the existing login logo motif). |

Not yet built: a wrapper Android APK (Trusted Web Activity via PWABuilder/Bubblewrap) pointed at the hosted kiosk URL — a follow-up packaging step once the PWA is live on GitHub Pages, not part of this repo.

## State Variables (kiosk)
```js
enteredPin       // string, digits typed so far on the PIN pad
unlocked         // boolean
currentTile      // the open hounslowTiles doc, or null
tilesCache[]     // active hounslowTiles, loaded on unlock/home
idleTimer        // setTimeout handle for the 10-min auto-lock
```

## State Variables (admin)
```js
pins[], tiles[], options[]   // options = current open tile's hounslowOptions
currentTileId                                 // tile being managed in "Manage Options"
editingTileId, editingOptionId                // null = creating new
pendingTileImageFile, pendingOptPdfFile       // File objects staged before upload
selectedIcon                                  // icon key chosen in the option modal's icon picker
confirmAction                                 // async fn stored for the shared confirm dialog
```

## Key Functions (kiosk)
| Function | Purpose |
|---|---|
| `checkPin()` | Hash entered PIN, compare against active `hounslowPins`, unlock on match |
| `goHome()` | Load active tiles, show home screen |
| `openTile(tileId)` | Load active options for a tile, show options screen |
| `openViewer(url, name)` | Show the PDF viewer iframe |
| `goBackFromViewer()` | Return to options screen, clear iframe |
| `lockKiosk()` | Re-lock: clear state, show PIN screen |
| `resetIdleTimer()` | Restart the 10-minute idle auto-lock countdown |

## Key Functions (admin)
| Function | Purpose |
|---|---|
| `savePin()` / `togglePin()` / `deletePin()` | CRUD for `hounslowPins` |
| `saveTile()` | Create/update a `hounslowTiles` doc, upload image if staged |
| `deleteTile()` | Hard-delete a tile and all of its options |
| `openTileDetail(id)` | Switch into "Manage Options" view for a tile |
| `saveOption()` | Create/update a `hounslowOptions` doc, upload PDF if staged |
| `moveOption(id, dir)` | Swap `order` with the adjacent option |
| `confirmDuplicate()` | Copy another tile's options (minus PDFs) into the current tile |
