import {
  BANNERS,
  UI_INSET_LEFT,
  UI_INSET_TOP,
  buildHintTable,
  centerText,
  escapeHtml,
  fieldBorder,
  getTerminalCell
} from "../core.js";

const MIN_BRUSH = 1;
// Уровни кисти: 1 - клетка, 2 - крестик, дальше круги растущего размера.
const MAX_BRUSH = 9;
// Начиная с круга (уровень 3) кисть закрашивает только часть клеток.
const FIRST_SPRAY_LEVEL = 3;
// Таблица подсказок не шире прежнего поля (80 + рамка), хотя поле стало больше.
const HINT_MAX_WIDTH = 82;
const SPRAY_DENSITY = 0.6;
// Таблица подсказок в режиме правки: 2 строки + 2 границы.
const FOOTER_HEIGHT = 4;
const FOOTER_MODES = [
  { running: false, finished: false },
  { running: true, finished: false },
  { running: true, finished: true }
];

function createGameOfLifeState() {
  return {
    cols: 0,
    rows: 0,
    cells: [],
    cursorX: 0,
    cursorY: 0,
    running: false,
    finished: false,
    generation: 0,
    population: 0,
    brushSize: 1,
    lastStepAt: 0,
    stepIntervalMs: 280,
    viewport: null,
    pointerAction: null
  };
}

export function createGameOfLifeProgram() {
  return {
    id: "gameoflife",
    label: "Game of Life",
    createState: createGameOfLifeState,
    enter,
    leave,
    serializeState,
    restoreState,
    render,
    tick,
    onKeyDown,
    onPointerDown,
    onPointerMove,
    onPointerUp
  };
}

function enter(programState, ctx) {
  const state = programState;
  if (!state.cells.length) {
    Object.assign(state, createGameOfLifeState());
  }
  const metrics = getGameOfLifeMetrics(ctx);
  ensureBoard(state, metrics.fieldCols, metrics.fieldRows);
  ctx.setActiveProgram("gameoflife");
  ctx.persistProgramState("gameoflife");
  ctx.persistUiState();
}

function serializeState(programState) {
  return {
    cols: programState.cols,
    rows: programState.rows,
    cells: programState.cells.slice(),
    cursorX: programState.cursorX,
    cursorY: programState.cursorY,
    running: programState.running,
    finished: programState.finished,
    generation: programState.generation,
    population: programState.population,
    brushSize: programState.brushSize
  };
}

function restoreState(savedState) {
  const state = createGameOfLifeState();
  if (!savedState || typeof savedState !== "object") {
    return state;
  }

  const cols = typeof savedState.cols === "number" ? Math.max(0, Math.floor(savedState.cols)) : 0;
  const rows = typeof savedState.rows === "number" ? Math.max(0, Math.floor(savedState.rows)) : 0;
  const expectedSize = cols * rows;
  const cells = Array.isArray(savedState.cells)
    ? savedState.cells.slice(0, expectedSize).map((cell) => (cell ? 1 : 0))
    : [];

  while (cells.length < expectedSize) {
    cells.push(0);
  }

  state.cols = cols;
  state.rows = rows;
  state.cells = cells;
  state.cursorX = typeof savedState.cursorX === "number" ? Math.floor(savedState.cursorX) : 0;
  state.cursorY = typeof savedState.cursorY === "number" ? Math.floor(savedState.cursorY) : 0;
  state.running = Boolean(savedState.running);
  state.finished = state.running && Boolean(savedState.finished);
  state.generation = typeof savedState.generation === "number" ? Math.max(0, Math.floor(savedState.generation)) : 0;
  state.brushSize = typeof savedState.brushSize === "number"
    ? Math.min(MAX_BRUSH, Math.max(MIN_BRUSH, Math.floor(savedState.brushSize)))
    : 1;
  state.population = countPopulation(state);
  return state;
}

// Подсказки: клавиша, затем пояснение. Режим правки и запуска - разные таблицы.
function getFooterRows(state) {
  if (state.running) {
    return [
      [`Generation: ${String(state.generation).padStart(6)}`, state.finished ? "ANY KEY - Edit" : "E - Edit"],
      [`Population: ${String(state.population).padStart(6)}`, "ESC - Exit"]
    ];
  }

  return [
    ["LMB - Fill cell", "[ - Brush smaller", "R - Random fill", "ENTER - Start"],
    ["RMB - Clear cell", "] - Brush bigger", "DEL - Clear all", "ESC - Exit"]
  ];
}

