// Панель настроек "Color change": основная единица - сочетание (название + цвет текста +
// цвет фона). Есть 10 готовых сочетаний; свои сохраняются в localStorage.
// Карточка сочетания рисуется в его собственных цветах.

import {
  STORAGE_KEYS,
  buildHintText,
  composeView,
  readStorageJson,
  writeStorageJson
} from "../core.js";

export const PRESETS = [
  // Классические люминофоры старых мониторов (мягкие, не кислотные).
  { name: "White", text: "#ececec", background: "#0b0b0b" },
  { name: "Amber", text: "#ffb000", background: "#140d00" },
  { name: "Green", text: "#6fd36f", background: "#07130a" },
  { name: "Calm", text: "#f8f3c9", background: "#006a74" },
  { name: "Azure", text: "#f8f3f0", background: "#014baa" },
  { name: "Ice", text: "#a5e7ff", background: "#19152f" },
  { name: "Plum", text: "#fff4e8", background: "#391931" },
  { name: "Midnight", text: "#eebeda", background: "#282b4a" },
  { name: "Neon", text: "#ff3cac", background: "#32104f" },
  { name: "Pomegranate", text: "#f6ead0", background: "#80011f" },
  { name: "Berry", text: "#f3f3e7", background: "#890149" },
  { name: "Sunset", text: "#fdfdf1", background: "#ec5f29" },
  { name: "Pine", text: "#e0ffc2", background: "#064734" },
  { name: "Toxic", text: "#e5ff00", background: "#123b2a" },
  { name: "Dune", text: "#d9c7a0", background: "#2b2b2e" }
];

const CARD_W = 24;
const CARD_H = 4;
const GAP = 1;
const NAME_MAX = 12;
const MAX_CUSTOM = 30;
// Порог мягкий: допускаются довольно близкие цвета, но не сливающиеся полностью.
const MIN_CONTRAST = 1.25;
// Строки вне сетки: пустая, кнопки, пустая, сообщение.
const LIST_OVERHEAD = 4;
const WHEEL_STEP = 5;
const FIELD_LABELS = ["Name", "Text", "Background"];

export function createColorPanel() {
  return {
    id: "color",
    label: "Color change",
    big: false,
    createState,
    enter,
    render,
    onKeyDown,
    activate,
    onWheel,
    wantsText: (ps) => ps.mode === "edit"
  };
}

function createState() {
  return {
    mode: "list", // "list" | "edit"
    index: 0,
    scroll: 0,
    follow: true,
    grid: [], // ряды карточек (индексы) из последней отрисовки, для стрелок вверх/вниз
    custom: [],
    message: "",
    edit: null
  };
}

function enter(ps, ctx) {
  ps.custom = loadCustom();
  ps.mode = "list";
  ps.edit = null;
  ps.message = "";
  ps.follow = true;
  const active = allCombos(ps).findIndex((combo) => isActive(combo, ctx));
  ps.index = active >= 0 ? active : 0;
}

// ---------- data ----------
function allCombos(ps) {
  return [...PRESETS, ...ps.custom];
}

function loadCustom() {
  const saved = readStorageJson(STORAGE_KEYS.schemes);
  if (!Array.isArray(saved)) {
    return [];
  }

  return saved
    .filter((item) => item && typeof item.name === "string" && isHex(normalizeHex(item.text)) && isHex(normalizeHex(item.background)))
    .slice(0, MAX_CUSTOM)
    .map((item) => ({
      name: item.name.slice(0, NAME_MAX),
      text: normalizeHex(item.text),
      background: normalizeHex(item.background)
    }));
}

function saveCustom(ps) {
  writeStorageJson(STORAGE_KEYS.schemes, ps.custom);
}

function isActive(combo, ctx) {
  const colors = ctx.getConsoleColors();
  return normalizeHex(colors.text) === combo.text && normalizeHex(colors.background) === combo.background;
}

function applyCombo(ctx, combo) {
  ctx.applyConsoleColors(combo.text, combo.background);
  ctx.persistConsoleSettings();
}

