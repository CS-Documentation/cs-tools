# hounslow-kiosk.html / hounslow-admin.html — Hounslow On-Site Database

## Purpose
An on-site PIN-locked kiosk for an Android tablet at Hounslow. Staff tap through **service user → document category → PDF** without the usual staff login. A separate admin panel controls which service users appear, their tile image/name, the document categories per service user, and the PDF behind each one.

## Access
- **`hounslow-kiosk.html`**: no staff login. Signs in to Firebase anonymously in the background; a 6-digit PIN (any active PIN in `hounslowPins`) is the UI-level gate. This is an app-level lock for a shared on-site device, not per-user authentication — anyone with the PIN and physical access to the tablet can view documents.
- **`hounslow-admin.html`**: normal staff Firebase email/password login + `staffProfiles/{uid}.role === 'admin'` check (same pattern as `super-admin.html`). Non-admins see an Access Denied screen.

## Visual style — kiosk only
`hounslow-kiosk.html` deliberately breaks from the rest of the repo's `--brand` blue design system, at the user's request: the young people using it are used to self-order kiosks (McDonald's-style), so the tile UI is bright, bold and colorful rather than corporate. `hounslow-admin.html` is unaffected and stays on the standard Connected Stars palette, since it's a staff tool.

- Adds `Space Grotesk` (700/800) as a display font for titles/tile names/numbers, layered on top of the existing DM Sans.
- Adds an 8-color rotating palette (`--c1-strong/tint` … `--c8-strong/tint` in `:root`) — each service-user tile, option tile, and PIN-pad digit gets a distinct color via `tileColorStyle(index)`, cycling through the 8. `strong` shades are chosen to stay AA-contrast-safe under white text/icons (fallback avatar initials, solid fills); `tint` shades are pale backgrounds for icon circles where the icon is drawn in the matching `strong` color.
- Tiles are bigger (260px+ home, 230px+ options), bolder (800-weight Space Grotesk names), with a 7px colored top border and a color-tinted shadow.
- The Connected Stars checkmark logo mark is kept in the PIN screen and both topbars, so branding is still present within the more playful skin.

## `hounslow-kiosk.html` flow
1. Anonymous sign-in on load.
2. **PIN screen**: on-screen numeric keypad, 6-digit dot indicator. Entered PIN is compared directly against the `pin` field of every `status: 'active'` doc in `hounslowPins` — a match on any of them unlocks.
3. **Home screen**: tiles from `hounslowTiles` (`status: 'active'`, ordered by `order`) — custom image or initials fallback, `displayName`.
4. **Options screen**: tiles from `hounslowOptions` for the tapped `tileId` (`status: 'active'`, ordered by `order`). Options with no `fileUrl` yet render muted/disabled ("Not yet available") instead of a dead tap.
5. **PDF viewer**: renders the PDF itself, page by page, onto `<canvas>` elements via [PDF.js](https://mozilla.github.io/pdf.js/) (loaded from jsDelivr, pinned to `pdfjs-dist@4.10.38`), in a scrollable full-screen view with a persistent Back button — never opens a new tab. This replaced an `<iframe src="...">` approach: Android Chrome doesn't reliably render PDFs embedded in an iframe and was prompting a native "Download" dialog instead, breaking the kiosk's self-contained feel. Rendering to canvas sidesteps the browser's native PDF handling entirely, so behavior is consistent across platforms.
   **Requires Firebase Storage CORS to be configured** — PDF.js fetches the file via `fetch()`, which is a cross-origin request from the GitHub Pages origin to the Storage bucket, and needs the bucket's CORS policy to allow it (this wasn't needed for the old iframe approach, since a simple iframe navigation doesn't go through fetch's CORS checks). The viewer's error screen calls this out specifically when it looks like the cause. Fix via `gsutil cors set cors.json gs://connected-stars-handover.firebasestorage.app` with a `cors.json` allowing GET from the site's origin — see the project chat history for the exact command, or Google Cloud Console → Cloud Storage → bucket → Permissions/CORS.
6. **Back navigation**: always one level up (viewer → options → home).
7. **Idle auto-lock**: 10 minutes of no touch/click/keydown/scroll re-locks to the PIN screen. A manual "🔒 Lock" button is always visible on the home/options screens.
8. Registers `hounslow-manifest.json` + `hounslow-sw.js` for "Add to Home Screen" / offline app-shell caching. The service worker only caches the static shell (HTML/manifest/icon) — Firestore and Storage requests always go to the network so data and PDFs are never stale.

## `hounslow-admin.html` flow
- **Access PINs** view: create/edit/deactivate/delete PINs (label + 6-digit value). The PIN column is masked (••••••) with a per-row show/hide toggle. Multiple PINs can be active at once and each can be edited or revoked independently.
- **Service User Tiles** view: add/edit/delete tiles — set a freeform `displayName` (not linked to the `serviceUsers` collection) and optionally upload a tile image (Firebase Storage), soft activate/deactivate. Deleting a tile hard-deletes it and all of its options + their uploaded PDFs.
- **Manage Options** (drill into a tile): add/edit/delete option tiles for that specific service user (name, icon from a small inline SVG set, PDF upload), reorder via up/down buttons, activate/deactivate. **"Duplicate from…"** copies name/icon/order from another tile's options (PDFs left empty) so staff aren't rebuilding the same categories from scratch for every new service user — options are still fully independent per service user after duplicating.

## Firestore Collections

### `hounslowPins`
```js
{
  label: string,        // admin-facing name, e.g. "Reception"
  pin: string,           // the 6-digit PIN itself, stored in plain text — see note below
  status: 'active' | 'inactive',
  createdAt: Timestamp, createdBy: string,  // initials
  updatedAt: Timestamp, updatedBy: string
}
```
**Stored in plain text, deliberately** — this replaced an earlier SHA-256-hashed design at the user's request, so admins can view and edit a PIN after creation instead of only revoking and re-issuing. This is a reasonable tradeoff here: a 6-digit PIN only has 1,000,000 possible values, so the hash was never a meaningful barrier (trivially reversible by brute force), and the kiosk already ships the full active-PIN list to an anonymous, unauthenticated client to check against — so the value was already exposed to anyone inspecting that traffic. Plain text just makes the existing trust model (physical access + PIN) honest rather than adding a false sense of security.

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
| `checkPin()` | Compare entered PIN against active `hounslowPins`, unlock on match |
| `goHome()` | Load active tiles, show home screen |
| `openTile(tileId)` | Load active options for a tile, show options screen |
| `openViewer(url, name)` | Load the PDF via PDF.js and render each page to a `<canvas>` in the viewer |
| `goBackFromViewer()` | Return to options screen, clear rendered pages |
| `lockKiosk()` | Re-lock: clear state, show PIN screen |
| `resetIdleTimer()` | Restart the 10-minute idle auto-lock countdown |

## Key Functions (admin)
| Function | Purpose |
|---|---|
| `savePin()` / `togglePin()` / `deletePin()` / `togglePinReveal()` | CRUD + show/hide for `hounslowPins` |
| `saveTile()` | Create/update a `hounslowTiles` doc, upload image if staged |
| `deleteTile()` | Hard-delete a tile and all of its options |
| `openTileDetail(id)` | Switch into "Manage Options" view for a tile |
| `saveOption()` | Create/update a `hounslowOptions` doc, upload PDF if staged |
| `moveOption(id, dir)` | Swap `order` with the adjacent option |
| `confirmDuplicate()` | Copy another tile's options (minus PDFs) into the current tile |
