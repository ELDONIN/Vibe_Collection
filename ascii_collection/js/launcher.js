// Главная страница: слева панель вкладок (ARTS, GAMES, SETTINGS, LINKS), справа от
// двойного разделителя - содержимое выбранной вкладки.
//
// Вкладки переключаются только мышью. Содержимое вкладки управляется и мышью, и клавиатурой
// (стрелки, Enter). Содержимое выровнено по центру области, подсказка стоит у нижнего края.
// Games, Links и часть Settings рисуются крупно (32px) отдельным слоем поверх клеток 16px:
// одна крупная клетка занимает 2x2 обычных. Игры открываются в правой области, пока панель
// вкладок остаётся на экране (renderSidebar, hitSidebar).

import {
  BANNERS,
  BOX_DOUBLE,
  BOX_SINGLE,
  ITEM_HEIGHT,
  bannerItem,
  buildHintText,
  buildTable,
  charRowsToHtml,
  getTerminalCell
} from "./core.js";
import {
  ART_FILES,
  ARTS_DIR,
  LINKS_FILE,
  ensureArts,
  ensureLinks,
  reloadArts,
  reloadLinks,
  textLength
} from "./data.js";

const TABS = [
  { id: "arts", label: "Arts" },
  { id: "games", label: "Games" },
  { id: "settings", label: "Settings" },
  { id: "links", label: "Links" }
];
const TAB_ARTS = 0;
const TAB_GAMES = 1;
const TAB_SETTINGS = 2;
const TAB_LINKS = 3;
// Порядок игр на вкладке GAMES.
const GAME_IDS = ["render3d", "gameoflife", "snake"];

// Название сайта крупными буквами: ASCII и Collection.
const TITLE_LINES = [...BANNERS.ascii, ...BANNERS.collection];
const TITLE_WIDTH = Math.max(...TITLE_LINES.map((line) => line.length));
// Справа от названия два пустых символа до разделителя, снизу пустая строка до линии.
const SIDEBAR_WIDTH = TITLE_WIDTH + 5;
const ITEM_WIDTH = SIDEBAR_WIDTH - 2;
const DIVIDER_COL = SIDEBAR_WIDTH;
const CONTENT_X = SIDEBAR_WIDTH + 2;
// Пункты меню выравниваются по центру по высоте под заголовком.
const BIG_SCALE = 2;
const CONTENT_TOP = 1;
// Над названием две пустые строки.
const TITLE_ROW = 2;
// Заголовок выровнен по тексту пунктов (рамка пункта начинается в колонке 1).
const TITLE_X = 3;
const SEPARATOR_ROW = TITLE_ROW + TITLE_LINES.length + 1;
const ITEMS_TOP = SEPARATOR_ROW + 1;
// Подсказка занимает одну строку у нижнего края, под ней пустая строка.
const FOOTER_ROWS = 2;
const SCROLL_STEP = 3;

export const CONTENT_COLS = CONTENT_X;

