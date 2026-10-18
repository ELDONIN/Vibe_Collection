// Общие константы, работа с localStorage, текстовые утилиты и псевдографика окон.

// ---------- constants ----------
export const PALETTE = " .,-~:;*=#$@";
export const AUTO_RESUME_MS = 0;
export const UI_INSET_TOP = 1;
export const UI_INSET_LEFT = 2;
export const FONT_CHAR_WIDTH = 8;
export const FONT_CHAR_HEIGHT = 16;
export const FONT_SCALE_STEPS = [4, 3, 2, 1, 0.5];
// Шрифт сайта всегда 16px; арт на весь экран открывается на 32px.
export const BASE_FONT_SCALE = 1;
export const ART_FONT_SCALE = 2;
export const STORAGE_PREFIX = "ascii_os_";
export const STORAGE_KEYS = {
  console: "ascii_os_console_settings",
  figures: "ascii_os_figure_settings",
  gameoflife: "ascii_os_game_of_life_state",
  render3d: "ascii_os_render3d_state",
  snake: "ascii_os_snake_state",
  schemes: "ascii_os_color_schemes",
  ui: "ascii_os_ui_state"
};
export const NAMED_COLORS = {
  green: "#00ff00",
  blue: "#3a7bff",
  gray: "#9a9a9a",
  white: "#ffffff",
  black: "#000000",
  yellow: "#ffe066",
  red: "#ff4d4d",
  purple: "#b266ff",
  cyan: "#33e0ff",
  orange: "#ff9933"
};
export const NAMED_COLOR_ORDER = Object.keys(NAMED_COLORS);
export const DRAG_BUTTON = {
  ROTATE: 0,
  PAN_MIDDLE: 1,
  PAN_RIGHT: 2
};
export const DEFAULT_VIEW_STATE = {
  panX: 0,
  panY: 0,
  zoom: 6.5
};
export const DEFAULT_CONSOLE_COLORS = {
  // Calm
  text: "#f8f3c9",
  background: "#006a74"
};

// ---------- storage ----------
export function readStorageJson(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeStorageJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures and keep the app usable.
  }
}

export function removeStorageKey(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures.
  }
}

export function clearStoragePrefix(prefix) {
  try {
    const keys = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keys.push(key);
      }
    }
    keys.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Ignore storage failures.
  }
}

// ---------- text ----------
export function insetTextLines(lines, topInset = 0, leftInset = 0) {
  const insetLines = [];
  const leftPadding = " ".repeat(Math.max(0, leftInset));

  for (let i = 0; i < topInset; i += 1) {
    insetLines.push("");
  }

  lines.forEach((line) => {
    insetLines.push(`${leftPadding}${line}`);
  });

  return insetLines;
}

export function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

// Клетка терминала (col, row) под указателем.
// raw=true - абсолютная клетка экрана, иначе от левого края правой области при запущенной игре.
export function getTerminalCell(ctx, clientX, clientY, raw = false) {
  if (!ctx.measureSpan) {
    return null;
  }

  const rect = ctx.terminal.getBoundingClientRect();
  const style = getComputedStyle(ctx.terminal);
  const paddingX = parseFloat(style.paddingLeft) || 0;
  const paddingY = parseFloat(style.paddingTop) || 0;
  const charRect = ctx.measureSpan.getBoundingClientRect();
  const charWidth = Math.max(1, charRect.width);
  const charHeight = Math.max(1, charRect.height);
  return {
    col: Math.floor((clientX - rect.left - paddingX) / charWidth) - (raw ? 0 : (ctx.contentOffsetCols || 0)),
    row: Math.floor((clientY - rect.top - paddingY) / charHeight)
  };
}

// Клавиша окна настроек: S, в том числе в русской раскладке.
export function isSettingsKey(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return false;
  }
  return event.code === "KeyS"
    || event.key === "s"
    || event.key === "S"
    || event.key === "ы"
    || event.key === "Ы";
}

// ---------- window pseudographics ----------
// Общая псевдографика окон (символы CP437, есть в VGA-шрифте).

