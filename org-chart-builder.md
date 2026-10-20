# org-chart-builder.html: Org Chart Builder (local, no login)

## Purpose
A flexible drawing tool for staff hierarchy / org charts. Free-position boxes (name, role, other information), optional connecting lines, free text with or without a border, pictures, per-item colours, PDF export, and saving charts as `.json` files so several versions can be kept and re-opened. Built because Word is too rigid for this.

Standalone, like `support-plan-sample.html`: **no Firebase, no login, no Firestore collections, nothing leaves the computer.** Not linked from `index.html`. It is just the file; open it in a browser from disk (`file://`) or from any web server.

## Browser support
- **Chrome / Edge**: full feature set. Uses the File System Access API (`showDirectoryPicker`), so **Save silently overwrites** a file in a folder the user picked once.
- **Firefox / Safari**: no folder API (`fsOK` is false). **Save downloads** `<name>.json` to Downloads (the browser makes `name (1).json` on repeat saves); **Open** uses a normal file picker. The folder chip says so. Everything else works.
- Chrome refuses some top-level folders (Documents, Downloads, Desktop) with "contains system files". The error toast and Help tell the user to make a sub-folder (e.g. "Org Charts") and pick that.

## Screens / areas
- **Top bar**: logo, title, chart name box, save chip (`New chart` / `● Unsaved changes` / `✓ Saved`), New, Open…, Save, Save as…, Export PDF, undo/redo, zoom −/%/+/Fit, Help (?).
- **Left rail** (`data-tool`): Staff box, Text box (bordered), Plain text, Picture, Line (free), Join boxes (connect mode), Tidy up.
- **Canvas** (`#workspace` > `#wrap` > `#sheet`): the white sheet is the printable page (default A4 landscape) on a grey workspace with 360 px of margin (`PAD`) each side. Items may sit off the sheet (a "parking area"); they are **not** printed.
- **Right inspector** (`#inspector`, rebuilt by `renderInspector()`): nothing selected → page and grid settings + tips; one/many items → details, quick colours, colours, border and shape, text, size and position, actions (align/space/match/join for multi-select); a line → shape, colour, thickness, pattern, arrowheads, rounding, bend, end sides, detach/swap/delete.
- **Status bar**: hint text and the **folder chip** (click to choose/change the folder or re-allow access).
- **Dialogs** (single `<dialog id="dlg">`, `modal()` helper): folder explainer, Save as…, Open a chart (folder list), Help.

## Item types (`doc.items[]`, array order = z-order)
| `type` | Content fields | Notes |
|---|---|---|
| `box` | `name`, `role`, `info` (multi-line) | Staff box. Accent bar `none/top/left`, three text sizes, role/info colours. |
| `text` | `text` (multi-line) | Text box. Border off by default (`strokeW: 0`, `fill: 'transparent'`) = plain text; the "Text box" tool starts with a border and white fill. |
| `image` | `asset` (key into `assets`) | Resized to max 900 px on import (PNG kept for transparency, otherwise JPEG 0.88). Corner handles keep aspect ratio. |

Common: `id, x, y, w, h, autoH` (height follows text; measured from the DOM into `h`), `fill, stroke, strokeW, strokeStyle` (`solid/dashed/dotted`), `radius, pad, shadow, align, color`. Box only: `nameSize, roleSize, infoSize, roleColor, infoColor, bold, accent, accentColor`. Text only: `fontSize, bold, italic, underline`.

## Lines (`doc.conns[]`, drawn under all items)
`{ id, a, b, style, color, width, dash, arrow, radius, bend, sa, sb }`
- `a` / `b` is `{ item: id }` (attached, follows the box) or `{ x, y }` (free end). So a line can join two boxes, one box and a point, or float on its own.
- `style`: `elbow` (right-angle, org-chart look, rounded by `radius`, bus position by `bend` 0.1–0.9), `straight`, `curve`.
- `sa` / `sb`: which side of the box the line uses, `auto|top|right|bottom|left`. Auto picks from the relative position (`autoSides()`), so parent-bottom → child-top by default; siblings on the same row share one horizontal bus.
- `arrow`: `none|end|start|both` (drawn as polygons, not SVG markers, so colours match in PDF).
- Deleting an item deletes lines attached to it.

