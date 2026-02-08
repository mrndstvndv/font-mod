import JSZip from "jszip";

// Utilities
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const escapeHtml = (value) =>
  value.replace(
    /[&<>"']/g,
    (match) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[match],
  );

// State
const state = {
  file: null,
  fileName: "",
  overrides: [
    "Roboto-Regular.ttf",
    "Roboto-Bold.ttf",
    "Roboto-Italic.ttf",
    "Roboto-BoldItalic.ttf",
    "Roboto-Medium.ttf",
    "Roboto-MediumItalic.ttf",
    "Roboto-Light.ttf",
    "Roboto-LightItalic.ttf",
    "Roboto-Thin.ttf",
    "Roboto-ThinItalic.ttf",
    "RobotoStatic-Regular.ttf",
    "Roboto-Variable.ttf",
  ],
};

let toastTimer = null;
let toastCleanupTimer = null;

// Elements
const els = {
  app: $("#app"),
  uploadZone: $("#upload-zone"),
  fileInput: $("#font-upload"),
  stepUpload: $("#step-upload"),
  stepConfig: $("#step-config"),
  selectedFilename: $("#selected-filename"),
  resetUploadBtn: $("#reset-upload"),

  modName: $("#mod-name"),
  modAuthor: $("#mod-author"),
  modId: $("#mod-id"),
  modVersion: $("#mod-version"),
  modDesc: $("#mod-desc"),

  overridesList: $("#overrides-list"),
  addOverrideBtn: $("#add-override-btn"),
  generateBtn: $("#generate-btn"),
  toast: $("#toast"),
  themeToggle: $("#theme-toggle"),
};

// Theme Logic
const setTheme = (theme, persist = true) => {
  document.documentElement.setAttribute("data-theme", theme);
  if (persist) localStorage.setItem("theme", theme);

  const moonIcon = els.themeToggle.querySelector(".moon-icon");
  const sunIcon = els.themeToggle.querySelector(".sun-icon");
  const isDark = theme === "dark";

  moonIcon.style.display = isDark ? "none" : "block";
  sunIcon.style.display = isDark ? "block" : "none";
};

// Initialization
const init = () => {
  const storedTheme = localStorage.getItem("theme");
  const initialTheme =
    storedTheme ||
    document.documentElement.getAttribute("data-theme") ||
    "light";
  setTheme(initialTheme, Boolean(storedTheme));

  els.modAuthor.value = localStorage.getItem("magisk-font-author") || "";
  const savedOverrides = JSON.parse(
    localStorage.getItem("magisk-font-overrides") || "null",
  );
  if (savedOverrides) state.overrides = savedOverrides;

  renderOverrides();
  setupEventListeners();
  switchStep("upload");
};

// Event Listeners
const setupEventListeners = () => {
  window.addEventListener("dragover", (event) => event.preventDefault());
  window.addEventListener("drop", (event) => event.preventDefault());

  els.uploadZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    event.stopPropagation();
    els.uploadZone.classList.add("drag-over");
  });

  els.uploadZone.addEventListener("dragleave", (event) => {
    event.preventDefault();
    event.stopPropagation();
    els.uploadZone.classList.remove("drag-over");
  });

  els.uploadZone.addEventListener("drop", (event) => {
    event.preventDefault();
    event.stopPropagation();
    els.uploadZone.classList.remove("drag-over");
    handleFile(event.dataTransfer.files[0]);
  });

  els.fileInput.addEventListener("change", (event) => {
    handleFile(event.target.files[0]);
  });

  els.resetUploadBtn.addEventListener("click", () => {
    state.file = null;
    els.fileInput.value = "";
    switchStep("upload");
  });

  els.addOverrideBtn.addEventListener("click", () => {
    state.overrides.unshift("");
    renderOverrides();
  });

  els.overridesList.addEventListener("input", (event) => {
    const input = event.target.closest("input[data-index]");
    if (!input) return;
    const index = Number(input.dataset.index);
    if (Number.isNaN(index)) return;
    state.overrides[index] = input.value;
  });

  els.overridesList.addEventListener("click", (event) => {
    const button = event.target.closest("button.remove-btn");
    if (!button) return;
    const index = Number(button.dataset.index);
    if (Number.isNaN(index)) return;
    state.overrides.splice(index, 1);
    renderOverrides();
  });

  els.generateBtn.addEventListener("click", generateModule);

  els.themeToggle.addEventListener("click", () => {
    const current =
      document.documentElement.getAttribute("data-theme") || "light";
    setTheme(current === "dark" ? "light" : "dark");
  });
};