function render(programState, ctx) {
  const state = programState;
  const metrics = getGameOfLifeMetrics(ctx);
  ensureBoard(state, metrics.fieldCols, metrics.fieldRows);
  const visibleCols = Math.min(metrics.fieldCols, state.cols);
  const visibleRows = Math.min(metrics.fieldRows, state.rows);
  const banner = BANNERS.gameoflife;
  // Ширина таблицы подсказок одинакова во всех режимах (правка, игра, конец игры)
  // и равна ширине блока, чтобы она не прыгала при смене режима.
  const widestFooter = Math.max(...FOOTER_MODES.map(
    (mode) => buildHintTable(getFooterRows({ ...state, ...mode }))[0].length
  ));
  const frameWidth = visibleCols + 2;
  const blockWidth = Math.max(frameWidth, banner[0].length, widestFooter);
  const footerLines = buildHintTable(getFooterRows(state), { width: Math.max(widestFooter, Math.min(blockWidth, HINT_MAX_WIDTH)) });
  const blockHeight = banner.length + 1 + (visibleRows + 2) + 1 + FOOTER_HEIGHT;
  const topInset = Math.max(UI_INSET_TOP, Math.floor((ctx.viewportRows - blockHeight) / 2));
  const leftInset = Math.max(UI_INSET_LEFT, Math.floor((ctx.viewportCols - blockWidth) / 2));
  const leftPadding = " ".repeat(leftInset);
  const frameOffset = Math.floor((blockWidth - frameWidth) / 2);
  const framePadding = `${leftPadding}${" ".repeat(frameOffset)}`;
  const border = fieldBorder(visibleCols);
  const brush = state.running ? null : getBrushFootprint(state, ctx, visibleCols, visibleRows);
  const lines = [];

  for (let i = 0; i < topInset; i += 1) {
    lines.push("");
  }

  banner.forEach((line) => {
    lines.push(`${leftPadding}${escapeHtml(centerText(line, blockWidth))}`);
  });
  lines.push("");

  lines.push(`${framePadding}${border.top}`);
  for (let row = 0; row < visibleRows; row += 1) {
    let line = `${framePadding}${border.side}`;
    for (let col = 0; col < visibleCols; col += 1) {
      const alive = state.cells[row * state.cols + col] === 1;
      const char = alive ? "■" : " ";
      line += brush && brush.has(`${col}:${row}`)
        ? `<span class="gol-cursor">${escapeHtml(char)}</span>`
        : escapeHtml(char);
    }
    line += border.side;
    lines.push(line);
  }
  lines.push(`${framePadding}${border.bottom}`);
  lines.push("");

  footerLines.forEach((line) => {
    lines.push(`${leftPadding}${escapeHtml(centerText(line, blockWidth))}`);
  });

  state.viewport = {
    originX: leftInset + frameOffset + 1,
    originY: topInset + banner.length + 1 + 1,
    cols: visibleCols,
    rows: visibleRows
  };

  return { format: "html", content: lines.join("\n") };
}

function tick(programState, ctx, timestamp) {
  const state = programState;
  const metrics = getGameOfLifeMetrics(ctx);
  ensureBoard(state, metrics.fieldCols, metrics.fieldRows);

  if (!state.running || state.finished) {
    return;
  }

  if (!state.lastStepAt) {
    state.lastStepAt = timestamp;
  }

  if (timestamp - state.lastStepAt < state.stepIntervalMs) {
    return;
  }

  const nextCells = new Array(state.cells.length).fill(0);
  let nextPopulation = 0;
  for (let row = 0; row < state.rows; row += 1) {
    for (let col = 0; col < state.cols; col += 1) {
      const index = row * state.cols + col;
      const alive = state.cells[index] === 1;
      const neighbors = countNeighbors(state, col, row);
      const nextAlive = neighbors === 3 || (alive && neighbors === 2);
      nextCells[index] = nextAlive ? 1 : 0;
      nextPopulation += nextCells[index];
    }
  }

  state.cells = nextCells;
  state.population = nextPopulation;
  state.generation += 1;
  if (nextPopulation === 0) {
    // Клетки закончились: игра ждёт нажатия пользователя, а не уходит в правку сама.
    state.finished = true;
  }
  state.lastStepAt = timestamp;
  ctx.persistProgramState("gameoflife");
}

