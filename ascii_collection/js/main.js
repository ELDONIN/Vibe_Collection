import {
  BASE_FONT_SCALE,
  DEFAULT_CONSOLE_COLORS,
  FONT_CHAR_HEIGHT,
  FONT_CHAR_WIDTH,
  STORAGE_KEYS,
  STORAGE_PREFIX,
  clearStoragePrefix,
  readStorageJson,
  textToHtml,
  removeStorageKey,
  writeStorageJson
} from "./core.js";
import { CONTENT_COLS, createLauncher } from "./launcher.js";
import { createArtViewProgram } from "./programs/arts.js";
import { createGameOfLifeProgram } from "./programs/gameoflife.js";
import { createRender3DProgram } from "./programs/render3d.js";
import { createSnakeProgram } from "./programs/snake.js";
import { createSettings } from "./settings.js";

const terminal = document.getElementById("terminal");
const registry = createProgramRegistry([
  createRender3DProgram(),
  createGameOfLifeProgram(),
  createSnakeProgram(),
  createArtViewProgram()
]);
const state = createAppState(registry.list);
const ctx = createAppContext();
const settings = createSettings();
const launcher = createLauncher();

boot();

function boot() {
  loadPersistedSettings();
  terminal.tabIndex = 0;
  terminal.setAttribute("role", "application");
  terminal.setAttribute("aria-label", "ASCII Collection");
  terminal.addEventListener("contextmenu", preventContextMenu);
  terminal.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  terminal.addEventListener("wheel", onWheel, { passive: false });
  terminal.addEventListener("dblclick", onDoubleClick);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("resize", handleResize);
  createMeasureNode();
  handleResize();
  waitForFont();
  renderScreen();
  state.animationFrame = requestAnimationFrame(tick);
  terminal.focus();
}

function createAppContext() {
  return {
    terminal,
    programs: registry.list,
    // Запущенная игра занимает правую область: слева остаётся панель вкладок.
    get contentOffsetCols() {
      const program = getActiveProgram();
      return program && !program.fullscreen ? CONTENT_COLS : 0;
    },
    get viewportCols() {
      return Math.max(52, state.viewportCols - ctx.contentOffsetCols);
    },
    get viewportRows() {
      return state.viewportRows;
    },
    get charAspect() {
      return state.charAspect;
    },
    get measureSpan() {
      return state.measureSpan;
    },
    setActiveProgram(programId) {
      state.activeProgramId = registry.byId[programId] ? programId : null;
    },
    openProgram(programId, args = []) {
      const program = registry.byId[programId];
      if (!program) {
        return;
      }
      terminal.style.cursor = "default";
      program.enter(getProgramState(programId), ctx, args);
    },
    // Выход из игры при клике по панели вкладок.
    leaveProgram() {
      const program = getActiveProgram();
      if (program && typeof program.leave === "function") {
        program.leave(getProgramState(program.id), ctx);
      }
      ctx.returnToMenu();
    },
    returnToMenu() {
      state.activeProgramId = null;
      state.lastLauncherHtml = null;
      // Выход из программы всегда возвращает обычный шрифт 16px.
      if (state.fontScaleOverride !== null) {
        state.fontScaleOverride = null;
        handleResize();
      }
      ctx.persistUiState();
    },
    resetData,
    persistProgramState,
    persistUiState,
    persistConsoleSettings,
    getConsoleColors,
    applyConsoleColors,
    setFontScale,
    getViewportCells
  };
}

function createMeasureNode() {
  const span = document.createElement("span");
  span.textContent = "M";
  span.style.position = "absolute";
  span.style.visibility = "hidden";
  span.style.pointerEvents = "none";
  span.style.whiteSpace = "pre";
  document.body.appendChild(span);
  state.measureSpan = span;
  syncMeasureSpan();
}

function syncMeasureSpan() {
  const style = getComputedStyle(terminal);
  state.measureSpan.style.fontFamily = style.fontFamily;
  state.measureSpan.style.fontSize = style.fontSize;
  state.measureSpan.style.lineHeight = style.lineHeight;
}

