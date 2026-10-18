// Настройки: Color change и Reset data. Показываются только во вкладке SETTINGS главной
// страницы (renderInline): подсветка пункта под мышью или выбранного стрелками, выбор мышью.
//
// Панель (panels/*.js): createState, enter, render(ps, ctx, view) -> { lines, marks, hits, hint },
// onKeyDown(ps, ctx, event, { back, kbd }), activate(ps, ctx, action, { back }), wantsText(ps).
// hits - зоны мыши { row, from, to, action }; marks - подсветка { row, from, to, cls?, style? }.

import {
  buildHintText,
  buildTable,
  composeView,
  stepIndex
} from "./core.js";
import { createColorPanel } from "./programs/color.js";
import { createResetPanel } from "./programs/reset.js";

const SECTION_WIDTH = 22;

export function createSettings() {
  const panels = [createColorPanel(), createResetPanel()];
  const state = {
    view: null, // null - список разделов, иначе индекс панели
    index: 0,
    kbd: false, // выбор стрелками виден, пока мышь не сдвинули
    hover: null, // action под мышью
    origin: { row: 0, col: 0 }, // где на экране левый верхний угол содержимого
    hits: [],
    panelStates: panels.map((panel) => panel.createState())
  };

  function resetView() {
    state.view = null;
    state.hover = null;
    state.kbd = false;
  }

  // Вернуться к списку разделов (при смене вкладки).
  function close() {
    resetView();
  }

  function enterPanel(index, ctx) {
    state.index = index;
    state.view = index;
    state.hover = null;
    panels[index].enter(state.panelStates[index], ctx);
  }

  const api = {
    back() {
      state.view = null;
      state.hover = null;
    }
  };

  function sectionsView(layout) {
    const labels = panels.map((panel) => panel.label);
    const table = buildTable([SECTION_WIDTH], ["Section"], labels.map((label) => [label]));
    const to = table[0].length - 1;
    const hot = state.hover && state.hover.kind === "open" ? state.hover.item : (state.kbd ? state.index : -1);
    const marks = [];
    const hits = labels.map((label, i) => ({ row: 3 + i, from: 1, to, action: { kind: "open", item: i } }));
    if (hot >= 0) {
      marks.push({ row: 3 + hot, from: 1, to, cls: "hl" });
    }

    const result = composeView([{ lines: table, marks, hits }]);
    result.hint = buildHintText([["UP/DOWN - Select", "LMB/ENTER - Open"]]);
    return result;
  }

  function buildContent(ctx, layout) {
    const content = state.view === null
      ? sectionsView(layout)
      : panels[state.view].render(state.panelStates[state.view], ctx, {
        hover: state.hover,
        kbd: state.kbd,
        maxRows: layout.maxRows,
        maxWidth: layout.maxWidth
      });
    state.hits = content.hits;
    return content;
  }

  // Встроенный вид: { lines, marks, width, hint }; положение на экране сообщает setOrigin.
  function renderInline(ctx, layout) {
    return buildContent(ctx, layout);
  }

  function setOrigin(row, col) {
    state.origin = { row, col };
  }

  function hitAt(cell) {
    const row = cell.row - state.origin.row;
    const col = cell.col - state.origin.col;
    for (let i = state.hits.length - 1; i >= 0; i -= 1) {
      const hit = state.hits[i];
      if (hit.row === row && col >= hit.from && col < hit.to) {
        return hit;
      }
    }
    return null;
  }

  // Мышь: cell - клетка экрана или null (мышь вне настроек). Возвращает true над пунктом.
  function pointerMove(ctx, cell) {
    if (!cell) {
      state.hover = null;
      return false;
    }

    state.kbd = false;
    const hit = hitAt(cell);
    state.hover = hit ? hit.action : null;
    return Boolean(hit);
  }

  function pointerDown(ctx, cell) {
    const hit = hitAt(cell);
    if (!hit) {
      return false;
    }

    state.kbd = false;
    state.hover = null;
    if (state.view === null) {
      if (hit.action.kind === "open") {
        enterPanel(hit.action.item, ctx);
      }
    } else {
      panels[state.view].activate(state.panelStates[state.view], ctx, hit.action, api);
    }
    return true;
  }

  function onWheel(ctx, dir) {
    if (state.view !== null && panels[state.view].onWheel) {
      panels[state.view].onWheel(state.panelStates[state.view], ctx, dir);
    }
  }

  // true, пока в панели вводится текст: клавиша S тогда не должна открывать настройки.
  function wantsText() {
    return state.view !== null && Boolean(panels[state.view].wantsText(state.panelStates[state.view]));
  }

  function onKeyDown(ctx, event) {
    const wasKbd = state.kbd;
    if (event.key.startsWith("Arrow") || event.key === "Enter") {
      state.kbd = true;
      state.hover = null;
    }

    if (state.view !== null) {
      panels[state.view].onKeyDown(state.panelStates[state.view], ctx, event, { back: api.back, kbd: wasKbd });
      return;
    }

    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      state.index = stepIndex(state.index, panels.length, event.key === "ArrowDown" ? 1 : -1, wasKbd);
    } else if (event.key === "Enter" && wasKbd) {
      event.preventDefault();
      enterPanel(state.index, ctx);
    }
  }

  return {
    close,
    // true, если текущий вид рисуется крупно (список разделов, Reset); карточки цветов - обычным шрифтом.
    isBig: () => state.view === null || panels[state.view].big === true,
    renderInline,
    setOrigin,
    pointerMove,
    pointerDown,
    onWheel,
    wantsText,
    onKeyDown
  };
}