export function createLauncher() {
  const state = {
    tab: null, // null - ничего не выбрано, показывается "Click on the menu item"
    arts: { scroll: 0, active: -1, layout: null, viewHeight: 0 },
    // hover - пункт под мышью, kbd - выбор стрелками (подсвечивается, пока мышь не сдвинули)
    games: { index: 0, hover: -1, kbd: false },
    links: { index: 0, hover: -1, kbd: false },
    hits: null,
    itemsTop: ITEMS_TOP,
    hint: [],
    ctx: null,
    settings: null
  };

  // ---------- persistence ----------
  function serialize() {
    return { tab: state.tab };
  }

  function restore(saved) {
    const tab = saved && typeof saved.tab === "number" ? Math.floor(saved.tab) : null;
    state.tab = tab !== null && tab >= 0 && tab < TABS.length ? tab : null;
  }

  function reset() {
    restore(null);
    state.arts.scroll = 0;
    state.arts.active = -1;
  }

  function selectTab(ctx, index) {
    state.tab = index;
    state.games.hover = -1;
    state.games.kbd = false;
    state.links.hover = -1;
    state.links.kbd = false;
    state.arts.active = -1;
    if (state.settings) {
      state.settings.close();
    }
    ctx.persistUiState();
  }

  // ---------- render ----------
  function isBigTab(settings) {
    return state.tab === TAB_GAMES
      || (state.tab === TAB_SETTINGS && settings.isBig());
  }

  function render(ctx, settings) {
    state.ctx = ctx;
    state.settings = settings;
    const cols = ctx.viewportCols;
    const rows = ctx.viewportRows;
    const canvas = createCanvas(cols, rows);
    const marks = [];
    const footerY = rows - FOOTER_ROWS;
    const area = {
      x: CONTENT_X,
      y: CONTENT_TOP,
      width: Math.max(10, cols - CONTENT_X - 2),
      footerY,
      height: Math.max(3, footerY - 1 - CONTENT_TOP)
    };

    // Крупный слой: своя сетка, каждая клетка вдвое больше.
    const big = isBigTab(settings);
    let layer = null;
    let target = { canvas, marks, area };
    if (big) {
      const bigCols = Math.max(10, Math.floor((cols - CONTENT_X - 2) / BIG_SCALE));
      // Крупный слой занимает область над подсказкой; подсказка всегда рисуется обычным шрифтом.
      const bigRows = Math.max(4, Math.floor((area.height + 1) / BIG_SCALE));
      layer = { canvas: createCanvas(bigCols, bigRows), marks: [] };
      target = {
        canvas: layer.canvas,
        marks: layer.marks,
        area: { x: 0, y: 0, width: bigCols, footerY: bigRows, height: bigRows }
      };
    }
    state.hits = { area: target.area, big };
    state.hint = [];

    drawSidebar(canvas, rows);
    drawDivider(canvas);

    switch (state.tab) {
      case TAB_ARTS:
        drawArts(canvas, marks, area);
        break;
      case TAB_GAMES:
        drawGames(target.canvas, target.marks, target.area);
        break;
      case TAB_SETTINGS:
        drawSettings(target.canvas, target.marks, target.area, ctx, settings);
        break;
      case TAB_LINKS:
        drawLinks(target.canvas, target.marks, target.area);
        break;
      default:
        drawCentered(canvas, area, ["Click on the menu item"], true);
    }

    state.hint.forEach((line, row) => {
      drawText(canvas, centerX(area, line.length), area.footerY + row, line, area.width);
    });

    let html = charRowsToHtml(canvas, marks);
    if (layer) {
      html += `<div class="biglayer" style="left:${CONTENT_X}ch;top:${CONTENT_TOP * 16}px"><div class="big">${charRowsToHtml(layer.canvas, layer.marks)}</div></div>`;
    }
    return html;
  }

  // Панель вкладок отдельно: рисуется слева от запущенной игры.
  function renderSidebar(ctx) {
    state.ctx = ctx;
    const rows = ctx.viewportRows;
    const canvas = createCanvas(CONTENT_X, rows);
    drawSidebar(canvas, rows);
    drawDivider(canvas);
    return charRowsToHtml(canvas, []).split("\n");
  }

  // Номер вкладки под курсором (для клика по панели во время игры) или -1.
  function hitSidebar(ctx, event) {
    const cell = getTerminalCell(ctx, event.clientX, event.clientY, true);
    const hit = cell ? hitTest(cell) : null;
    return hit && hit.kind === "tab" ? hit.index : -1;
  }

  function openTab(ctx, index) {
    selectTab(ctx, index);
  }

  function drawSidebar(canvas, rows) {
    TITLE_LINES.forEach((line, row) => drawText(canvas, TITLE_X, TITLE_ROW + row, line));
    drawText(canvas, 0, SEPARATOR_ROW, BOX_DOUBLE.h.repeat(SIDEBAR_WIDTH));

    // Пункты по центру высоты экрана (но не выше разделителя).
    const top = Math.max(ITEMS_TOP, Math.floor((rows - TABS.length * ITEM_HEIGHT) / 2));
    state.itemsTop = top;
    TABS.forEach((tab, index) => {
      const item = bannerItem(BANNERS[tab.id], index === state.tab, ITEM_WIDTH);
      item.forEach((line, row) => {
        drawText(canvas, 1, top + index * ITEM_HEIGHT + row, line);
      });
    });
  }

  function drawDivider(canvas) {
    for (let row = 0; row < canvas.length; row += 1) {
      drawText(canvas, DIVIDER_COL, row, row === SEPARATOR_ROW ? BOX_DOUBLE.rt : BOX_DOUBLE.v);
    }
  }

  // ----- ARTS -----
  function drawArts(canvas, marks, area) {
    const resource = ensureArts();
    if (resource.status !== "ready") {
      drawResourceStatus(canvas, area, resource, [`${ARTS_DIR}${ART_FILES[0]}`, `${ARTS_DIR}${ART_FILES[1]}`], "arts");
      return;
    }

    const arts = resource.items;
    const layout = getArtLayout(arts, area.width);
    const maxScroll = Math.max(0, layout.total - area.height);
    const view = state.arts;
    view.scroll = Math.min(Math.max(0, view.scroll), maxScroll);
    view.viewHeight = area.height;

    layout.boxes.forEach((box) => {
      const top = area.y + box.y - view.scroll;
      if (top + box.h <= area.y || top >= area.y + area.height) {
        return;
      }

      const art = arts[box.index];
      const hot = box.index === view.active;
      buildArtBox(art, box.w, hot).forEach((line, row) => {
        const y = top + row;
        if (y < area.y || y >= area.y + area.height) {
          return;
        }
        drawText(canvas, area.x + box.x, y, line, area.width - box.x);
        // Наведённый арт: плашка названия закрашена, верхняя и нижняя линии плашки - половинки
        // клеток. Всё рисуется фоном, а не символами шрифта, поэтому края ровные.
        if (hot && art.caption && row <= 2) {
          const left = area.x + box.x;
          const to = Math.min(area.x + area.width, left + box.w);
          const cells = canvas[y];
          if (row !== 1) {
            for (let x = left; x < to; x += 1) {
              cells[x] = " ";
            }
          } else {
            cells[left] = " ";
            cells[to - 1] = " ";
          }
          marks.push({ row: y, from: left, to, style: barStyle(row) });
        }
      });
    });

    drawScrollbar(canvas, area, layout.total, view.scroll);
    drawFooter(canvas, area, [["LMB - Open art", "WHEEL - Scroll", "ARROWS - Select", "ENTER - Open"]]);
    state.hits.arts = { area, boxes: layout.boxes, scroll: view.scroll };
  }

  // Арты раскладываются как стикеры: каждый занимает самое верхнее и левое свободное
  // место, где помещается, поэтому маленькие арты заполняют пустоты рядом с большими.
  function getArtLayout(arts, width) {
    const key = `${arts.length}:${width}`;
    if (state.arts.layout && state.arts.layout.key === key) {
      return state.arts.layout;
    }

    const occupied = []; // occupied[y][x] - клетка занята (с зазором в один символ)
    const isFree = (x, y, w, h) => {
      for (let row = y; row < y + h; row += 1) {
        const line = occupied[row];
        if (line) {
          for (let col = x; col < x + w; col += 1) {
            if (line[col]) {
              return false;
            }
          }
        }
      }
      return true;
    };
    const occupy = (x, y, w, h) => {
      for (let row = y; row < y + h + 1; row += 1) {
        occupied[row] = occupied[row] || [];
        for (let col = x; col < x + w + 1; col += 1) {
          occupied[row][col] = true;
        }
      }
    };

    const boxes = [];
    let total = 0;
    arts.forEach((art, index) => {
      const w = Math.max(art.width, textLength(art.caption)) + 4;
      const h = art.height + 2 + (art.caption ? 2 : 0);
      const limit = Math.max(width, w);
      let spot = null;
      for (let y = 0; spot === null; y += 1) {
        for (let x = 0; x + w <= limit; x += 1) {
          if (isFree(x, y, w, h)) {
            spot = { x, y };
            break;
          }
        }
      }
      occupy(spot.x, spot.y, w, h);
      boxes.push({ index, x: spot.x, y: spot.y, w, h });
      total = Math.max(total, spot.y + h);
    });

    // Вся россыпь выравнивается по центру области.
    const right = Math.max(0, ...boxes.map((box) => box.x + box.w));
    const shift = Math.max(0, Math.floor((width - right) / 2));
    boxes.forEach((box) => {
      box.x += shift;
    });

    state.arts.layout = { key, boxes, total };
    return state.arts.layout;
  }

  // Арт в одинарной таблице, название (если есть) сверху отдельной строкой.
  // Наведённый арт: верхняя линия над названием из ▄, линия под названием из ▀.
  function buildArtBox(art, width, hot) {
    const b = BOX_SINGLE;
    const row = (text) => `${b.v} ${padText(text, width - 4)} ${b.v}`;
    // Наведённая строка названия: по бокам заполненные ▐ и ▌ вместо вертикальных линий.
    const captionRow = (text) => (hot ? `▐ ${padText(text, width - 4)} ▌` : row(text));
    const rule = (left, fill, right) => `${left}${fill.repeat(width - 2)}${right}`;
    const lines = [rule(b.tl, hot ? "▄" : b.h, b.tr)];
    if (art.caption) {
      lines.push(captionRow(art.caption));
      lines.push(rule(b.lt, hot ? "▀" : b.h, b.rt));
    }
    art.lines.forEach((line) => lines.push(row(line)));
    lines.push(rule(b.bl, b.h, b.br));
    return lines;
  }

  function drawScrollbar(canvas, area, total, scroll) {
    if (total <= area.height) {
      return;
    }

    const x = canvas[0].length - 1;
    const thumb = Math.max(1, Math.round((area.height * area.height) / total));
    const travel = area.height - thumb;
    const start = Math.round((scroll / (total - area.height)) * travel);
    for (let row = 0; row < area.height; row += 1) {
      drawText(canvas, x, area.y + row, row >= start && row < start + thumb ? "█" : "░");
    }
  }

  // ----- GAMES -----
  function drawGames(canvas, marks, area) {
    const programs = gamePrograms(state.ctx);
    const labels = programs.map((program) => program.label);
    const table = buildTable([Math.max(14, ...labels.map((label) => label.length))], ["Game"], labels.map((label) => [label]));
    const x = centerX(area, table[0].length);
    const y = centerY(area, table.length);
    table.forEach((line, row) => drawText(canvas, x, y + row, line, area.width));

    const highlighted = state.games.hover >= 0
      ? state.games.hover
      : (state.games.kbd ? state.games.index : -1);
    if (highlighted >= 0) {
      addMark(marks, y + 3 + highlighted, x + 1, x + table[0].length - 1, "hl");
    }

    drawFooter(canvas, area, [["UP/DOWN - Select", "LMB/ENTER - Open"]]);
    state.hits.games = { x, y: y + 3, width: table[0].length, count: programs.length };
  }

  function gamePrograms(ctx) {
    return GAME_IDS.map((id) => ctx.programs.find((program) => program.id === id)).filter(Boolean);
  }

  // ----- SETTINGS -----
  function drawSettings(canvas, marks, area, ctx, settings) {
    const view = settings.renderInline(ctx, {
      maxRows: area.height,
      maxWidth: area.width
    });
    const x = centerX(area, view.width);
    const y = centerY(area, view.lines.length);
    settings.setOrigin(y, x);
    view.lines.forEach((line, row) => drawText(canvas, x, y + row, line, area.width));
    view.marks.forEach((mark) => {
      marks.push({ ...mark, row: mark.row + y, from: mark.from + x, to: mark.to + x });
    });
    drawHint(canvas, area, view.hint);
  }

  // ----- LINKS -----
  function drawLinks(canvas, marks, area) {
    const resource = ensureLinks();
    if (resource.status !== "ready") {
      drawResourceStatus(canvas, area, resource, [LINKS_FILE], "links");
      return;
    }

    if (!resource.items.length) {
      drawCentered(canvas, area, [`No links yet. Add lines "Name | https://address" to ${LINKS_FILE}.`]);
      return;
    }

    const links = resource.items;
    const nameWidth = Math.min(24, Math.max(11, ...links.map((link) => textLength(link.name))));
    const urlWidth = Math.max(8, Math.min(Math.max(...links.map((link) => textLength(link.url))), area.width - nameWidth - 7));
    const table = buildTable([nameWidth, urlWidth], ["Description", "Link"], links.map((link) => [link.name, link.url]));
    const x = centerX(area, table[0].length);
    const y = centerY(area, table.length);
    table.forEach((line, row) => drawText(canvas, x, y + row, line, area.width));

    const highlighted = state.links.hover >= 0
      ? state.links.hover
      : (state.links.kbd ? state.links.index : -1);
    if (highlighted >= 0) {
      addMark(marks, y + 3 + highlighted, x + 1, x + table[0].length - 1, "hl");
    }

    drawFooter(canvas, area, [["UP/DOWN - Select", "LMB/ENTER - Open"]]);
    state.hits.links = { x, y: y + 3, count: links.length, width: table[0].length };
  }

  // Заглушка, пока ресурс грузится или не загрузился.
  function drawResourceStatus(canvas, area, resource, files, kind) {
    if (resource.status === "error") {
      const lines = [
        `Cannot load ${files.join(", ")}`,
        `(${resource.error})`,
        "Open the site through a static server, not from a file.",
        "",
        "Click or press ENTER to try again."
      ];
      drawCentered(canvas, area, lines);
      state.hits.retry = kind;
      return;
    }

    drawCentered(canvas, area, ["Loading..."]);
  }

  // Блок строк по центру области по горизонтали (и по вертикали при middle).
  function drawCentered(canvas, area, lines, middle = false, vertical = false) {
    const width = Math.max(...lines.map((line) => textLength(line)));
    const x = centerX(area, width);
    const y = middle || vertical ? centerY(area, lines.length) : area.y;
    lines.forEach((line, row) => drawText(canvas, x, y + row, line, area.width));
  }

  function centerX(area, width) {
    return area.x + Math.max(0, Math.floor((area.width - width) / 2));
  }

  function centerY(area, height) {
    return area.y + Math.max(0, Math.floor((area.height - height) / 2));
  }

  // Подсказка без рамки по центру области у нижнего края.
  function drawFooter(canvas, area, rows) {
    drawHint(canvas, area, buildHintText(rows));
  }

  // Подсказка запоминается и рисуется в конце обычным шрифтом (16px), даже если вкладка крупная.
  function drawHint(canvas, area, lines) {
    state.hint = lines;
  }

  // ---------- keyboard ----------
  function onKeyDown(ctx, event, settings) {
    state.ctx = ctx;
    if (state.tab === null) {
      return;
    }

    if (state.tab === TAB_SETTINGS) {
      settings.onKeyDown(ctx, event);
      return;
    }

    if (state.hits && state.hits.retry && event.key === "Enter") {
      event.preventDefault();
      retry(state.hits.retry);
      return;
    }

    if (state.tab === TAB_ARTS) {
      handleArtsKey(ctx, event);
    } else if (state.tab === TAB_GAMES) {
      handleListKey(event, state.games, gamePrograms(ctx).length, (index) => startGame(ctx, index));
    } else if (state.tab === TAB_LINKS) {
      handleListKey(event, state.links, ensureLinks().items.length, (index) => openLink(index));
    }
  }

  // Стрелки подсвечивают пункт, Enter запускает подсвеченный.
  function handleListKey(event, list, count, activate) {
    if (!count) {
      return;
    }

    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const down = event.key === "ArrowDown";
      list.hover = -1;
      if (!list.kbd) {
        list.kbd = true;
        list.index = down ? 0 : count - 1;
      } else {
        list.index = (list.index + (down ? 1 : -1) + count) % count;
      }
    } else if (event.key === "Enter" && list.kbd) {
      event.preventDefault();
      activate(list.index);
    }
  }

  function handleArtsKey(ctx, event) {
    const resource = ensureArts();
    if (resource.status !== "ready") {
      return;
    }

    const view = state.arts;
    const layout = view.layout;
    if (!layout) {
      return;
    }

    const page = Math.max(1, view.viewHeight - 1);
    const maxScroll = Math.max(0, layout.total - view.viewHeight);
    switch (event.key) {
      case "ArrowLeft":
      case "ArrowRight":
      case "ArrowUp":
      case "ArrowDown":
        event.preventDefault();
        moveArtSelection(view, layout, event.key);
        break;
      case "Enter":
        event.preventDefault();
        if (view.active >= 0) {
          openArt(ctx, view.active);
        }
        break;
      case "Escape":
        view.active = -1;
        break;
      case "PageDown":
        event.preventDefault();
        view.scroll = Math.min(maxScroll, view.scroll + page);
        break;
      case "PageUp":
        event.preventDefault();
        view.scroll = Math.max(0, view.scroll - page);
        break;
      case "Home":
        event.preventDefault();
        view.scroll = 0;
        break;
      case "End":
        event.preventDefault();
        view.scroll = maxScroll;
        break;
      default:
    }
  }

  // Стрелки двигают выбор к ближайшему арту в этом направлении (по центрам карточек).
  function moveArtSelection(view, layout, key) {
    const boxes = layout.boxes;
    if (!boxes.length) {
      return;
    }

    const current = boxes.find((box) => box.index === view.active);
    if (!current) {
      const first = boxes.find((box) => box.y + box.h > view.scroll) || boxes[0];
      view.active = first.index;
      scrollToBox(view, first);
      return;
    }

    const cx = current.x + current.w / 2;
    const cy = current.y + current.h / 2;
    let target = null;
    let best = Infinity;
    boxes.forEach((box) => {
      if (box === current) {
        return;
      }
      const dx = box.x + box.w / 2 - cx;
      const dy = box.y + box.h / 2 - cy;
      const along = key === "ArrowRight" ? dx : key === "ArrowLeft" ? -dx : key === "ArrowDown" ? dy : -dy;
      const across = key === "ArrowLeft" || key === "ArrowRight" ? dy : dx;
      if (along <= 0) {
        return;
      }
      // Экранные клетки вдвое выше своей ширины: вертикальный сдвиг весит вдвое больше.
      const score = along + 2 * Math.abs(across);
      if (score < best) {
        best = score;
        target = box;
      }
    });

    if (target) {
      view.active = target.index;
      scrollToBox(view, target);
    }
  }

  function scrollToBox(view, box) {
    if (box.y < view.scroll) {
      view.scroll = box.y;
    } else if (box.y + box.h > view.scroll + view.viewHeight) {
      view.scroll = Math.min(box.y, box.y + box.h - view.viewHeight);
    }
  }

  // ---------- mouse ----------
  function onPointerMove(ctx, event) {
    state.ctx = ctx;
    const cell = getTerminalCell(ctx, event.clientX, event.clientY);
    const hit = cell ? hitTest(cell) : null;
    state.arts.active = hit && hit.kind === "art" ? hit.index : -1;
    state.games.hover = hit && hit.kind === "game" ? hit.index : -1;
    state.links.hover = hit && hit.kind === "link" ? hit.index : -1;
    state.games.kbd = false;
    state.links.kbd = false;

    let overSetting = false;
    if (state.settings) {
      const inContent = cell && state.tab === TAB_SETTINGS && cell.col >= CONTENT_X;
      overSetting = state.settings.pointerMove(ctx, inContent ? toLayerCell(cell) : null);
    }
    ctx.terminal.style.cursor = hit || overSetting ? "pointer" : "default";
  }

  function onPointerDown(ctx, event, settings) {
    state.ctx = ctx;
    if (event.button !== 0) {
      return;
    }

    const cell = getTerminalCell(ctx, event.clientX, event.clientY);
    const hit = cell ? hitTest(cell) : null;
    if (!hit) {
      const local = cell && state.tab === TAB_SETTINGS && cell.col >= CONTENT_X ? toLayerCell(cell) : null;
      if (local && settings.pointerDown(ctx, local)) {
        event.preventDefault();
      }
      return;
    }

    event.preventDefault();
    switch (hit.kind) {
      case "tab":
        selectTab(ctx, hit.index);
        break;
      case "art":
        openArt(ctx, hit.index);
        break;
      case "game":
        startGame(ctx, hit.index);
        break;
      case "link":
        openLink(hit.index);
        break;
      case "retry":
        retry(hit.what);
        break;
      default:
    }
  }

  // Что находится под клеткой терминала.
  function hitTest(cell) {
    if (cell.col >= 0 && cell.col < SIDEBAR_WIDTH) {
      const index = Math.floor((cell.row - state.itemsTop) / ITEM_HEIGHT);
      return cell.row >= state.itemsTop && index >= 0 && index < TABS.length ? { kind: "tab", index } : null;
    }

    const hits = state.hits;
    if (!hits) {
      return null;
    }

    // Клетка в сетке слоя, в котором нарисована вкладка (для крупного слоя - своя сетка).
    const local = toLayerCell(cell);
    if (!local) {
      return null;
    }

    if (hits.retry && state.tab !== null && local.col >= hits.area.x) {
      return { kind: "retry", what: hits.retry };
    }

    if (hits.arts) {
      const { area, boxes, scroll } = hits.arts;
      const inside = cell.col >= area.x && cell.col < area.x + area.width
        && cell.row >= area.y && cell.row < area.y + area.height;
      if (inside) {
        const x = cell.col - area.x;
        const y = cell.row - area.y + scroll;
        const box = boxes.find((item) => x >= item.x && x < item.x + item.w && y >= item.y && y < item.y + item.h);
        return box ? { kind: "art", index: box.index } : null;
      }
    }

    if (hits.games) {
      const { x, y, width, count } = hits.games;
      const index = local.row - y;
      if (local.col >= x && local.col < x + width && index >= 0 && index < count) {
        return { kind: "game", index };
      }
    }

    if (hits.links) {
      const { x, y, width, count } = hits.links;
      const index = local.row - y;
      if (local.col >= x && local.col < x + width && index >= 0 && index < count) {
        return { kind: "link", index };
      }
    }

    return null;
  }

  // Клетка экрана -> клетка слоя вкладки (для крупного слоя делится на 2); null вне области.
  function toLayerCell(cell) {
    if (!state.hits || !state.hits.big) {
      return cell;
    }
    const col = Math.floor((cell.col - CONTENT_X) / BIG_SCALE);
    const row = Math.floor((cell.row - CONTENT_TOP) / BIG_SCALE);
    return col >= 0 && row >= 0 ? { col, row } : null;
  }

  function onWheel(ctx, event) {
    event.preventDefault();
    if (state.tab === TAB_SETTINGS && state.settings) {
      state.settings.onWheel(ctx, Math.sign(event.deltaY));
      return;
    }

    const view = state.arts;
    if (state.tab !== TAB_ARTS || !view.layout) {
      return;
    }

    const maxScroll = Math.max(0, view.layout.total - view.viewHeight);
    view.scroll = Math.min(maxScroll, Math.max(0, view.scroll + Math.sign(event.deltaY) * SCROLL_STEP));
  }

  // ---------- actions ----------
  function openArt(ctx, index) {
    const resource = ensureArts();
    if (resource.status === "ready" && resource.items[index]) {
      ctx.terminal.style.cursor = "default";
      state.arts.active = index;
      ctx.openProgram("artview", [resource.items, index]);
    }
  }

  function startGame(ctx, index) {
    const program = gamePrograms(ctx)[index];
    if (program) {
      ctx.terminal.style.cursor = "default";
      state.games.index = index;
      state.games.kbd = false;
      ctx.openProgram(program.id);
    }
  }

  function openLink(index) {
    const link = ensureLinks().items[index];
    if (link && /^https?:\/\//i.test(link.url)) {
      window.open(link.url, "_blank", "noopener,noreferrer");
    }
  }

  function retry(what) {
    if (what === "arts") {
      reloadArts();
    } else {
      reloadLinks();
    }
  }

  return {
    render,
    onKeyDown,
    onPointerMove,
    onPointerDown,
    onWheel,
    renderSidebar,
    hitSidebar,
    openTab,
    serialize,
    restore,
    reset
  };
}