// Logic
const handleFile = (file) => {
  if (!file) return;

  const ext = file.name.split(".").pop().toLowerCase();
  if (!["ttf", "otf", "ttc", "otc"].includes(ext)) {
    showToast(
      "Unsupported file format. Please use TTF, OTF, TTC, or OTC.",
      "error",
    );
    return;
  }

  state.file = file;
  state.fileName = file.name;

  const baseName = file.name.replace(/\.[^/.]+$/, "");
  els.selectedFilename.textContent = file.name;
  els.modName.value = formatName(baseName);
  els.modId.value = formatId(baseName);

  switchStep("config");
};

const switchStep = (step) => {
  const show = (el, display) => {
    el.classList.remove("active");
    el.style.display = display;
    requestAnimationFrame(() => el.classList.add("active"));
  };

  const hide = (el) => {
    el.classList.remove("active");
    el.style.display = "none";
  };

  if (step === "upload") {
    show(els.stepUpload, "flex");
    hide(els.stepConfig);
    return;
  }

  hide(els.stepUpload);
  show(els.stepConfig, "block");
};

const formatName = (str) =>
  str
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const formatId = (str) => str.toLowerCase().replace(/[^a-z0-9._-]/g, "_");

const renderOverrides = () => {
  els.overridesList.innerHTML = state.overrides
    .map(
      (override, index) => `
    <div class="override-item">
      <input type="text" data-index="${index}" value="${escapeHtml(override)}" placeholder="e.g. Roboto-Regular.ttf" />
      <button class="remove-btn" data-index="${index}" title="Remove">&times;</button>
    </div>
  `,
    )
    .join("");
};

const clearToastTimers = () => {
  if (toastTimer) clearTimeout(toastTimer);
  if (toastCleanupTimer) clearTimeout(toastCleanupTimer);
};

const showToast = (message, type = "success") => {
  clearToastTimers();

  els.toast.textContent = message;
  els.toast.className = `toast ${type}`;
  requestAnimationFrame(() => els.toast.classList.add("show"));

  toastTimer = setTimeout(() => {
    els.toast.classList.remove("show");
    toastCleanupTimer = setTimeout(() => {
      els.toast.className = "toast";
    }, 300);
  }, 2000);
};

const generateModule = async () => {
  if (!state.file) return;

  const modName = els.modName.value.trim() || "Custom Font";
  const modId = els.modId.value.trim() || "custom_font";
  const modAuthor = els.modAuthor.value.trim();
  const modVersion = els.modVersion.value.trim() || "v1.0";
  const modDesc = els.modDesc.value.trim() || "Custom font module";

  if (!modAuthor) {
    showToast("Please enter an author name before generating.", "error");
    return;
  }

  const cleanOverrides = state.overrides.map((s) => s.trim()).filter(Boolean);
  if (cleanOverrides.length === 0) {
    showToast("Please add at least one system font to replace.", "error");
    return;
  }

  els.generateBtn.disabled = true;
  els.generateBtn.textContent = "Generating...";

  try {
    const zip = new JSZip();

    zip.file(
      "module.prop",
      `id=${modId}
name=${modName}
version=${modVersion}
versionCode=1
author=${modAuthor}
description=${modDesc}`,
    );

    const fontsDir = zip.folder("system/fonts");
    const fontData = await state.file.arrayBuffer();

    cleanOverrides.forEach((filename) => {
      const finalName = filename.includes(".") ? filename : `${filename}.ttf`;
      fontsDir.file(finalName, fontData);
    });

    zip.file(
      "customize.sh",
      `ui_print "- Installing ${modName}..."
ui_print "- Overriding fonts..."

set_perm_recursive $MODPATH/system 0 0 0755 0644 u:object_r:system_file:s0
ui_print "- Done!"`,
    );

    zip.file(
      "post-fs-data.sh",
      `#!/system/bin/sh
MODDIR=\${0%/*}
find $MODDIR/system -name "*.ttf" -o -name "*.otf" | while read f; do
  t=$(echo "$f" | sed "s|$MODDIR||")
  [ -f "$t" ] && mount -o bind "$f" "$t"
done`,
    );

    localStorage.setItem("magisk-font-author", modAuthor);
    localStorage.setItem(
      "magisk-font-overrides",
      JSON.stringify(cleanOverrides),
    );

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${modId}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error(err);
    showToast("Failed to generate module.", "error");
  } finally {
    els.generateBtn.disabled = false;
    els.generateBtn.innerHTML = `<span>Generate Module</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
  }
};

// Start
init();
