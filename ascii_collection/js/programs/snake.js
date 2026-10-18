import {
  BANNERS,
  UI_INSET_LEFT,
  UI_INSET_TOP,
  buildHintTable,
  centerText,
  fieldBorder
} from "../core.js";

function createSnakeState() {
  return {
    cols: 0,
    rows: 0,
    snake: [],
    direction: "right",
    pendingDirection: "right",
    food: null,
    score: 0,
    bestScore: 0,
    running: false,
    gameOver: false,
    won: false,
    lastStepAt: 0,
    stepIntervalMs: 120
  };
}

const DIRECTION_VECTORS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
};

const OPPOSITE_DIRECTIONS = {
  up: "down",
  down: "up",
  left: "right",
  right: "left"
};

export function createSnakeProgram() {
  return {
    id: "snake",
    label: "Snake",
    createState: createSnakeState,
    enter,
    leave,
    serializeState,
    restoreState,
    render,
    tick,
    onKeyDown
  };
}

function enter(programState, ctx) {
  ensureBoard(programState, ctx);
  if (!programState.snake.length) {
    resetRound(programState);
  }
  ctx.setActiveProgram("snake");
  ctx.persistProgramState("snake");
  ctx.persistUiState();
}

// Выход кликом по панели вкладок: игра ставится на паузу.
function leave(programState, ctx) {
  programState.running = false;
  programState.lastStepAt = 0;
  ctx.persistProgramState("snake");
}

function serializeState(programState) {
  return {
    cols: programState.cols,
    rows: programState.rows,
    snake: programState.snake.map((segment) => ({ x: segment.x, y: segment.y })),
    direction: programState.direction,
    pendingDirection: programState.pendingDirection,
    food: programState.food ? { x: programState.food.x, y: programState.food.y } : null,
    score: programState.score,
    bestScore: programState.bestScore,
    running: programState.running,
    gameOver: programState.gameOver,
    won: programState.won
  };
}

function restoreState(savedState) {
  const state = createSnakeState();
  if (!savedState || typeof savedState !== "object") {
    return state;
  }

  state.cols = normalizeInt(savedState.cols, 0);
  state.rows = normalizeInt(savedState.rows, 0);
  state.snake = Array.isArray(savedState.snake)
    ? savedState.snake
      .filter((segment) => segment && typeof segment.x === "number" && typeof segment.y === "number")
      .map((segment) => ({ x: Math.floor(segment.x), y: Math.floor(segment.y) }))
    : [];
  state.direction = isDirection(savedState.direction) ? savedState.direction : "right";
  state.pendingDirection = isDirection(savedState.pendingDirection) ? savedState.pendingDirection : state.direction;
  state.food = savedState.food && typeof savedState.food.x === "number" && typeof savedState.food.y === "number"
    ? { x: Math.floor(savedState.food.x), y: Math.floor(savedState.food.y) }
    : null;
  state.score = normalizeInt(savedState.score, 0);
  state.bestScore = normalizeInt(savedState.bestScore, 0);
  state.running = Boolean(savedState.running);
  state.gameOver = Boolean(savedState.gameOver);
  state.won = Boolean(savedState.won);
  return state;
}

