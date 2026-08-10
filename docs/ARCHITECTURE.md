# Project Architecture

## Entry points

- `index.html`: application shell and markup.
- `src/main.js`: application bootstrap, state coordination, and event wiring.
- `assets/styles/main.css`: application presentation.

## Source modules

- `src/core/state.js`: state factories, normalization, document storage, and shared text helpers.
- `src/textile/generator.js`: Redmine Textile output generation and code-block normalization.
- `src/textile/preview.js`: Textile-to-HTML preview parsing and inline rendering.
- `src/ui/renderer.js`: editor controls and DOM rendering.
- `src/ui/mobile-header.js`: responsive header behavior.

## Design rule

Core state must not import UI modules. Textile modules may depend on core helpers. UI modules may depend on core and Textile modules. `main.js` composes the modules and owns application-level workflow.


## UI composition

`renderer.js` is a small facade. Feature modules own forms, sections, blocks, dialogs, output, notifications, and verification snippets independently.