// Шрифт всегда 16px. Исключение - программа может временно запросить другой размер
// (полноэкранный арт - 32px); размер кратен 8x16, чтобы пиксельные глифы оставались чёткими.
function pickFontScale() {
  return state.fontScaleOverride !== null ? state.fontScaleOverride : BASE_FONT_SCALE;
}

function setFontScale(scale) {
  const next = typeof scale === "number" && scale > 0 ? scale : null;
  if (next === state.fontScaleOverride) {
    return;
  }
  state.fontScaleOverride = next;
  handleResize();
}

// Сколько клеток поместится в окне при данном масштабе шрифта.
function getViewportCells(scale) {
  return {
    cols: Math.floor(window.innerWidth / (FONT_CHAR_WIDTH * scale)),
    rows: Math.floor(window.innerHeight / (FONT_CHAR_HEIGHT * scale))
  };
}

function waitForFont() {
  if (!document.fonts) {
    return;
  }
  const refresh = () => handleResize();
  document.fonts.load('16px "IBM VGA 8x16"').then(refresh).catch(() => {});
  document.fonts.ready.then(refresh).catch(() => {});
}

function handleResize() {
  if (!state.measureSpan) {
    return;
  }

  const scale = pickFontScale();
  terminal.style.fontSize = `${FONT_CHAR_HEIGHT * scale}px`;
  terminal.style.lineHeight = `${FONT_CHAR_HEIGHT * scale}px`;
  syncMeasureSpan();

  const style = getComputedStyle(terminal);
  const charRect = state.measureSpan.getBoundingClientRect();
  const rect = terminal.getBoundingClientRect();
  const paddingX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  const paddingY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
  const charWidth = Math.max(1, charRect.width);
  const charHeight = Math.max(1, charRect.height);
  const contentWidth = Math.max(0, rect.width - paddingX);
  const contentHeight = Math.max(0, rect.height - paddingY);
  // Минимальный размер экрана защищает обычные экраны от слишком маленького окна.
  // При запрошенном программой шрифте (арт на 32px) берём реальное число клеток.
  const requested = state.fontScaleOverride !== null;
  state.viewportCols = Math.max(requested ? 20 : 52, Math.floor(contentWidth / charWidth));
  state.viewportRows = Math.max(requested ? 10 : 26, Math.floor(contentHeight / charHeight));
  state.charAspect = charWidth / charHeight;
  state.lastLauncherHtml = null;
  renderScreen();
}

function tick(timestamp) {
  const deltaSeconds = state.lastTimestamp ? Math.min(0.05, (timestamp - state.lastTimestamp) / 1000) : 0.016;
  state.lastTimestamp = timestamp;
  const activeProgram = getActiveProgram();
  if (activeProgram && typeof activeProgram.tick === "function") {
    activeProgram.tick(getProgramState(activeProgram.id), ctx, timestamp, deltaSeconds);
  }
  renderScreen();
  state.animationFrame = requestAnimationFrame(tick);
}

function renderScreen() {
  const activeProgram = getActiveProgram();
  if (!activeProgram) {
    // Главная перерисовывается только при изменении картинки, чтобы не пересоздавать DOM каждый кадр.
    const html = launcher.render(ctx, settings);
    if (html !== state.lastLauncherHtml) {
      terminal.innerHTML = html;
      state.lastLauncherHtml = html;
    }
    return;
  }

  state.lastLauncherHtml = null;
  const output = activeProgram.render(getProgramState(activeProgram.id), ctx);
  if (activeProgram.fullscreen) {
    if (output.format === "html") {
      terminal.innerHTML = output.content;
    } else {
      terminal.textContent = output.content;
    }
    return;
  }

  // Слева панель вкладок, справа вывод игры построчно.
  const body = (output.format === "html" ? output.content : output.content.split("\n").map(textToHtml).join("\n")).split("\n");
  const side = launcher.renderSidebar(ctx);
  terminal.innerHTML = side.map((row, index) => row + (body[index] || "")).join("\n");
}

function onKeyDown(event) {
  const activeProgram = getActiveProgram();
  if (activeProgram && typeof activeProgram.onKeyDown === "function") {
    activeProgram.onKeyDown(getProgramState(activeProgram.id), ctx, event);
    renderScreen();
    return;
  }

  if (!activeProgram) {
    launcher.onKeyDown(ctx, event, settings);
    renderScreen();
  }
}