export const BOX_SINGLE = {
  tl: "┌", tr: "┐", bl: "└", br: "┘",
  h: "─", v: "│",
  lt: "├", rt: "┤", tt: "┬", bt: "┴", x: "┼"
};

export const BOX_DOUBLE = {
  tl: "╔", tr: "╗", bl: "╚", br: "╝",
  h: "═", v: "║",
  lt: "╠", rt: "╣", tt: "╦", bt: "╩", x: "╬"
};

export const SLIDER_FILL = "█";
export const SLIDER_EMPTY = "░";

// Верх/шапка/разделитель таблицы menuTable перед первым пунктом.
export const MENU_TABLE_ITEMS_OFFSET = 3;

export function centerPad(text, width) {
  if (text.length >= width) {
    return text;
  }
  const left = Math.floor((width - text.length) / 2);
  return `${" ".repeat(left)}${text}${" ".repeat(width - text.length - left)}`;
}

export function centerText(text, width) {
  if (text.length >= width) {
    return text;
  }
  return `${" ".repeat(Math.floor((width - text.length) / 2))}${text}`;
}

export function centerLines(lines, width) {
  return lines.map((line) => centerText(line, width));
}

// Двойная рамка с заголовком по центру. Полная ширина = innerWidth + 2.
export function titleBox(title, innerWidth = 36) {
  const b = BOX_DOUBLE;
  return [
    `${b.tl}${b.h.repeat(innerWidth)}${b.tr}`,
    `${b.v}${centerPad(title, innerWidth)}${b.v}`,
    `${b.bl}${b.h.repeat(innerWidth)}${b.br}`
  ];
}

// Одинарная таблица. widths - ширины колонок без отступов.
export function buildTable(widths, header, rows) {
  const b = BOX_SINGLE;
  const rule = (left, middle, right) =>
    left + widths.map((width) => b.h.repeat(width + 2)).join(middle) + right;
  const row = (cells) =>
    b.v + cells.map((cell, index) => ` ${String(cell ?? "").padEnd(widths[index]).slice(0, widths[index])} `).join(b.v) + b.v;

  const lines = [rule(b.tl, b.tt, b.tr)];
  if (header) {
    lines.push(row(header));
    lines.push(rule(b.lt, b.x, b.rt));
  }
  rows.forEach((cells) => lines.push(row(cells)));
  lines.push(rule(b.bl, b.bt, b.br));
  return lines;
}

// Таблица подсказок с единичной границей. Ячейка "КЛАВИША - пояснение":
// сначала клавиша, потом пояснение; клавиши в колонке выравниваются.
// Ячейка без " - " выводится как есть (например, очки).
export function buildHintTable(rows, options = {}) {
  const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const parsedRows = rows.map((row) => row.map(parseHintCell));
  const keyWidths = new Array(columnCount).fill(0);

  parsedRows.forEach((row) => {
    row.forEach((cell, index) => {
      if (cell.desc !== null) {
        keyWidths[index] = Math.max(keyWidths[index], cell.key.length);
      }
    });
  });

  const cellRows = parsedRows.map((row) => {
    const cells = [];
    for (let index = 0; index < columnCount; index += 1) {
      const cell = row[index];
      if (!cell) {
        cells.push("");
      } else if (cell.desc === null) {
        cells.push(cell.key);
      } else {
        cells.push(`${cell.key.padEnd(keyWidths[index])} - ${cell.desc}`);
      }
    }
    return cells;
  });

  const widths = new Array(columnCount).fill(0);
  cellRows.forEach((cells) => {
    cells.forEach((cell, index) => {
      widths[index] = Math.max(widths[index], cell.length);
    });
  });

  // options.width - общая ширина таблицы; лишнее место делится между колонками.
  if (options.width) {
    const total = widths.reduce((sum, width) => sum + width, 0) + columnCount * 3 + 1;
    const extra = options.width - total;
    if (extra > 0) {
      const each = Math.floor(extra / columnCount);
      for (let index = 0; index < columnCount; index += 1) {
        widths[index] += each;
      }
      widths[columnCount - 1] += extra - each * columnCount;
    }
  }

  return buildTable(widths, null, cellRows);
}

