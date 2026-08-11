import {
  KEY,
  getActiveDocumentId,
  loadState,
  makeState,
  normalizeState,
  saveState,
} from "./core/state.js";
import { setupFileActions } from "./app/file-actions.js";
import { setupDocumentStorage } from "./ui/document-storage.js";
import { createRenderer } from "./ui/renderer.js";
import { setupTextColorContextMenu } from "./ui/text-color-menu.js";
import { setupTheme } from "./ui/theme.js";
import { setupWorkspaceResize } from "./ui/workspace-resize.js";

let activeDocumentId = getActiveDocumentId();
let state = normalizeState(loadState(activeDocumentId)) || makeState();
let view = "raw";
let exportStatus = { json: false, txt: false };
let lastSaveText = "";
let renderDocumentPicker = () => {};

function save() {
  saveState(state, activeDocumentId);
  lastSaveText = "已自動儲存 " + new Date().toLocaleTimeString();
  renderer.renderSaveStatus();
  renderDocumentPicker();
}

function changed() {
  exportStatus = { json: false, txt: false };
  save();
  renderer.renderOut();
}

const renderer = createRenderer({
  getState: () => state,
  getView: () => view,
  getExportStatus: () => exportStatus,
  getLastSaveText: () => lastSaveText,
  changed,
  onPresetClick: (type) => {
    if (!confirm("切換模板會取代目前表單，確定？")) return;
    state = makeState(type);
    changed();
    renderer.render();
  },
});

function bindViewButtons() {
  [["raw", "raw"], ["previewbtn", "preview"], ["statebtn", "json"]].forEach(([id, nextView]) => {
    const button = document.getElementById(id);
    if (button) button.onclick = () => {
      view = nextView;
      renderer.renderOut();
    };
  });
}

function bindEditorActions() {
  document.getElementById("addSection").onclick = () => renderer.addSection();
  document.querySelectorAll("[data-snip]").forEach((button) => {
    button.onclick = () => renderer.addVerificationSnippet(button.dataset.snip);
  });
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-collapse-target]");
    if (!button) return;
    const target = document.getElementById(button.dataset.collapseTarget);
    if (!target) return;
    const collapsed = button.getAttribute("aria-expanded") !== "false";
    button.setAttribute("aria-expanded", String(!collapsed));
    target.classList.toggle("collapsed", collapsed);
    const { collapseScope: scope, collapseKey: key } = button.dataset;
    if (scope && key) {
      state.ui ||= {};
      state.ui.collapsed ||= {};
      state.ui.collapsed[scope] ||= {};
      state.ui.collapsed[scope][key] = collapsed;
      changed();
    }
  });
  document.getElementById("source_code").onclick = () => {
    window.open("https://github.com/davidchen0970/RedmineTemplateEditor", "_blank", "noopener");
  };
}

renderDocumentPicker = setupDocumentStorage({
  getState: () => state,
  getActiveId: () => activeDocumentId,
  setDocument: (id, nextState, message) => {
    activeDocumentId = id;
    state = nextState;
    exportStatus = { json: false, txt: false };
    lastSaveText = message;
  },
  renderer,
});

setupFileActions({
  getState: () => state,
  setState: (nextState) => { state = nextState; },
  getActiveId: () => activeDocumentId,
  changed,
  renderer,
  setExportStatus: (type) => {
    exportStatus[type] = true;
    renderer.renderSaveStatus();
  },
});

bindViewButtons();
bindEditorActions();
setupTheme(KEY + ":theme");
setupWorkspaceResize(KEY + ":workspaceLayout");
setupTextColorContextMenu();
save();
renderer.render();