function onKeyDown(programState, ctx, event) {
  if (event.key === "Escape") {
    event.preventDefault();
    exitToMenu(programState, ctx);
    return;
  }

  if (programState.running) {
    if (programState.finished) {
      if (!["Shift", "Control", "Alt", "Meta", "CapsLock"].includes(event.key)) {
        event.preventDefault();
        stopRun(programState, ctx);
      }
      return;
    }

    if (event.key === "e" || event.key === "E" || event.key === "у" || event.key === "У" || event.key === "Insert") {
      event.preventDefault();
      stopRun(programState, ctx);
    }
    return;
  }

  const brushDelta = getBrushDelta(event);
  if (brushDelta !== 0) {
    event.preventDefault();
    programState.brushSize = Math.min(MAX_BRUSH, Math.max(MIN_BRUSH, programState.brushSize + brushDelta));
    ctx.persistProgramState("gameoflife");
    return;
  }

  if (event.key === "Delete") {
    event.preventDefault();
    clearBoard(programState, ctx);
    return;
  }

  if (event.key === "r" || event.key === "R" || event.key === "к" || event.key === "К" || event.key === "Home") {
    event.preventDefault();
    randomizeBoard(programState, ctx);
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    if (programState.population === 0) {
      return;
    }
    programState.running = true;
    programState.finished = false;
    programState.lastStepAt = performance.now();
    programState.generation = 0;
    programState.population = countPopulation(programState);
    ctx.persistProgramState("gameoflife");
  }
}

// [ и ] (и те же физические клавиши в русской раскладке).
function getBrushDelta(event) {
  if (event.code === "BracketLeft" || event.key === "[" || event.key === "{" || event.key === "х" || event.key === "Х") {
    return -1;
  }
  if (event.code === "BracketRight" || event.key === "]" || event.key === "}" || event.key === "ъ" || event.key === "Ъ") {
    return 1;
  }
  return 0;
}

function onPointerDown(programState, ctx, event) {
  // Клетки закончились: любое нажатие (в том числе мыши) возвращает в правку.
  if (programState.running && programState.finished) {
    event.preventDefault();
    stopRun(programState, ctx);
    return;
  }

  const target = getPointerCell(programState, ctx, event.clientX, event.clientY);
  if (!target || programState.running) {
    return;
  }

  programState.cursorX = target.col;
  programState.cursorY = target.row;

  if (event.button === 0) {
    programState.pointerAction = "draw";
    paintBrush(programState, ctx, target.col, target.row, true);
    return;
  }

  if (event.button === 2) {
    programState.pointerAction = "erase";
    paintBrush(programState, ctx, target.col, target.row, false);
  }
}

function onPointerMove(programState, ctx, event) {
  if (programState.running) {
    return;
  }

  const target = getPointerCell(programState, ctx, event.clientX, event.clientY);
  if (!target) {
    return;
  }

  programState.cursorX = target.col;
  programState.cursorY = target.row;

  if (!programState.pointerAction) {
    return;
  }

  paintBrush(programState, ctx, target.col, target.row, programState.pointerAction === "draw");
}

function onPointerUp(programState) {
  programState.pointerAction = null;
}

function stopRun(programState, ctx) {
  programState.running = false;
  programState.finished = false;
  programState.lastStepAt = 0;
  ctx.persistProgramState("gameoflife");
}

// Выход кликом по панели вкладок.
function leave(programState, ctx) {
  programState.running = false;
  programState.finished = false;
  programState.lastStepAt = 0;
  programState.viewport = null;
  programState.pointerAction = null;
  ctx.persistProgramState("gameoflife");
}

function exitToMenu(programState, ctx) {
  programState.running = false;
  programState.finished = false;
  programState.lastStepAt = 0;
  programState.viewport = null;
  programState.pointerAction = null;
  ctx.persistProgramState("gameoflife");
  ctx.returnToMenu();
}

// Баннер сверху и таблица подсказок снизу занимают место.
function getGameOfLifeMetrics(ctx) {
  const fieldCols = Math.max(16, Math.min(120, ctx.viewportCols - UI_INSET_LEFT - 8));
  const fieldRows = Math.max(8, Math.min(40, ctx.viewportRows - 13));
  return { fieldCols, fieldRows };
}