function parseHintCell(cell) {
  const at = cell.indexOf(" - ");
  if (at < 0) {
    return { key: cell, desc: null };
  }
  return { key: cell.slice(0, at), desc: cell.slice(at + 3) };
}

// Нумерованное меню: колонка "##" + колонка с названиями. Курсор - ">".
export function menuTable(header, labels, selectedIndex) {
  const rows = labels.map((label, index) => [
    String(index + 1).padStart(2, "0"),
    `${index === selectedIndex ? ">" : " "} ${label}`
  ]);
  return buildTable([2, 29], ["##", header], rows);
}

// Меню с группами на одном экране. Строки-заголовки групп не выбираются,
// нумерация пунктов сквозная. groups: [{ title, labels }].
export function groupedMenuTable(header, groups, selectedIndex) {
  const b = BOX_SINGLE;
  const widths = [2, 29];
  const rule = (left, middle, right) =>
    left + widths.map((width) => b.h.repeat(width + 2)).join(middle) + right;
  const row = (number, text) =>
    `${b.v} ${number.padEnd(widths[0])} ${b.v} ${text.padEnd(widths[1]).slice(0, widths[1])} ${b.v}`;

  const lines = [rule(b.tl, b.tt, b.tr), row("##", header), rule(b.lt, b.x, b.rt)];
  let index = 0;
  groups.forEach((group, groupIndex) => {
    if (groupIndex > 0) {
      lines.push(rule(b.lt, b.x, b.rt));
    }
    lines.push(row(BOX_DOUBLE.h.repeat(2), group.title));
    lines.push(rule(b.lt, b.x, b.rt));
    group.labels.forEach((label) => {
      lines.push(row(String(index + 1).padStart(2, "0"), `${index === selectedIndex ? ">" : " "} ${label}`));
      index += 1;
    });
  });
  lines.push(rule(b.bl, b.bt, b.br));
  return lines;
}

// Двойное окно с необязательным заголовком в верхней границе.
export function windowBox(title, content, options = {}) {
  const b = BOX_DOUBLE;
  const clipped = options.maxInner
    ? content.map((line) => line.slice(0, options.maxInner))
    : content;
  const head = title ? `${b.h} ${title} ` : "";
  const inner = Math.max(
    options.minInner || 0,
    head.length - 2,
    ...clipped.map((line) => line.length)
  );

  const lines = [`${b.tl}${head}${b.h.repeat(inner + 2 - head.length)}${b.tr}`];
  clipped.forEach((line) => {
    lines.push(`${b.v} ${line.padEnd(inner)} ${b.v}`);
  });
  lines.push(`${b.bl}${b.h.repeat(inner + 2)}${b.br}`);
  return lines;
}

// Двойная рамка игрового поля шириной cols: верх, низ и символ боковой стенки.
export function fieldBorder(cols) {
  const b = BOX_DOUBLE;
  return {
    top: `${b.tl}${b.h.repeat(cols)}${b.tr}`,
    bottom: `${b.bl}${b.h.repeat(cols)}${b.br}`,
    side: b.v
  };
}

// ---------- banners ----------
// Крупные заголовки (3 строки). Строки выравниваются до одной ширины.
function makeBanner(lines) {
  const width = Math.max(...lines.map((line) => line.length));
  return lines.map((line) => line.padEnd(width, " "));
}

