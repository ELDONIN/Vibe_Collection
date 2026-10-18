import { buildHintText, buildTable, composeView, stepIndex } from "../core.js";

// Панель настроек "Reset data". scope понимает ctx.resetData(scope).
const SCOPES = [
  { id: "all", label: "All data" },
  { id: "console", label: "Current colors" },
  { id: "schemes", label: "My combinations" },
  { id: "render3d", label: "Render 3D" },
  { id: "gameoflife", label: "Game of Life" },
  { id: "snake", label: "Snake" }
];
const TABLE_WIDTH = 22;
const YES = 0;
const NO = 1;

export function createResetPanel() {
  return {
    id: "reset",
    label: "Reset data",
    big: true,
    createState,
    enter,
    render,
    onKeyDown,
    activate,
    wantsText: () => false
  };
}

function createState() {
  return { index: 0, confirming: false, button: NO, message: "" };
}

function enter(ps) {
  ps.confirming = false;
  ps.message = "";
}

function render(ps, ctx, view) {
  const message = { lines: [ps.message || " "] };
  if (ps.confirming) {
    return renderConfirm(ps, view, message);
  }

  const table = buildTable([TABLE_WIDTH], ["Data to reset"], SCOPES.map((scope) => [scope.label]));
  const hot = view.hover && view.hover.kind === "scope" ? view.hover.item : (view.kbd ? ps.index : -1);
  const to = table[0].length - 1;
  const marks = [];
  const hits = SCOPES.map((scope, i) => ({ row: 3 + i, from: 1, to, action: { kind: "scope", item: i } }));
  if (hot >= 0) {
    marks.push({ row: 3 + hot, from: 1, to, cls: "hl" });
  }

  const result = composeView([
    { lines: table, marks, hits },
    { lines: [""] },
    message
  ]);
  result.hint = buildHintText([["UP/DOWN - Select", "LMB/ENTER - Reset", "ESC - Back"]]);
  return result;
}

function renderConfirm(ps, view, message) {
  const labels = ["[ Yes ]", "[ No ]"];
  const line = labels.join("   ");
  const marks = [];
  const hits = [];
  let from = 0;
  labels.forEach((label, i) => {
    hits.push({ row: 0, from, to: from + label.length, action: { kind: "confirm", item: i } });
    const hot = view.hover && view.hover.kind === "confirm" ? view.hover.item : ps.button;
    if (hot === i) {
      marks.push({ row: 0, from, to: from + label.length, cls: "hl" });
    }
    from += label.length + 3;
  });

  const result = composeView([
    { lines: [`Reset "${SCOPES[ps.index].label}"?`] },
    { lines: [""] },
    { lines: [line], marks, hits },
    { lines: [""] },
    message
  ]);
  result.hint = buildHintText([["Y - Yes", "N - No", "ESC - Cancel"]]);
  return result;
}

function onKeyDown(ps, ctx, event, api) {
  if (ps.confirming) {
    handleConfirmKey(ps, ctx, event);
    return;
  }

  ps.message = "";
  if (event.key === "Escape") {
    event.preventDefault();
    api.back();
  } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    event.preventDefault();
    ps.index = stepIndex(ps.index, SCOPES.length, event.key === "ArrowDown" ? 1 : -1, api.kbd);
  } else if (event.key === "Enter" && api.kbd) {
    event.preventDefault();
    ask(ps);
  }
}

function ask(ps) {
  ps.confirming = true;
  ps.button = NO;
}

function activate(ps, ctx, action) {
  if (ps.confirming) {
    if (action.kind === "confirm") {
      finish(ps, ctx, action.item === YES);
    }
    return;
  }

  if (action.kind === "scope") {
    ps.index = action.item;
    ask(ps);
  }
}

function finish(ps, ctx, yes) {
  ps.confirming = false;
  if (yes) {
    const scope = SCOPES[ps.index];
    ctx.resetData(scope.id);
    ps.message = `Done: ${scope.label} reset`;
  } else {
    ps.message = "";
  }
}

// Y/N по event.code работают и в русской раскладке.
function handleConfirmKey(ps, ctx, event) {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }

  const key = String(event.key).toLowerCase();
  if (event.code === "KeyY" || key === "y" || key === "н") {
    event.preventDefault();
    finish(ps, ctx, true);
  } else if (event.code === "KeyN" || key === "n" || key === "т" || event.key === "Escape") {
    event.preventDefault();
    finish(ps, ctx, false);
  } else if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "Tab") {
    event.preventDefault();
    ps.button = 1 - ps.button;
  } else if (event.key === "Enter") {
    event.preventDefault();
    finish(ps, ctx, ps.button === YES);
  }
}
