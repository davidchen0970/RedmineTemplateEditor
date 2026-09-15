import {
  LEGACY_STORAGE_KEY,
  getActiveDocumentId,
  loadState,
  makeState,
  normalizeState,
  saveState,
} from "./core/state.js";
import { setupFileActions } from "./app/file-actions.js";
import { setupDocumentStorage } from "./ui/storage/document-storage.js";
import { createRenderer } from "./ui/editor/renderer.js";
import { setupTextColorContextMenu } from "./ui/formatting/text-color-menu.js";
import { setupImageDrop } from "./app/image-drop.js";
import { setupTextCodeContextMenu } from "./ui/formatting/text-code-menu.js";
import { setupTextBackgroundContextMenu } from "./ui/formatting/text-background-menu.js";
import { setupTheme } from "./ui/theme/theme.js";
import { setupWorkspaceResize } from "./ui/shell/workspace-resize.js";
import { setupImageReplacePicker } from "./ui/dialogs/image-replace-picker.js";

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
  [["raw", "raw"], ["previewbtn", "preview"], ["statebtn", "json"]].forEach(([elementId, nextView]) => {
    const button = document.getElementById(elementId);
    if (button) button.onclick = () => {
      view = nextView;
      renderer.renderOut();
    };
  });
}

function bindEditorActions() {
  document.addEventListener("click", (event) => {
    const moreToggle = event.target.closest("[data-more-toggle]");
    if (moreToggle) {
      const box = moreToggle.closest("[data-more]");
      const all = [...document.querySelectorAll("[data-more] .more-items")];
      all.forEach((menu) => { if (menu !== box.querySelector(".more-items")) menu.hidden = true; });
      const menu = box.querySelector(".more-items");
      if (menu) menu.hidden = !menu.hidden;
      return;
    }
    document.querySelectorAll("[data-more] .more-items").forEach((menu) => { menu.hidden = true; });
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
  setDocument: (documentId, nextState, message) => {
    activeDocumentId = documentId;
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
setupTheme(LEGACY_STORAGE_KEY + ":theme");
setupWorkspaceResize(LEGACY_STORAGE_KEY + ":workspaceLayout");
setupTextColorContextMenu();
setupTextBackgroundContextMenu();
setupTextCodeContextMenu();
setupImageDrop();
setupImageReplacePicker(() => renderer.renderOut());
save();
renderer.render();
