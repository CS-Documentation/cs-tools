# hounslow-kiosk.html / hounslow-admin.html — Hounslow On-Site Database

## Purpose
An on-site PIN-locked kiosk for an Android tablet at Hounslow. Staff tap through **tile → document category → PDF** without the usual staff login. A separate admin panel controls which tiles appear (freeform name + image, not linked to the `serviceUsers` collection — see note under `hounslowTiles` below), the document categories per tile, and the PDF behind each one.

## Access
- **`hounslow-kiosk.html`**: no staff login. Signs in to Firebase anonymously in the background; a 6-digit PIN (any active PIN in `hounslowPins`) is the UI-level gate. This is an app-level lock for a shared on-site device, not per-user authentication — anyone with the PIN and physical access to the tablet can view documents.
- **`hounslow-admin.html`**: normal staff Firebase email/password login + `staffProfiles/{uid}.role === 'admin'` check (same pattern as `super-admin.html`). Non-admins see an Access Denied screen.

## Visual style — kiosk only
`hounslow-kiosk.html` deliberately breaks from the rest of the repo's `--brand` blue design system, at the user's request: the young people using it are used to self-order kiosks (McDonald's-style), so the tile UI is bright, bold and colorful rather than corporate. `hounslow-admin.html` is unaffected and stays on the standard Connected Stars palette, since it's a staff tool.

- Adds `Space Grotesk` (700/800) as a display font for titles/tile names/numbers, layered on top of the existing DM Sans.
- Adds an 8-color rotating palette (`--c1-strong/tint` … `--c8-strong/tint` in `:root`) — each service-user tile, option tile, and PIN-pad digit gets a distinct color via `tileColorStyle(index)`, cycling through the 8. `strong` shades are chosen to stay AA-contrast-safe under white text/icons (fallback avatar initials, solid fills); `tint` shades are pale backgrounds for icon circles where the icon is drawn in the matching `strong` color.
- Tiles are bigger (260px+ home, 230px+ options), bolder (800-weight Space Grotesk names), with a 7px colored top border and a color-tinted shadow.
- The Connected Stars checkmark logo mark is kept in the PIN screen and both topbars, so branding is still present within the more playful skin.
- Unlike every other tool in the repo, neither `hounslow-kiosk.html` nor its logo links back to `index.html` — it's a locked-down on-site kiosk, not a staff navigation surface. `hounslow-admin.html`'s sidebar logo does link to `index.html`/home, consistent with the other staff tools.

## `hounslow-kiosk.html` flow
1. Anonymous sign-in on load.
2. **PIN screen**: on-screen numeric keypad, 6-digit dot indicator. Entered PIN is compared directly against the `pin` field of every `status: 'active'` doc in `hounslowPins` — a match on any of them unlocks.
3. **Home screen**: tiles from `hounslowTiles` (`status: 'active'`, ordered by `order`) — custom image or initials fallback, `displayName`.
4. **Options screen**: tiles from `hounslowOptions` for the tapped `tileId` (`status: 'active'`, ordered by `order`). Options with no `fileUrl` yet render muted/disabled ("Not yet available") instead of a dead tap.
5. **PDF viewer**: renders the PDF itself, page by page, onto `<canvas>` elements via [PDF.js](https://mozilla.github.io/pdf.js/) (loaded from jsDelivr, pinned to `pdfjs-dist@4.10.38`), in a scrollable full-screen view with a persistent Back button — never opens a new tab. This replaced an `<iframe src="...">` approach: Android Chrome doesn't reliably render PDFs embedded in an iframe and was prompting a native "Download" dialog instead, breaking the kiosk's self-contained feel. Rendering to canvas sidesteps the browser's native PDF handling entirely, so behavior is consistent across platforms.
   **Requires Firebase Storage CORS to be configured** — PDF.js fetches the file via `fetch()`, which is a cross-origin request from the GitHub Pages origin to the Storage bucket, and needs the bucket's CORS policy to allow it (this wasn't needed for the old iframe approach, since a simple iframe navigation doesn't go through fetch's CORS checks). The viewer's error screen calls this out when a document fails to open — browsers give the identical generic error for a CORS block and a real network failure, so it can't distinguish which one occurred. Fix via `gsutil cors set cors.json gs://connected-stars-handover.firebasestorage.app` with a `cors.json` allowing GET from the site's origin — see the project chat history for the exact command, or Google Cloud Console → Cloud Storage → bucket → Permissions/CORS.
   **Rendered at device pixel ratio, with zoom controls** — each page canvas is rendered at `fit-to-width scale × zoom × window.devicePixelRatio`, with the CSS display size held at the lower `scale × zoom` value. Rendering 1:1 with CSS pixels (ignoring DPR) produced visibly blurry/low-res text on tablets with a pixel ratio above 1, since the canvas buffer had fewer actual pixels than the screen was displaying it at. `+`/`−` buttons in the viewer topbar adjust `currentZoom` (0.5×–3×, steps of 0.25) and re-render the already-loaded `currentPdf` from memory — no re-fetch — so zooming stays fast and every zoom level is rendered freshly from the PDF's vector data rather than stretching a fixed-resolution raster.
   **Pinch-zoom is re-enabled just for the viewer** — the kiosk locks pinch-zoom everywhere else (`user-scalable=no` in the viewport meta, for the app-like feel), which meant there was no way to pinch into a document even with the buttons present. `setViewportZoomable(true/false)` swaps the `<meta name="viewport">` content between a locked and a zoomable (`user-scalable=yes`, up to 6×) variant on entering/leaving the viewer.
6. **Back navigation**: viewer → options is one level up (same service user, no re-lock). Options → home instead calls `lockKiosk()` (same as tapping the manual "🔒 Lock" button) rather than just showing the tile grid — going back out of one service user's documents and into another's **always** requires the PIN again, not just after the 10-minute idle timeout. This was a deliberate change from the original "options → home is free navigation" behavior, at the user's request, since different tiles hold different service users' sensitive documents.
7. **Idle auto-lock**: 10 minutes of no touch/click/keydown/scroll while unlocked re-locks to the PIN screen. A manual "🔒 Lock" button is always visible on the home/options screens.
8. **Screensaver**: a "🖼️ Screensaver" button sits on the PIN screen (hidden if no active photos are configured). Tapping it, or leaving the kiosk idle on the PIN screen for `idleSeconds` (from `hounslowScreensaverSettings/config`, default 60s), shows a full-screen photo slideshow cycling through active `hounslowScreensaverPhotos`, crossfading every `photoSeconds` (default 8s) using the configured `transition` (`fade` / `slide` / `zoom` — a subtle Ken Burns scale). Play order follows the admin ▲▼ order by default, or is shuffled (Fisher-Yates) when `randomOrder` is on — reshuffled at each loop boundary, with a swap guard so the same photo can't land back-to-back across the seam. Touching the screen anywhere during playback stops it and returns to the PIN screen. All photos, ordering, and these timing/transition settings are managed entirely from `hounslow-admin.html` — the kiosk only reads them. A single `handleActivity()` dispatcher on `click`/`touchstart`/`keydown`/`scroll` routes activity to whichever timer applies to the current state: the 10-min auto-lock while unlocked, the screensaver idle countdown while sitting on the PIN screen, or an immediate `stopScreensaver()` while the screensaver is playing.
9. Registers `hounslow-manifest.json` + `hounslow-sw.js` for "Add to Home Screen" / offline app-shell caching. Firestore and Storage requests always go straight to the network so data and PDFs are never stale. `hounslow-kiosk.html` itself is **network-first** (try network, fall back to cache only if offline) — an earlier version cached it cache-first, which meant every code update silently never reached a device that had already loaded it once, since it kept serving the frozen first-ever copy indefinitely. Only `hounslow-manifest.json`/`hounslow-icon.svg` (genuinely static, rarely change) are cache-first. `CACHE_NAME` is bumped (`hounslow-shell-v2`) whenever the caching strategy itself changes, to force old installed caches to be dropped.

## `hounslow-admin.html` flow
- **Access PINs** view: create/edit/deactivate/delete PINs (label + 6-digit value). The PIN column is masked (••••••) with a per-row show/hide toggle. Multiple PINs can be active at once and each can be edited or revoked independently.
- **Service User Tiles** view: add/edit/delete tiles — set a freeform `displayName` (not linked to the `serviceUsers` collection) and optionally upload a tile image (Firebase Storage), soft activate/deactivate. Deleting a tile hard-deletes it and all of its options + their uploaded PDFs.
- **Manage Options** (drill into a tile): add/edit/delete option tiles for that specific service user (name, icon from a small inline SVG set, PDF upload), reorder via up/down buttons, activate/deactivate. **"Duplicate from…"** copies name/icon/order from another tile's options (PDFs left empty) so staff aren't rebuilding the same categories from scratch for every new service user — options are still fully independent per service user after duplicating.
- **Screensaver** view: two parts on one page —
  - **Settings**: transition style (Fade / Slide / Zoom), seconds per photo, idle seconds before the kiosk auto-starts the screensaver on its own, and a "play photos in random order" checkbox. Saved as a single `hounslowScreensaverSettings/config` doc via `setDoc(..., {merge:true})`.
  - **Photos**: a dropzone with `<input type="file" multiple>` for **bulk upload** — selecting several images at once uploads each as its own `hounslowScreensaverPhotos` doc (Firestore doc created first, then the file streamed to Storage, then the doc patched with the resulting URL — matching the tile/option upload pattern elsewhere in this file). Reorder via ▲▼, soft on/off toggle, hard delete (also removes the Storage object).

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

### `hounslowScreensaverPhotos`
```js
{
  imageUrl: string | null, // Firebase Storage download URL, null until upload completes
  order: number,
  status: 'active' | 'inactive',
  createdAt: Timestamp, createdBy: string  // initials
}
```
One doc per photo, so **bulk upload** (selecting multiple files at once in the admin dropzone) just creates one doc + one Storage upload per file, in parallel with the rest of the app's single-file upload pattern.

### `hounslowScreensaverSettings`
Single fixed-id doc, `hounslowScreensaverSettings/config`:
```js
{
  transition: 'fade' | 'slide' | 'zoom',
  photoSeconds: number,   // how long each photo displays before crossfading, default 8
  idleSeconds: number,    // seconds of inactivity on the kiosk PIN screen before auto-start, default 60
  randomOrder: boolean,   // shuffle play order (Fisher-Yates) instead of the admin ▲▼ order, default false
  updatedAt: Timestamp, updatedBy: string
}
```

## Firebase Storage paths
- `hounslow/tiles/{tileId}/{timestamp}_{filename}` — tile images
- `hounslow/docs/{optionId}/{timestamp}_{filename}` — PDFs
- `hounslow/screensaver/{photoId}/{timestamp}_{filename}` — screensaver photos

This is the first tool in the repo to use Firebase Storage (every other tool stores content as text/HTML directly in Firestore).

## Icon set
Both files define the same inline SVG icon dictionary (`ICONS` object, 14 outline glyphs: document, shield, heart, calendar, users, clipboard, alert, book, phone, home, star, filetext, briefcase, chat) rendered via a local `iconSvg(key, size)` helper. No emoji icons are used for option tiles, per the project's UI/UX conventions.

## PWA assets
| File | Purpose |
|---|---|
| `hounslow-manifest.json` | Web app manifest — name, brand colors, `display: standalone`, icon references. Linked only from `hounslow-kiosk.html`. |
| `hounslow-sw.js` | Service worker — network-first for `hounslow-kiosk.html` (falls back to cache offline), cache-first for `hounslow-manifest.json`/`hounslow-icon.svg`, network-only passthrough for everything else (Firestore/Storage/fonts). |
| `hounslow-icon.svg` | Brand-colored app icon (blue gradient square + checkmark mark, matching the existing login logo motif). |

Not yet built: a wrapper Android APK (Trusted Web Activity via PWABuilder/Bubblewrap) pointed at the hosted kiosk URL — a follow-up packaging step once the PWA is live on GitHub Pages, not part of this repo.

## State Variables (kiosk)
```js
enteredPin       // string, digits typed so far on the PIN pad
unlocked         // boolean
currentTile      // the open hounslowTiles doc, or null
tilesCache[]     // active hounslowTiles, loaded on unlock/home
idleTimer        // setTimeout handle for the 10-min auto-lock
currentPdf       // the PDF.js document object for whatever's open in the viewer, or null
currentZoom      // number, 0.5-3, multiplier on top of fit-to-width scale
viewerRenderToken // incrementing counter; a render loop bails if this changes mid-await (navigated away)
screensaverPhotos[]   // active hounslowScreensaverPhotos, loaded once on app start
screensaverSettings   // { idleSeconds, photoSeconds, transition, randomOrder }, defaults merged with hounslowScreensaverSettings/config
screensaverActive     // boolean, true while the screensaver screen is showing
ssTimer               // setInterval handle cycling to the next photo
ssOrder, ssPos         // play-order array of screensaverPhotos indices for the current pass, and position within it — sequential or shuffled per screensaverSettings.randomOrder
ssFront                // which of the two crossfade <img> layers is currently "front"
pinIdleTimer          // setTimeout handle for the screensaver auto-start countdown while on the PIN screen
```

## State Variables (admin)
```js
pins[], tiles[], options[]   // options = current open tile's hounslowOptions
currentTileId                                 // tile being managed in "Manage Options"
editingTileId, editingOptionId                // null = creating new
pendingTileImageFile, pendingOptPdfFile       // File objects staged before upload
selectedIcon                                  // icon key chosen in the option modal's icon picker
confirmAction                                 // async fn stored for the shared confirm dialog
editingPinId                                  // null = creating a new PIN, else the doc id being edited
revealedPins                                  // Set of PIN doc ids currently shown un-masked in the table
screensaverPhotos[]     // all hounslowScreensaverPhotos (active + inactive), loaded on app start
screensaverSettings     // raw hounslowScreensaverSettings/config doc data
```

## Key Functions (kiosk)
| Function | Purpose |
|---|---|
| `checkPin()` | Compare entered PIN against active `hounslowPins`, unlock on match |
| `goHome()` | Load active tiles, show home screen |
| `openTile(tileId)` | Load active options for a tile, show options screen |
| `openViewer(url, name)` | Load the PDF via PDF.js into `currentPdf`, call `renderAllPages()` |
| `renderAllPages(token)` | Render every page of `currentPdf` at `fit-width × currentZoom × devicePixelRatio` |
| `zoomIn()` / `zoomOut()` | Adjust `currentZoom`, re-render `currentPdf` from memory (no re-fetch) |
| `setViewportZoomable(bool)` | Swap the viewport meta between locked and pinch-zoomable, for the viewer screen |
| `goBackFromViewer()` | Return to options screen, clear rendered pages and `currentPdf`, re-lock viewport |
| `lockKiosk()` | Re-lock: clear state, show PIN screen, arm the screensaver idle timer. Called by both the manual "🔒 Lock" button and the options screen's back arrow, so switching service users always re-locks |
| `resetIdleTimer()` | Restart the 10-minute idle auto-lock countdown (only while unlocked) |
| `handleActivity()` | Single listener for click/touchstart/keydown/scroll; routes to `stopScreensaver()`, `resetIdleTimer()`, or `resetPinIdleTimer()` depending on current state |
| `loadScreensaverConfig()` | Load `hounslowScreensaverSettings/config` + active `hounslowScreensaverPhotos` once on app start; show/hide the PIN screen's Screensaver button |
| `resetPinIdleTimer()` | Restart the screensaver auto-start countdown (only while on the PIN screen, not mid-screensaver, and only if photos exist) |
| `buildSsOrder(avoidFirst)` | Build one pass's play order — shuffled when `randomOrder` is on, sequential otherwise; nudges the shuffle so `avoidFirst` (the last photo shown) doesn't land first again |
| `startScreensaver()` | Show the screensaver screen, build the initial `ssOrder`, begin cycling photos every `photoSeconds`, reshuffling at each loop boundary when `randomOrder` is on |
| `showSsPhoto(index)` | Crossfade to a given photo (by index into `screensaverPhotos`) using the configured transition, alternating between the two layered `<img>` elements |
| `stopScreensaver()` | Stop the interval, return to the PIN screen, re-arm `resetPinIdleTimer()` |

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
| `saveScreensaverSettings()` | `setDoc`-merge transition/photoSeconds/idleSeconds into `hounslowScreensaverSettings/config` |
| `loadScreensaverPhotos()` / `renderScreensaverPhotos()` | Load and render all `hounslowScreensaverPhotos`, ordered |
| (bulk file input `change` handler) | Uploads every selected file as its own photo doc — creates the Firestore doc first, uploads to Storage, then patches the doc with the resulting URL, looping over all selected files |
| `moveScreensaverPhoto(id, dir)` | Swap `order` with the adjacent photo |
| `toggleScreensaverPhoto(id)` / `deleteScreensaverPhoto(id)` | Soft on/off vs. hard delete (also removes the Storage object) |