function render(programState, ctx) {
  ensureBoard(programState, ctx);
  const lines = [];
  const banner = BANNERS.snake;
  const boardWidth = programState.cols + 2;
  const footerLines = buildHintTable([
    [`Score:  ${String(programState.score).padStart(3)}`, "ARROWS/WASD - Move"],
    [`Record: ${String(programState.bestScore).padStart(3)}`, "ENTER/R - Restart"],
    ["", "ESC - Exit"]
  ], { width: boardWidth });
  const statusLine = getStatusLine(programState);
  const blockWidth = Math.max(boardWidth, banner[0].length, footerLines[0].length);
  // баннер + строка статуса + поле с рамкой + пустая строка + таблица
  const blockHeight = banner.length + 1 + (programState.rows + 2) + 1 + footerLines.length;
  const topInset = Math.max(UI_INSET_TOP, Math.floor((ctx.viewportRows - blockHeight) / 2));
  const leftInset = Math.max(UI_INSET_LEFT, Math.floor((ctx.viewportCols - blockWidth) / 2));
  const leftPadding = " ".repeat(leftInset);
  const boardPadding = `${leftPadding}${" ".repeat(Math.floor((blockWidth - boardWidth) / 2))}`;
  const occupied = new Map(programState.snake.map((segment, index) => [`${segment.x}:${segment.y}`, index]));
  const border = fieldBorder(programState.cols);

  for (let i = 0; i < topInset; i += 1) {
    lines.push("");
  }

  banner.forEach((line) => {
    lines.push(`${leftPadding}${centerText(line, blockWidth)}`);
  });
  lines.push("");

  // GAME OVER / WIN - в центре поля, инверсией, чтобы отличаться от фона.
  const message = statusLine ? ` ${statusLine} ` : "";
  const messageRow = Math.floor(programState.rows / 2);
  const messageStart = Math.floor((programState.cols - message.length) / 2);

  lines.push(`${boardPadding}${border.top}`);
  for (let row = 0; row < programState.rows; row += 1) {
    let line = `${boardPadding}${border.side}`;
    for (let col = 0; col < programState.cols; col += 1) {
      if (message && row === messageRow && col === messageStart) {
        line += `<span class="hl">${message}</span>`;
        col += message.length - 1;
        continue;
      }
      const key = `${col}:${row}`;
      if (programState.food && programState.food.x === col && programState.food.y === row) {
        line += "o";
      } else if (occupied.has(key)) {
        line += occupied.get(key) === 0 ? "@" : "#";
      } else {
        line += " ";
      }
    }
    line += border.side;
    lines.push(line);
  }
  lines.push(`${boardPadding}${border.bottom}`);
  lines.push("");
  footerLines.forEach((line) => {
    lines.push(`${leftPadding}${centerText(line, blockWidth)}`);
  });

  return { format: "html", content: lines.join("\n") };
}

function tick(programState, ctx, timestamp) {
  ensureBoard(programState, ctx);
  if (!programState.running || programState.gameOver) {
    return;
  }

  if (!programState.lastStepAt) {
    programState.lastStepAt = timestamp;
  }
  if (timestamp - programState.lastStepAt < getStepInterval(programState, ctx)) {
    return;
  }

  stepSnake(programState);
  programState.lastStepAt = timestamp;
  ctx.persistProgramState("snake");
}

// Символ вдвое выше своей ширины, поэтому шаг по вертикали занимает
// в charHeight/charWidth раз больше времени - визуальная скорость не меняется.
function getStepInterval(state, ctx) {
  const vertical = state.direction === "up" || state.direction === "down";
  if (!vertical) {
    return state.stepIntervalMs;
  }
  const aspect = ctx.charAspect > 0 ? ctx.charAspect : 0.5;
  return state.stepIntervalMs / Math.min(1, Math.max(0.25, aspect));
}

function onKeyDown(programState, ctx, event) {
  if (event.key === "Escape") {
    event.preventDefault();
    exitToMenu(programState, ctx);
    return;
  }

  const nextDirection = mapKeyToDirection(event.key);
  if (nextDirection) {
    event.preventDefault();
    if (programState.gameOver || programState.won) {
      return;
    }
    if (canTurn(programState, nextDirection)) {
      programState.pendingDirection = nextDirection;
      if (!programState.running) {
        programState.running = true;
        programState.lastStepAt = performance.now();
      }
      ctx.persistProgramState("snake");
    }
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    resetRound(programState);
    programState.running = true;
    programState.lastStepAt = performance.now();
    ctx.persistProgramState("snake");
    return;
  }

  if (event.key === "r" || event.key === "R" || event.key === "к" || event.key === "К") {
    event.preventDefault();
    resetRound(programState);
    programState.running = true;
    programState.lastStepAt = performance.now();
    ctx.persistProgramState("snake");
  }
}