// ---------- cards ----------
function cardLines(combo, active) {
  const inner = CARD_W - 2;
  const head = `─ ${combo.name.slice(0, NAME_MAX)} `;
  const tail = active ? " ■ ─" : "";
  const top = `┌${head}${"─".repeat(Math.max(0, inner - head.length - tail.length))}${tail}┐`;
  const text = ` Text: ${combo.text.toUpperCase()}`.padEnd(inner);
  const background = ` Background: ${combo.background.toUpperCase()}`.padEnd(inner);
  return [top, `│${text}│`, `│${background}│`, `└${"─".repeat(inner)}┘`];
}

function newCardLines() {
  const inner = CARD_W - 2;
  return [
    `┌${"─".repeat(inner)}┐`,
    `│${" + New combination".padEnd(inner)}│`,
    `│${"".padEnd(inner)}│`,
    `└${"─".repeat(inner)}┘`
  ];
}

function comboStyle(combo, inverted) {
  return inverted
    ? `color:${combo.background};background:${combo.text}`
    : `color:${combo.text};background:${combo.background}`;
}

// ---------- render ----------
function render(ps, ctx, view) {
  return ps.mode === "edit" ? renderEdit(ps, ctx, view) : renderList(ps, ctx, view);
}

function renderList(ps, ctx, view) {
  const combos = allCombos(ps);
  const count = combos.length + 1; // последняя карточка - "+ New combination"
  const cols = Math.max(1, Math.min(3, Math.floor((view.maxWidth + GAP) / (CARD_W + GAP))));
  const gridWidth = cols * CARD_W + (cols - 1) * GAP;
  ps.index = Math.min(ps.index, count - 1);

  const hot = view.hover && view.hover.kind === "card" ? view.hover.item : (view.kbd ? ps.index : -1);
  const sections = [
    { title: "Default", indices: PRESETS.map((preset, i) => i) },
    { title: "Custom", indices: Array.from({ length: count - PRESETS.length }, (item, i) => PRESETS.length + i) }
  ];

  const lines = [];
  const marks = [];
  const hits = [];
  const spans = new Map(); // индекс карточки -> строки, которые она занимает
  ps.grid = [];

  sections.forEach((section, sectionIndex) => {
    if (sectionIndex > 0) {
      lines.push("");
    }
    lines.push(`${section.title} ${"═".repeat(Math.max(0, gridWidth - section.title.length - 1))}`);

    for (let start = 0; start < section.indices.length; start += cols) {
      const cards = section.indices.slice(start, start + cols);
      ps.grid.push(cards);
      const cardRows = cards.map((i) => (i < combos.length ? cardLines(combos[i], isActive(combos[i], ctx)) : newCardLines()));
      const top = lines.length;
      for (let line = 0; line < CARD_H; line += 1) {
        const y = lines.length;
        lines.push(cardRows.map((rows) => rows[line]).join(" ".repeat(GAP)));
        cards.forEach((i, slot) => {
          const x = slot * (CARD_W + GAP);
          if (i < combos.length) {
            marks.push({ row: y, from: x, to: x + CARD_W, style: comboStyle(combos[i], i === hot) });
          } else if (i === hot) {
            marks.push({ row: y, from: x, to: x + CARD_W, cls: "hl" });
          }
          hits.push({ row: y, from: x, to: x + CARD_W, action: { kind: "card", item: i } });
        });
      }
      cards.forEach((i) => spans.set(i, { top, bottom: top + CARD_H - 1, first: start === 0 }));
      if (start + cols < section.indices.length) {
        lines.push("");
      }
    }
  });

  // Окно прокрутки по строкам.
  const fit = Math.max(CARD_H + 1, view.maxRows - LIST_OVERHEAD);
  const visible = Math.min(lines.length, fit);
  const maxScroll = lines.length - visible;
  const span = spans.get(ps.index);
  if (ps.follow && span) {
    const top = span.first ? span.top - 1 : span.top;
    if (top < ps.scroll) {
      ps.scroll = top;
    } else if (span.bottom >= ps.scroll + visible) {
      ps.scroll = span.bottom - visible + 1;
    }
  }
  ps.scroll = Math.min(Math.max(0, ps.scroll), maxScroll);

  const inWindow = (item) => item.row >= ps.scroll && item.row < ps.scroll + visible;
  const shift = (item) => ({ ...item, row: item.row - ps.scroll });
  const grid = {
    lines: lines.slice(ps.scroll, ps.scroll + visible),
    marks: marks.filter(inWindow).map(shift),
    hits: hits.filter(inWindow).map(shift)
  };

  const buttons = buttonRow([["new", "[N] New"], ["edit", "[E] Edit"], ["delete", "[DEL] Delete"]], view);
  const hintRow = ["ARROWS - Select", "LMB/ENTER - Apply"];
  if (maxScroll > 0) {
    hintRow.push("WHEEL - Scroll");
  }
  hintRow.push("ESC - Back");

  const result = composeView([
    grid,
    { lines: [""] },
    buttons,
    { lines: [""] },
    { lines: [ps.message || " "] }
  ]);
  result.hint = buildHintText([hintRow]);
  return result;
}