export const BANNERS = {
  title: makeBanner([
    "█▀█ █▀▀ █▀▀ ▀█▀ ▀█▀   █▀▀ █▀█ █   █   █▀▀ █▀▀ ▀█▀ ▀█▀ █▀█ █▀█",
    "█▀█ ▀▀█ █    █   █    █   █ █ █   █   █▀▀ █    █   █  █ █ █ █",
    "▀ ▀ ▀▀▀ ▀▀▀ ▀▀▀ ▀▀▀   ▀▀▀ ▀▀▀ ▀▀▀ ▀▀▀ ▀▀▀ ▀▀▀  ▀  ▀▀▀ ▀▀▀ ▀ ▀"
  ]),
  arts: makeBanner([
    "█▀█ █▀▄ ▀█▀ █▀▀",
    "█▀█ █▀▄  █  ▀▀█",
    "▀ ▀ ▀ ▀  ▀  ▀▀▀"
  ]),
  render3d: makeBanner([
    "█▀▄ █▀▀ █▀█ █▀▄ █▀▀ █▀▄   ▀▀█ █▀▄",
    "█▀▄ █▀▀ █ █ █ █ █▀▀ █▀▄    ▀▄ █ █",
    "▀ ▀ ▀▀▀ ▀ ▀ ▀▀  ▀▀▀ ▀ ▀   ▀▀  ▀▀ "
  ]),
  gameoflife: makeBanner([
    "█▀▀ █▀█ █▄█ █▀▀   █▀█ █▀▀   █   ▀█▀ █▀▀ █▀▀",
    "█ █ █▀█ █ █ █▀▀   █ █ █▀▀   █    █  █▀▀ █▀▀",
    "▀▀▀ ▀ ▀ ▀ ▀ ▀▀▀   ▀▀▀ ▀     ▀▀▀ ▀▀▀ ▀   ▀▀▀"
  ]),
  snake: makeBanner([
    "█▀▀ █▀█ █▀█ █ █ █▀▀",
    "▀▀█ █ █ █▀█ █▀▄ █▀▀",
    "▀▀▀ ▀ ▀ ▀ ▀ ▀ ▀ ▀▀▀"
  ])
};

// ---------- tab banners ----------
// Буквы того же шрифта 3x3, из них собираются надписи вкладок.
const GLYPHS = {
  A: ["█▀█", "█▀█", "▀ ▀"],
  C: ["█▀▀", "█  ", "▀▀▀"],
  E: ["█▀▀", "█▀▀", "▀▀▀"],
  G: ["█▀▀", "█ █", "▀▀▀"],
  I: ["▀█▀", " █ ", "▀▀▀"],
  K: ["█ █", "█▀▄", "▀ ▀"],
  L: ["█  ", "█  ", "▀▀▀"],
  M: ["█▄█", "█ █", "▀ ▀"],
  N: ["█▀█", "█ █", "▀ ▀"],
  O: ["█▀█", "█ █", "▀▀▀"],
  R: ["█▀▄", "█▀▄", "▀ ▀"],
  S: ["█▀▀", "▀▀█", "▀▀▀"],
  T: ["▀█▀", " █ ", " ▀ "]
};

export function bannerFromWord(word) {
  return [0, 1, 2].map((row) => [...word].map((letter) => GLYPHS[letter][row]).join(" "));
}

Object.assign(BANNERS, {
  ascii: bannerFromWord("ASCII"),
  collection: bannerFromWord("COLLECTION"),
  arts: bannerFromWord("ARTS"),
  games: bannerFromWord("GAMES"),
  settings: bannerFromWord("SETTINGS"),
  links: bannerFromWord("LINKS")
});

// Пункт меню: заголовок, выбранный обводится рамкой. Высота всегда ITEM_HEIGHT,
// чтобы список не прыгал. minWidth выравнивает рамки разных пунктов по ширине.
export const ITEM_HEIGHT = 5;

export function bannerItem(banner, selected, minWidth = 0) {
  const width = Math.max(banner[0].length + 4, minWidth);
  const inner = banner.map((line) => line.padEnd(width - 4, " "));
  if (!selected) {
    const blank = " ".repeat(width);
    return [blank, ...inner.map((line) => `  ${line}  `), blank];
  }

  return [
    `█${"▀".repeat(width - 2)}█`,
    ...inner.map((line) => `█ ${line} █`),
    "▀".repeat(width)
  ];
}

