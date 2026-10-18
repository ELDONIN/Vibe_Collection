import { centerText, textToHtml } from "../core.js";

// Полноэкранный просмотр одного арта. Открывается кликом по арту на вкладке ARTS.
// Сам арт рисуется крупно (32px, если помещается), а название, номер и подсказка
// остаются обычными 16px. Страница при этом всегда 16px: крупный шрифт только у блока арта.
// Управление: Esc - выйти, стрелки - листать. Больше ничего.

// Внизу сверху вниз: название, пустая строка, подсказка; ещё строка запаса.
const FOOTER_ROWS = 4;
const GAP_ROWS = 1;
const SIDE_MARGIN = 2;
const HINT = "ESC - Exit    ARROWS - Previous, next";
const ROW_PX = 16;

export function createArtViewProgram() {
  return {
    id: "artview",
    // Просмотр арта занимает весь экран, без панели вкладок.
    fullscreen: true,
    label: "Art",
    createState,
    enter,
    render,
    onKeyDown
  };
}

function createState() {
  return { arts: [], index: 0 };
}

function enter(programState, ctx, args = []) {
  const [arts, index] = args;
  if (!Array.isArray(arts) || !arts.length) {
    return;
  }

  programState.arts = arts;
  programState.index = Math.min(Math.max(0, index || 0), arts.length - 1);
  ctx.setActiveProgram("artview");
}

function div(style, html) {
  return `<div style="${style}">${html}</div>`;
}

function render(programState, ctx) {
  const art = programState.arts[programState.index];
  if (!art) {
    return { format: "text", content: "" };
  }

  const cols = ctx.viewportCols;
  const rows = ctx.viewportRows;

  // Арт вдвое крупнее, если помещается по ширине и высоте, иначе обычного размера.
  const availRows = Math.max(1, rows - FOOTER_ROWS - GAP_ROWS);
  const big = art.width * 2 + SIDE_MARGIN * 2 <= cols && art.height * 2 <= availRows;
  const scale = big ? 2 : 1;
  const artCols = art.width * scale;
  const artRows = art.height * scale;
  const top = Math.max(0, Math.floor((availRows - artRows) / 2));
  const left = Math.max(0, Math.floor((cols - artCols) / 2));

  const body = art.lines.map(textToHtml).join("\n");
  const artStyle = big
    ? `font-size:${ROW_PX * 2}px;line-height:${ROW_PX * 2}px;padding-left:${left / 2}ch;height:${artRows * ROW_PX}px`
    : `padding-left:${left}ch;height:${artRows * ROW_PX}px`;

  const footerTop = Math.max(0, rows - FOOTER_ROWS);
  const used = top + artRows;
  const footer = [art.caption, "", HINT].map((text) => div(`height:${ROW_PX}px`, textToHtml(centerText(text, cols))));

  const content = [
    div(`height:${top * ROW_PX}px`, ""),
    div(artStyle, body),
    div(`height:${Math.max(0, footerTop - used) * ROW_PX}px`, ""),
    ...footer
  ].join("");

  return { format: "html", content };
}

function onKeyDown(programState, ctx, event) {
  if (event.key === "Escape") {
    event.preventDefault();
    ctx.returnToMenu();
    return;
  }

  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    event.preventDefault();
    if (!event.repeat) {
      step(programState, ctx, 1);
    }
    return;
  }

  if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    event.preventDefault();
    if (!event.repeat) {
      step(programState, ctx, -1);
    }
  }
}

function step(programState, ctx, direction) {
  const count = programState.arts.length;
  programState.index = (programState.index + direction + count) % count;
}