## Interactions
- **Add**: left rail buttons place the item at the nearest empty spot to the view centre (`freeSpot()`) and start inline editing. Double-click empty sheet adds a staff box there.
- **Edit text**: double-click (or Enter on a selected item). Fields are `contenteditable`; Enter/Tab moves name → role → info, Ctrl+Enter / Esc finishes, paste is plain text only.
- **Move**: drag; grid snap (default on, 10 px) plus pink smart guides to other items' edges/centres and the page centre. Alt = free. Arrow keys nudge (Shift = 10 px).
- **Resize**: 8 handles on a single selection. Changing height turns `autoH` off.
- **Select**: click, Shift/Ctrl-click (click order is kept: the first picked is the "manager"), drag a marquee on the background (ordered top-to-bottom, so the topmost becomes the manager), Ctrl+A.
- **Join boxes** (connect mode): click manager then report; repeat; Esc to leave. Or select manager + team and press **Join: first selected → the others** (`linkSelected()`). **+ Add person below / beside** (`addChild`, `addSibling`) adds and joins in one go, copying the previous sibling's style.
- **Line editing**: click a line to select; drag a round end handle onto a box to attach or into empty space to leave it free; free lines drag as a whole.
- **Tidy up** (`tidy(branchRoot, quiet)`): lays joined boxes out as a tree (rows per depth, children ordered by current x, subtrees centred under parents). Whole chart from the rail; one branch from a box's inspector. Undoable.
- **Align / distribute / match size** for multi-selection; overlapping items are spread with a 24 px gap.
- **Styling**: `THEMES` quick colours (10 one-click looks), swatches + native colour picker, **Copy style / Paste style**, **Use for new boxes** (`prefs.boxDef`). Line style changes become the default for new lines (`prefs.connDef`).
- **Zoom / pan**: Ctrl/Cmd + wheel or pinch (zooms at the cursor), ± buttons, Fit. Space+drag or middle mouse pans.
- **Undo / redo**: snapshot history (`hist`, max 120) of `{name, page, items, conns}`; images live outside snapshots. `commit()` is called at the end of every action; live typing/dragging only commits on release/blur. Ctrl+Z/Y (native undo is left alone while typing in a field).
- **Shortcuts**: Ctrl+S save, Ctrl+P export PDF, Ctrl+C/V/D copy/paste/duplicate (copies lines between copied boxes), Delete, Enter, Esc.

## Saving, opening and versions
Chart file = `<chart name>.json` (`safeFile()` strips `\ / : * ? " < > |`).

```js
{ app: 'cs-org-chart', version: 1, name, savedAt: ISO string,
  page: { size: 'A4'|'A3'|'A2'|'Letter'|'custom', landscape, w, h, bg },   // w/h in px at 96 dpi
  items: [...], connectors: [...],
  assets: { <assetId>: 'data:image/...' } }                                // only assets still used
```