function renderEdit(ps, ctx, view) {
  const edit = ps.edit;
  const values = [edit.name, hexField(edit.text), hexField(edit.bg)];
  const labelWidth = 12;
  const rowWidth = labelWidth + 22;
  const lines = [];
  const marks = [];
  const hits = [];

  FIELD_LABELS.forEach((label, index) => {
    const value = values[index];
    const limit = index === 0 ? NAME_MAX : 7;
    const cursor = index === edit.field && (index === 0 ? value.length < limit : edit.cursorOpen(index)) ? "_" : "";
    lines.push(`${label.padEnd(labelWidth)}${value}${cursor}`.padEnd(rowWidth));
    hits.push({ row: index, from: 0, to: rowWidth, action: { kind: "field", item: index } });
    const hot = view.hover && view.hover.kind === "field" ? view.hover.item : edit.field;
    if (hot === index) {
      marks.push({ row: index, from: 0, to: rowWidth, cls: "hl" });
    }
  });

  const preview = previewCombo(edit, ctx);
  const card = {
    lines: cardLines({ ...preview, name: edit.name.trim() || "Preview" }, false),
    marks: [0, 1, 2, 3].map((row) => ({ row, from: 0, to: CARD_W, style: comboStyle(preview, false) }))
  };
  const buttons = buttonRow([["swipe", "[ Swipe ]"], ["save", "[ Save ]"], ["cancel", "[ Cancel ]"]], view);

  const result = composeView([
    { lines: [edit.id === null ? "New combination" : "Edit combination"] },
    { lines: [""] },
    { lines, marks, hits },
    { lines: [""] },
    card,
    { lines: [""] },
    buttons,
    { lines: [""] },
    { lines: [edit.error || " "] }
  ]);
  result.hint = buildHintText([["UP/DOWN - Field", "TYPE - Edit", "F2 - Swipe", "ENTER - Save", "ESC - Cancel"]]);
  return result;
}

function buttonRow(items, view) {
  let line = "";
  const marks = [];
  const hits = [];
  items.forEach(([id, label]) => {
    const from = line.length;
    line += label;
    hits.push({ row: 0, from, to: line.length, action: { kind: "button", id } });
    if (view.hover && view.hover.kind === "button" && view.hover.id === id) {
      marks.push({ row: 0, from, to: line.length, cls: "hl" });
    }
    line += "   ";
  });
  return { lines: [line.trimEnd()], marks, hits };
}

function hexField(digits) {
  return `#${digits.toUpperCase()}`;
}

// Цвета для карточки предпросмотра: некорректное поле берёт текущий цвет консоли.
function previewCombo(edit, ctx) {
  const colors = ctx.getConsoleColors();
  return {
    text: parseHex(edit.text) || normalizeHex(colors.text),
    background: parseHex(edit.bg) || normalizeHex(colors.background)
  };
}

// ---------- keyboard ----------
function onKeyDown(ps, ctx, event, api) {
  if (ps.mode === "edit") {
    handleEditKey(ps, ctx, event);
    return;
  }

  ps.message = "";
  const count = allCombos(ps).length + 1;
  const arrow = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) ? event.key : undefined;

  if (event.key === "Escape") {
    event.preventDefault();
    api.back();
  } else if (arrow !== undefined) {
    event.preventDefault();
    if (api.kbd) {
      ps.index = moveSelection(ps, arrow, count);
    }
    ps.follow = true;
  } else if (event.key === "Enter" && api.kbd) {
    event.preventDefault();
    activateCard(ps, ctx, ps.index);
  } else if (event.key === "Delete") {
    event.preventDefault();
    removeSelected(ps);
  } else if (!event.ctrlKey && !event.metaKey && !event.altKey) {
    if (event.code === "KeyN") {
      event.preventDefault();
      startNew(ps, ctx);
    } else if (event.code === "KeyE") {
      event.preventDefault();
      startEdit(ps, ctx);
    }
  }
}