function onPointerDown(event) {
  terminal.focus();
  const activeProgram = getActiveProgram();
  if (!activeProgram) {
    launcher.onPointerDown(ctx, withTerminalTarget(event), settings);
    renderScreen();
    return;
  }

  if (!activeProgram.fullscreen && event.button === 0) {
    const tab = launcher.hitSidebar(ctx, event);
    if (tab >= 0) {
      ctx.leaveProgram();
      launcher.openTab(ctx, tab);
      terminal.style.cursor = "default";
      renderScreen();
      return;
    }
  }

  if (typeof activeProgram.onPointerDown !== "function") {
    return;
  }

  activeProgram.onPointerDown(getProgramState(activeProgram.id), ctx, withTerminalTarget(event));
  renderScreen();
}

function onPointerMove(event) {
  const activeProgram = getActiveProgram();
  if (!activeProgram) {
    launcher.onPointerMove(ctx, withTerminalTarget(event));
    renderScreen();
    return;
  }

  if (typeof activeProgram.onPointerMove !== "function") {
    return;
  }

  if (!activeProgram.fullscreen && launcher.hitSidebar(ctx, event) >= 0) {
    terminal.style.cursor = "pointer";
    return;
  }

  activeProgram.onPointerMove(getProgramState(activeProgram.id), ctx, withTerminalTarget(event));
  renderScreen();
}

function onPointerUp(event) {
  const activeProgram = getActiveProgram();
  if (!activeProgram || typeof activeProgram.onPointerUp !== "function") {
    return;
  }

  activeProgram.onPointerUp(getProgramState(activeProgram.id), ctx, withTerminalTarget(event));
  renderScreen();
}

function onWheel(event) {
  const activeProgram = getActiveProgram();
  if (!activeProgram) {
    launcher.onWheel(ctx, withTerminalTarget(event));
    renderScreen();
    return;
  }

  if (typeof activeProgram.onWheel !== "function") {
    return;
  }

  activeProgram.onWheel(getProgramState(activeProgram.id), ctx, withTerminalTarget(event));
  renderScreen();
}

function onDoubleClick(event) {
  const activeProgram = getActiveProgram();
  if (!activeProgram || typeof activeProgram.onDoubleClick !== "function") {
    return;
  }

  activeProgram.onDoubleClick(getProgramState(activeProgram.id), ctx, withTerminalTarget(event));
  renderScreen();
}

// Область, на которую опираются игры (дуга вращения): при запущенной игре это правая часть терминала.
function getTargetRect() {
  const rect = terminal.getBoundingClientRect();
  const offset = state.measureSpan.getBoundingClientRect().width * ctx.contentOffsetCols;
  return {
    left: rect.left + offset,
    top: rect.top,
    width: rect.width - offset,
    height: rect.height,
    right: rect.right,
    bottom: rect.bottom
  };
}

function withTerminalTarget(event) {
  const target = ctx.contentOffsetCols ? { getBoundingClientRect: getTargetRect } : terminal;
  return {
    button: event.button,
    clientX: event.clientX,
    clientY: event.clientY,
    currentTarget: target,
    deltaY: event.deltaY,
    preventDefault() {
      event.preventDefault();
    },
    target
  };
}

function preventContextMenu(event) {
  event.preventDefault();
}

function getActiveProgram() {
  return state.activeProgramId ? registry.byId[state.activeProgramId] || null : null;
}

function getProgramState(programId) {
  return state.programs[programId];
}

function loadPersistedSettings() {
  loadConsoleSettings();
  loadProgramStates();
  loadUiState();
}

function loadConsoleSettings() {
  const storedConsole = readStorageJson(STORAGE_KEYS.console);
  if (storedConsole && storedConsole.text && storedConsole.background) {
    applyConsoleColors(storedConsole.text, storedConsole.background);
  }
}