function ensureBoard(state, ctx) {
  const metrics = getSnakeMetrics(ctx);
  if (state.cols === metrics.cols && state.rows === metrics.rows) {
    return;
  }

  state.cols = metrics.cols;
  state.rows = metrics.rows;
  resetRound(state);
}

function getSnakeMetrics(ctx) {
  return {
    // Не уже таблицы подсказок: её ширина равна ширине поля.
    cols: Math.max(37, Math.min(42, ctx.viewportCols - 16)),
    rows: Math.max(10, Math.min(18, ctx.viewportRows - 14))
  };
}

function resetRound(state) {
  const centerX = Math.floor(state.cols / 2);
  const centerY = Math.floor(state.rows / 2);
  state.snake = [
    { x: centerX, y: centerY },
    { x: centerX - 1, y: centerY },
    { x: centerX - 2, y: centerY }
  ];
  state.direction = "right";
  state.pendingDirection = "right";
  state.score = 0;
  state.running = false;
  state.gameOver = false;
  state.won = false;
  state.lastStepAt = 0;
  state.food = spawnFood(state);
}

function stepSnake(state) {
  const direction = canTurn(state, state.pendingDirection) ? state.pendingDirection : state.direction;
  state.direction = direction;
  const vector = DIRECTION_VECTORS[direction];
  const head = state.snake[0];
  const nextHead = {
    x: head.x + vector.x,
    y: head.y + vector.y
  };

  const grows = Boolean(state.food && nextHead.x === state.food.x && nextHead.y === state.food.y);
  const bodyToCheck = grows ? state.snake : state.snake.slice(0, -1);
  const hitsWall = nextHead.x < 0 || nextHead.y < 0 || nextHead.x >= state.cols || nextHead.y >= state.rows;
  const hitsBody = bodyToCheck.some((segment) => segment.x === nextHead.x && segment.y === nextHead.y);

  if (hitsWall || hitsBody) {
    state.running = false;
    state.gameOver = true;
    state.won = false;
    state.bestScore = Math.max(state.bestScore, state.score);
    return;
  }

  state.snake.unshift(nextHead);
  if (grows) {
    state.score += 1;
    state.bestScore = Math.max(state.bestScore, state.score);
    state.food = spawnFood(state);
    return;
  }

  state.snake.pop();
}

function spawnFood(state) {
  const occupied = new Set(state.snake.map((segment) => `${segment.x}:${segment.y}`));
  const available = [];
  for (let row = 0; row < state.rows; row += 1) {
    for (let col = 0; col < state.cols; col += 1) {
      const key = `${col}:${row}`;
      if (!occupied.has(key)) {
        available.push({ x: col, y: row });
      }
    }
  }

  if (!available.length) {
    state.running = false;
    state.gameOver = false;
    state.won = true;
    return null;
  }

  return available[Math.floor(Math.random() * available.length)];
}

function getStatusLine(state) {
  if (state.won) {
    return "WIN";
  }
  if (state.gameOver) {
    return "GAME OVER";
  }
  return "";
}

function exitToMenu(programState, ctx) {
  programState.running = false;
  programState.lastStepAt = 0;
  ctx.persistProgramState("snake");
  ctx.returnToMenu();
}

function mapKeyToDirection(key) {
  switch (key) {
    case "ArrowUp":
    case "w":
    case "W":
    case "ц":
    case "Ц":
      return "up";
    case "ArrowDown":
    case "s":
    case "S":
    case "ы":
    case "Ы":
      return "down";
    case "ArrowLeft":
    case "a":
    case "A":
    case "ф":
    case "Ф":
      return "left";
    case "ArrowRight":
    case "d":
    case "D":
    case "в":
    case "В":
      return "right";
    default:
      return null;
  }
}

function canTurn(state, nextDirection) {
  return nextDirection !== OPPOSITE_DIRECTIONS[state.direction] || state.snake.length <= 1;
}

function normalizeInt(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
}

function isDirection(value) {
  return value === "up" || value === "down" || value === "left" || value === "right";
}