// Влево/вправо - соседняя карточка по порядку, вверх/вниз - ряд выше или ниже в той же колонке.
function moveSelection(ps, key, count) {
  if (key === "ArrowLeft" || key === "ArrowRight") {
    return Math.min(count - 1, Math.max(0, ps.index + (key === "ArrowRight" ? 1 : -1)));
  }

  const row = ps.grid.findIndex((cards) => cards.includes(ps.index));
  if (row < 0) {
    return ps.index;
  }

  const col = ps.grid[row].indexOf(ps.index);
  const target = ps.grid[row + (key === "ArrowDown" ? 1 : -1)];
  return target ? target[Math.min(col, target.length - 1)] : ps.index;
}

function handleEditKey(ps, ctx, event) {
  const edit = ps.edit;
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    cancelEdit(ps);
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    save(ps, ctx);
    return;
  }

  if (event.key === "F2") {
    event.preventDefault();
    swipeColors(edit);
    return;
  }

  if (event.key === "ArrowUp" || event.key === "ArrowDown" || event.key === "Tab") {
    event.preventDefault();
    const dir = event.key === "ArrowUp" || (event.key === "Tab" && event.shiftKey) ? -1 : 1;
    edit.field = (edit.field + dir + FIELD_LABELS.length) % FIELD_LABELS.length;
    return;
  }

  if (event.key === "Backspace") {
    event.preventDefault();
    edit.error = "";
    edit.fresh = false;
    if (edit.field === 0) {
      edit.name = edit.name.slice(0, -1);
    } else {
      const key = edit.field === 1 ? "text" : "bg";
      edit[key] = edit[key].slice(0, -1);
    }
    return;
  }

  if (edit.field === 0) {
    const char = getNameChar(event);
    if (char) {
      event.preventDefault();
      edit.error = "";
      if (edit.fresh) {
        edit.name = "";
        edit.fresh = false;
      }
      if (edit.name.length < NAME_MAX) {
        edit.name += char;
      }
    }
    return;
  }

  const hexChar = getHexChar(event);
  if (hexChar) {
    event.preventDefault();
    edit.error = "";
    const key = edit.field === 1 ? "text" : "bg";
    if (edit[key].length < 6) {
      edit[key] += hexChar;
    }
  }
}

// ASCII-символ из события; в русской раскладке буква берётся по event.code.
function getNameChar(event) {
  if (event.key.length !== 1) {
    return null;
  }

  const code = event.key.codePointAt(0);
  if (code >= 32 && code <= 126) {
    return event.key;
  }

  const byCode = /^Key([A-Z])$/.exec(event.code || "");
  if (byCode) {
    return event.shiftKey ? byCode[1] : byCode[1].toLowerCase();
  }

  return null;
}

function getHexChar(event) {
  if (/^[0-9]$/.test(event.key)) {
    return event.key;
  }

  const byCode = /^Key([A-F])$/.exec(event.code || "");
  if (byCode) {
    return byCode[1].toLowerCase();
  }

  return /^[a-fA-F]$/.test(event.key) ? event.key.toLowerCase() : null;
}

// ---------- mouse ----------
function activate(ps, ctx, action) {
  if (ps.mode === "edit") {
    if (action.kind === "field") {
      ps.edit.field = action.item;
    } else if (action.kind === "button") {
      if (action.id === "swipe") {
        swipeColors(ps.edit);
      } else if (action.id === "save") {
        save(ps, ctx);
      } else {
        cancelEdit(ps);
      }
    }
    return;
  }

  ps.message = "";
  if (action.kind === "card") {
    activateCard(ps, ctx, action.item);
  } else if (action.kind === "button") {
    if (action.id === "new") {
      startNew(ps, ctx);
    } else if (action.id === "edit") {
      startEdit(ps, ctx);
    } else {
      removeSelected(ps);
    }
  }
}

function onWheel(ps, ctx, dir) {
  if (ps.mode === "list") {
    ps.follow = false;
    ps.scroll += dir * WHEEL_STEP;
  }
}