// ---------- canvas helpers ----------
function createCanvas(cols, rows) {
  return Array.from({ length: rows }, () => new Array(cols).fill(" "));
}

function drawText(canvas, x, y, text, maxWidth = Infinity) {
  if (y < 0 || y >= canvas.length) {
    return;
  }

  const row = canvas[y];
  const limit = Math.min(row.length, x + maxWidth);
  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i += 1) {
    const px = x + i;
    if (px < 0) {
      continue;
    }
    if (px >= limit) {
      break;
    }
    row[px] = chars[i];
  }
}

// Плашка названия наведённого арта: полоса от середины первой клетки до середины последней.
// row 0 - нижняя половина клеток, 1 - целиком (текст инвертируется), 2 - верхняя половина.
function barStyle(row) {
  const height = row === 1 ? "100%" : "50%";
  const position = row === 0 ? "100%" : "0";
  const color = row === 1 ? "color:var(--bg);" : "";
  return `${color}background-image:linear-gradient(var(--text),var(--text));background-repeat:no-repeat;background-size:calc(100% - 1ch) ${height};background-position:0.5ch ${position}`;
}

function addMark(marks, row, from, to, cls) {
  if (to > from) {
    marks.push({ row, from, to, cls });
  }
}

function padText(text, width) {
  return text + " ".repeat(Math.max(0, width - textLength(text)));
}