function ensureBoard(state, cols, rows) {
  if (state.cols === cols && state.rows === rows && state.cells.length === cols * rows) {
    return;
  }

  const nextCells = new Array(cols * rows).fill(0);
  const copyCols = Math.min(cols, state.cols);
  const copyRows = Math.min(rows, state.rows);
  for (let row = 0; row < copyRows; row += 1) {
    for (let col = 0; col < copyCols; col += 1) {
      nextCells[row * cols + col] = state.cells[row * state.cols + col] || 0;
    }
  }

  state.cols = cols;
  state.rows = rows;
  state.cells = nextCells;
  state.cursorX = wrapCoord(state.cursorX, cols);
  state.cursorY = wrapCoord(state.cursorY, rows);
  state.population = countPopulation(state);
}

// Круглая кисть. Символ вдвое выше своей ширины, поэтому по горизонтали
// берётся больше клеток (x масштабируется на charAspect) - на экране получается круг.
function getBrushOffsets(size, aspect) {
  if (size <= 1) {
    return [[0, 0]];
  }

  // Крестик: клетка выше вдвое, поэтому по горизонтали рука длиннее (2 клетки), по вертикали 1.
  if (size === 2) {
    return [[0, 0], [-1, 0], [-2, 0], [1, 0], [2, 0], [0, -1], [0, 1]];
  }

  size -= 1;
  const a = Math.min(1, Math.max(0.25, aspect > 0 ? aspect : 0.5));
  const radius = size - 0.5;
  const reachY = Math.floor(radius);
  const reachX = Math.ceil(radius / a);
  const offsets = [];
  for (let dy = -reachY; dy <= reachY; dy += 1) {
    for (let dx = -reachX; dx <= reachX; dx += 1) {
      if ((dx * a) ** 2 + dy * dy <= radius * radius + 1e-6) {
        offsets.push([dx, dy]);
      }
    }
  }
  return offsets;
}

function getBrushFootprint(state, ctx, visibleCols, visibleRows) {
  const footprint = new Set();
  getBrushOffsets(state.brushSize, ctx.charAspect).forEach(([dx, dy]) => {
    const col = state.cursorX + dx;
    const row = state.cursorY + dy;
    if (col >= 0 && col < visibleCols && row >= 0 && row < visibleRows) {
      footprint.add(`${col}:${row}`);
    }
  });
  return footprint;
}

function paintBrush(state, ctx, col, row, alive) {
  const spray = alive && state.brushSize >= FIRST_SPRAY_LEVEL;
  getBrushOffsets(state.brushSize, ctx.charAspect).forEach(([dx, dy]) => {
    const targetCol = col + dx;
    const targetRow = row + dy;
    if (targetCol < 0 || targetCol >= state.cols || targetRow < 0 || targetRow >= state.rows) {
      return;
    }
    if (spray && Math.random() > SPRAY_DENSITY) {
      return;
    }
    state.cells[targetRow * state.cols + targetCol] = alive ? 1 : 0;
  });
  state.population = countPopulation(state);
  ctx.persistProgramState("gameoflife");
}

function clearBoard(state, ctx) {
  state.cells.fill(0);
  state.generation = 0;
  state.population = 0;
  state.lastStepAt = 0;
  ctx.persistProgramState("gameoflife");
}

function randomizeBoard(state, ctx) {
  for (let i = 0; i < state.cells.length; i += 1) {
    state.cells[i] = Math.random() > 0.72 ? 1 : 0;
  }
  state.generation = 0;
  state.population = countPopulation(state);
  state.lastStepAt = 0;
  ctx.persistProgramState("gameoflife");
}

function countPopulation(state) {
  return state.cells.reduce((sum, cell) => sum + (cell ? 1 : 0), 0);
}

function countNeighbors(state, col, row) {
  let neighbors = 0;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) {
        continue;
      }
      const wrappedCol = wrapCoord(col + dx, state.cols);
      const wrappedRow = wrapCoord(row + dy, state.rows);
      neighbors += state.cells[wrappedRow * state.cols + wrappedCol];
    }
  }
  return neighbors;
}

function getPointerCell(state, ctx, clientX, clientY) {
  const cell = state.viewport ? getTerminalCell(ctx, clientX, clientY) : null;
  if (!cell) {
    return null;
  }

  const fieldCol = cell.col - state.viewport.originX;
  const fieldRow = cell.row - state.viewport.originY;
  if (fieldCol < 0 || fieldCol >= state.viewport.cols || fieldRow < 0 || fieldRow >= state.viewport.rows) {
    return null;
  }

  return { col: fieldCol, row: fieldRow };
}

function wrapCoord(value, size) {
  if (size <= 0) {
    return 0;
  }
  const normalized = value % size;
  return normalized < 0 ? normalized + size : normalized;
}