// ---------- actions ----------
function activateCard(ps, ctx, index) {
  const combos = allCombos(ps);
  ps.index = index;
  ps.follow = true;
  if (index >= combos.length) {
    startNew(ps, ctx);
    return;
  }

  applyCombo(ctx, combos[index]);
  ps.message = `Applied: ${combos[index].name}`;
}

function openEditor(ps, source, id, name) {
  ps.mode = "edit";
  ps.edit = {
    id,
    name,
    text: source.text.slice(1),
    bg: source.background.slice(1),
    field: 0,
    fresh: id === null,
    error: "",
    cursorOpen(index) {
      return (index === 1 ? this.text : this.bg).length < 6;
    }
  };
}

// Новое сочетание начинается с цветов выбранной карточки.
function startNew(ps, ctx) {
  const combos = allCombos(ps);
  if (ps.custom.length >= MAX_CUSTOM) {
    ps.message = "Too many combinations";
    return;
  }

  const source = combos[ps.index] || { text: normalizeHex(ctx.getConsoleColors().text), background: normalizeHex(ctx.getConsoleColors().background) };
  openEditor(ps, source, null, `Custom ${ps.custom.length + 1}`);
}

function startEdit(ps, ctx) {
  const combos = allCombos(ps);
  const combo = combos[ps.index];
  if (!combo) {
    startNew(ps, ctx);
    return;
  }

  if (ps.index < PRESETS.length) {
    // Готовые сочетания не меняются: правка открывает копию.
    if (ps.custom.length >= MAX_CUSTOM) {
      ps.message = "Too many combinations";
      return;
    }
    openEditor(ps, combo, null, `${combo.name} 2`.slice(0, NAME_MAX));
    return;
  }

  openEditor(ps, combo, ps.index - PRESETS.length, combo.name);
}

function removeSelected(ps) {
  const combos = allCombos(ps);
  if (ps.index >= combos.length) {
    return;
  }

  if (ps.index < PRESETS.length) {
    ps.message = "Ready-made combinations cannot be deleted";
    return;
  }

  const [removed] = ps.custom.splice(ps.index - PRESETS.length, 1);
  saveCustom(ps);
  ps.index = Math.min(ps.index, allCombos(ps).length);
  ps.message = `Deleted: ${removed.name}`;
}

// Swipe: цвет текста и цвет фона меняются местами.
function swipeColors(edit) {
  [edit.text, edit.bg] = [edit.bg, edit.text];
  edit.error = "";
}

function cancelEdit(ps) {
  ps.mode = "list";
  ps.edit = null;
  ps.message = "";
}

function save(ps, ctx) {
  const edit = ps.edit;
  const text = parseHex(edit.text);
  const background = parseHex(edit.bg);
  if (!text || !background) {
    edit.error = "HEX needs 3 or 6 digits";
    return;
  }

  if (contrastRatio(text, background) < MIN_CONTRAST) {
    edit.error = "Text and background are too close";
    return;
  }

  const combo = { name: edit.name.trim() || `Custom ${ps.custom.length + 1}`, text, background };
  if (edit.id === null) {
    ps.custom.push(combo);
    ps.index = PRESETS.length + ps.custom.length - 1;
  } else {
    ps.custom[edit.id] = combo;
    ps.index = PRESETS.length + edit.id;
  }

  saveCustom(ps);
  applyCombo(ctx, combo);
  ps.mode = "list";
  ps.edit = null;
  ps.follow = true;
  ps.message = `Saved: ${combo.name}`;
}

// ---------- color helpers ----------
function parseHex(digits) {
  if (/^[0-9a-f]{6}$/.test(digits)) {
    return `#${digits}`;
  }

  if (/^[0-9a-f]{3}$/.test(digits)) {
    return `#${digits[0]}${digits[0]}${digits[1]}${digits[1]}${digits[2]}${digits[2]}`;
  }

  return null;
}

function isHex(value) {
  return /^#[0-9a-f]{6}$/.test(value);
}

function normalizeHex(value) {
  const hex = String(value || "").trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(hex)) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  return hex;
}

// Защита от нечитаемой консоли: текст и фон не должны сливаться.
function contrastRatio(hexA, hexB) {
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function relativeLuminance(hex) {
  const channels = [1, 3, 5].map((offset) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