- **Save** (Ctrl+S): first time in Chrome/Edge a dialog asks for a folder (`showDirectoryPicker({id:'csOrgCharts', mode:'readwrite'})`), kept in IndexedDB (`csOrgChart` DB, key `dir`). After a browser restart the chip shows "click to allow access again" (permission re-prompt needs a click; Save does it itself). Save then writes `<name>.json` there, **overwriting** it silently if it is the file this chart came from (`currentFile`). If the name is different and a file of that name already exists, it asks before replacing.
- **Renaming the chart box and pressing Save** writes a new file and leaves the old one (non-destructive).
- **Save as…**: asks for a name (pre-filled with the next version: `Name v2`, `v3`… skipping names that exist) and writes a new file; option "Download a copy instead".
- **Open…**: lists every chart in the folder (reads each `.json`, keeps those with `app === 'cs-org-chart'`; other JSON is ignored), newest first, plus "Open a file…" (file picker) and "Change folder…". The chart name is taken from the file name, so renaming the file in Explorer renames the chart.
- **Draft** in `localStorage` key `csOrgChart.draft` (debounced after every change) restores the latest work if the tab closes before saving; shown with a toast when the draft was unsaved. This is a safety net only. `beforeunload` warns about unsaved changes.
- **Prefs** in `localStorage` key `csOrgChart.prefs`: grid/snap/gridSize, `boxDef`, `connDef`, inspector section open/closed state.
- **Loading is validated** (`normalise()`): unknown colours, ids, enums and numbers are replaced with safe defaults, image assets must be `data:image/`, text is only ever inserted with `textContent`/escaped. A damaged or hostile file cannot inject markup.

## PDF
**Export PDF** (or Ctrl+P) calls `preparePrint()`, which builds a static copy of the sheet in `#printRoot` and writes `@page { size: … ; margin: 0 }` (mm for A4/A3/A2/Letter so the paper is exact; px for custom pages), then `window.print()`. The user picks **Save as PDF**. `@media print` hides the whole app and shows only `#printRoot`. The PDF is exactly the page: items off the white sheet are left out; the grid, handles and guides never print. The print sheet is 2 px shorter than the page to avoid a blank second page. **Fit page to content** (page settings) shrink-wraps the sheet around the chart with a 40 px margin and switches to a custom size.

## Page settings (nothing selected)
Paper size (A4, A3, A2, US Letter, Custom), orientation, width/height in px, page colour, Fit page to content, show grid, snap to grid, grid size. Presets are stored as px (`mm * 96 / 25.4`); `doc.page.size === 'custom'` once width/height are edited by hand.

## Key state variables
`doc {name, page, items, conns}`, `assets` (id → data URL), `sel` (ordered item ids), `selConn`, `zoom`, `dirty`, `currentFile`, `dirHandle`, `folderState` (`none|ready|needs-permission|unsupported`), `editingId`, `connectMode`/`connectFrom`, `drag` (state machine: `move|resize|marquee|pan|ep|connmove`, handlers in `DRAGS`), `guides`, `marquee`, `hist`/`hidx`, `styleClip`, `clip`, `prefs`, `itemEls` (id → DOM element).

## Key functions
- Render: `syncItems()` (diffs DOM against `doc.items`), `applyItem(el, it, {fixedH})`, `renderConns()` / `connsMarkup(ui)`, `connGeom()`, `connPath()`, `elbowPts()`, `polyD()`, `renderOverlay()`, `applyPageView()`, `refreshAll()`.
- Actions: `addTool`, `addItem`, `addChild`, `addSibling`, `linkSelected`, `tidy`, `alignSel`, `distribute`, `matchSize`, `duplicate`, `fitPageToContent`, `applyProp(k, v, live)` (inspector → model; keys `pg.*` page, `pref.*` prefs, otherwise item or line).
- Files: `getDir`, `chooseFolder`, `saveChart(saveAs)`, `listCharts`, `openDialog`, `loadFromText`, `loadDoc`, `normalise`, `serializeDoc`, `newChart`, `writeDraft`.
- Print: `preparePrint`, `exportPDF`.
- Debug hook: `window.__orgChart` exposes `doc`, `sel`, `tidy`, `preparePrint` (used for browser tests; harmless).

## First run
With no draft, the tool opens a small sample "Staffing structure" chart (manager → deputy/admin → team leaders → support workers, laid out by `tidy()`), so the controls have something to act on. **New** gives a blank A4 page.

## Not included (by design, ask if wanted)
Staff photos inside boxes, automatic layout other than top-down trees, line labels, multi-page charts, a hosted/shared copy (it is a local file), PNG/SVG export.