function loadProgramStates() {
  registry.list.forEach((program) => {
    if (typeof program.restoreState !== "function") {
      return;
    }
    const storageKey = STORAGE_KEYS[program.id];
    const savedState = storageKey ? readStorageJson(storageKey) : null;
    const legacyState = getLegacyProgramState(program.id);
    const initialState = savedState || legacyState.savedState || null;
    state.programs[program.id] = program.restoreState(initialState, legacyState);
  });
}

function getLegacyProgramState(programId) {
  if (programId === "render3d") {
    const storedUi = readStorageJson(STORAGE_KEYS.ui);
    const storedFigures = readStorageJson(STORAGE_KEYS.figures);
    return {
      legacyFigureSettings: storedFigures,
      savedState: storedUi && typeof storedUi === "object" ? {
        mode: storedUi.mode === "render" ? "render" : storedUi.mode === "menu" ? "menu" : undefined,
        menuIndex: storedUi.menuIndex,
        sliderIndex: storedUi.sliderIndex,
        settingsVisible: storedUi.settingsVisible,
        currentFigureId: storedUi.currentFigureId
      } : null
    };
  }

  return {};
}

function loadUiState() {
  launcher.restore(readStorageJson(STORAGE_KEYS.ui));
  state.activeProgramId = null;
}

function persistProgramState(programId) {
  const program = registry.byId[programId];
  const storageKey = STORAGE_KEYS[programId];
  if (!program || !storageKey) {
    return;
  }

  const programState = getProgramState(programId);
  const payload = typeof program.serializeState === "function"
    ? program.serializeState(programState)
    : programState;
  writeStorageJson(storageKey, payload);
}

function persistUiState() {
  writeStorageJson(STORAGE_KEYS.ui, launcher.serialize());
}

function persistConsoleSettings() {
  writeStorageJson(STORAGE_KEYS.console, getConsoleColors());
}

function getConsoleColors() {
  const styles = getComputedStyle(document.documentElement);
  return {
    text: styles.getPropertyValue("--text").trim(),
    background: styles.getPropertyValue("--bg").trim()
  };
}

function applyConsoleColors(text, background) {
  document.documentElement.style.setProperty("--text", text);
  document.documentElement.style.setProperty("--bg", background);
}

// ---------- reset ----------

function resetData(scope) {
  if (scope === "all") {
    clearStoragePrefix(STORAGE_PREFIX);
    applyConsoleColors(DEFAULT_CONSOLE_COLORS.text, DEFAULT_CONSOLE_COLORS.background);
    registry.list.forEach(resetProgramState);
    launcher.reset();
    return;
  }

  if (scope === "console") {
    removeStorageKey(STORAGE_KEYS.console);
    applyConsoleColors(DEFAULT_CONSOLE_COLORS.text, DEFAULT_CONSOLE_COLORS.background);
    return;
  }

  if (scope === "schemes") {
    removeStorageKey(STORAGE_KEYS.schemes);
    return;
  }

  const program = registry.byId[scope];
  if (!program) {
    return;
  }

  removeStorageKey(STORAGE_KEYS[program.id]);
  if (program.id === "render3d") {
    removeStorageKey(STORAGE_KEYS.figures);
  }
  resetProgramState(program);
}

// Только программы с сохраняемым состоянием: у остальных (просмотр арта) нечего сбрасывать,
// а замена состояния активной программы сломала бы текущий экран.
function resetProgramState(program) {
  if (!STORAGE_KEYS[program.id]) {
    return;
  }

  state.programs[program.id] = typeof program.restoreState === "function"
    ? program.restoreState(null, {})
    : program.createState();
}

// ---------- registry and app state ----------

function createProgramRegistry(programs) {
  const byId = {};
  programs.forEach((program) => {
    byId[program.id] = program;
  });
  return { list: programs, byId };
}

function createAppState(programs) {
  const programStates = {};
  programs.forEach((program) => {
    programStates[program.id] = program.createState();
  });

  return {
    activeProgramId: null,
    fontScaleOverride: null,
    lastLauncherHtml: null,
    viewportCols: 120,
    viewportRows: 44,
    charAspect: 0.5,
    animationFrame: 0,
    lastTimestamp: 0,
    measureSpan: null,
    programs: programStates
  };
}