// ---------- cell-exact html ----------
// Символы, которые есть в VGA-шрифте (кодовая страница 437). Любой другой символ
// (например ¦ — ‾ в артах) браузер рисует запасным шрифтом, а у него другая ширина
// знакоместа, поэтому строка получается чуть шире или уже и правая граница "уезжает"
// на долю символа. Такие символы оборачиваются в span.cw фиксированной ширины 1ch.
const CP437_HIGH = "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■\u00a0";
const VGA_SAFE = new Set(Array.from(CP437_HIGH));

export function cellHtml(char) {
  if (char === "&") {
    return "&amp;";
  }
  if (char === "<") {
    return "&lt;";
  }
  if (char === ">") {
    return "&gt;";
  }
  if (char.codePointAt(0) < 127 || VGA_SAFE.has(char)) {
    return char;
  }
  return `<span class="cw">${char}</span>`;
}

// chars - массив отдельных символов (по одному на знакоместо).
export function cellsToHtml(chars) {
  return chars.map(cellHtml).join("");
}

export function textToHtml(text) {
  return cellsToHtml(Array.from(text));
}

// ---------- char rows with marks ----------
// rows - массив массивов символов (по одному на знакоместо), marks - плоский список
// { row, from, to, cls?, style? }. Отмеченный участок оборачивается в span.
export function charRowsToHtml(rows, marks = []) {
  const byRow = new Map();
  marks.forEach((mark) => {
    if (!byRow.has(mark.row)) {
      byRow.set(mark.row, []);
    }
    byRow.get(mark.row).push(mark);
  });

  return rows.map((source, index) => {
    const rowMarks = byRow.get(index);
    if (!rowMarks) {
      return cellsToHtml(source);
    }

    const row = source.slice();
    rowMarks.forEach((mark) => {
      while (row.length < mark.to) {
        row.push(" ");
      }
    });

    let out = "";
    let pos = 0;
    [...rowMarks].sort((a, b) => a.from - b.from).forEach((mark) => {
      const from = Math.max(pos, Math.max(0, mark.from));
      const to = Math.min(mark.to, row.length);
      if (to <= from) {
        return;
      }
      const attrs = `${mark.cls ? ` class="${mark.cls}"` : ""}${mark.style ? ` style="${mark.style}"` : ""}`;
      out += `${cellsToHtml(row.slice(pos, from))}<span${attrs}>${cellsToHtml(row.slice(from, to))}</span>`;
      pos = to;
    });
    return out + cellsToHtml(row.slice(pos));
  }).join("\n");
}

export function rowsToHtml(lines, marks = []) {
  return charRowsToHtml(lines.map((line) => Array.from(line)), marks);
}

// ---------- hints and views ----------
// Подсказка без рамки: ячейки строки через 4 пробела.
export function buildHintText(rows, gap = 4) {
  return rows.map((row) => row.filter(Boolean).join(" ".repeat(gap)));
}

// Выбор стрелками: пока выбора нет (active=false), первое нажатие выбирает крайний пункт.
export function stepIndex(index, count, dir, active) {
  if (!active) {
    return dir > 0 ? 0 : count - 1;
  }
  return (index + dir + count) % count;
}

// Склеивает блоки { lines, marks?, hits?, left? } в один вид; блоки выравниваются
// по центру самого широкого. Отметки и зоны мыши смещаются вместе с блоком.
export function composeView(blocks) {
  const widthOf = (block) => Math.max(0, ...block.lines.map((line) => Array.from(line).length));
  const width = Math.max(0, ...blocks.map(widthOf));
  const lines = [];
  const marks = [];
  const hits = [];

  blocks.forEach((block) => {
    const dx = block.left ? 0 : Math.floor((width - widthOf(block)) / 2);
    const top = lines.length;
    block.lines.forEach((line) => lines.push(" ".repeat(dx) + line));
    (block.marks || []).forEach((mark) => marks.push({ ...mark, row: mark.row + top, from: mark.from + dx, to: mark.to + dx }));
    (block.hits || []).forEach((hit) => hits.push({ ...hit, row: hit.row + top, from: hit.from + dx, to: hit.to + dx }));
  });

  return { lines, marks, hits, width };
}
