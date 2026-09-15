# Project Architecture

## Entry points

- `index.html`: application shell and markup.
- `src/main.js`: application bootstrap, state coordination, and event wiring.
- `assets/styles/main.css`: application presentation.

## Source modules

The `src/` tree is organised in layers, from the most dependency-free to the most UI-coupled:

### `src/core/` — pure, browser-independent state layer (no DOM, no imports from UI)

- `src/core/state.js`: state factories and normalization.
- `src/core/model.js`: the state shape, presets, and model-level helpers.
- `src/core/storage.js`: document index / active-document / per-document `localStorage` persistence.
- `src/core/text.js`: small shared text helpers (`safe`, `toNonEmptyTrimmedLines`, `escapeHtml`).

### `src/textile/` — Redmine Textile output & preview (may depend on core)

- `src/textile/generator.js`: Redmine Textile output generation and code-block normalization.
- `src/textile/preview.js`: Textile-to-HTML preview parsing and inline rendering.
- `src/textile/preview-inline.js` / `preview-style.js`: inline/token rendering and CSS-style sanitization.

### `src/ui/` — DOM rendering and browser controls (may depend on core and Textile)

- `src/ui/editor/…`: editor controls and DOM rendering; `renderer.js` here is a small facade.
- `src/ui/dialogs/…`: block picker, new-doc dialog, image-replace picker.
- `src/ui/motion/…`: card slide / stage DOM animations (`card-slide.js`, `card-stage.js`, `timing.js`).
- `src/ui/io/…`: file download (`download.js`) and file/image read (`read.js`).
- `src/ui/formatting/…`: inline style / color / code context menus.
- `src/ui/output/…`: output view and Mermaid SVG-to-PNG export.
- `src/ui/shell/…`: header, notifications, and workspace resize behaviors.
- `src/ui/storage/document-storage.js`: localStorage document picker.
- `src/ui/theme/theme.js`: light / dark theme switch.
- `src/ui/dom/card.js`: card lookup/helpers.

### `src/app/` — application-level actions that wire multiple concerns together

- `src/app/file-actions.js`, `export-actions.js`, `import-actions.js`, `image-drop.js`.

## Design rule

Core modules (`src/core/`) must not import UI modules. Textile modules may depend on core helpers. UI modules may depend on core and Textile modules. `src/app/` coordinates concerns that span more than one area. `main.js` composes the modules and owns application-level workflow.

## UI composition

`src/ui/editor/renderer.js` is a small facade. Feature modules own forms, sections, blocks, dialogs, output, notifications, and verification snippets independently.
