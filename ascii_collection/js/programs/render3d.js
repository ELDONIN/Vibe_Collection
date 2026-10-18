import {
  AUTO_RESUME_MS,
  BANNERS,
  DEFAULT_VIEW_STATE,
  DRAG_BUTTON,
  PALETTE,
  SLIDER_EMPTY,
  SLIDER_FILL,
  buildHintTable,
  buildTable,
  centerText,
  composeView,
  fieldBorder,
  getTerminalCell,
  rowsToHtml,
  stepIndex,
  windowBox
} from "../core.js";

// ---------- 3D math ----------
function dotVec3(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function crossVec3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function normalizeVec3(v) {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}

function scaleVec3(v, scalar) {
  return [v[0] * scalar, v[1] * scalar, v[2] * scalar];
}

function subVec3(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function addVec3(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function clamp(min, max, value) {
  return Math.min(max, Math.max(min, value));
}

function formatSigned(value) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

function quatIdentity() {
  return [0, 0, 0, 1];
}

function quatMultiply(a, b) {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]
  ];
}

function quatNormalize(q) {
  const length = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / length, q[1] / length, q[2] / length, q[3] / length];
}

function quatFromAxisAngle(axis, angle) {
  const unit = normalizeVec3(axis);
  const half = angle * 0.5;
  const sinHalf = Math.sin(half);
  return quatNormalize([
    unit[0] * sinHalf,
    unit[1] * sinHalf,
    unit[2] * sinHalf,
    Math.cos(half)
  ]);
}

function quatFromVectors(from, to) {
  const a = normalizeVec3(from);
  const b = normalizeVec3(to);
  const dot = clamp(-1, 1, dotVec3(a, b));

  if (dot < -0.999999) {
    const axis = normalizeVec3(Math.abs(a[0]) < 0.9 ? crossVec3(a, [1, 0, 0]) : crossVec3(a, [0, 1, 0]));
    return quatFromAxisAngle(axis, Math.PI);
  }

  const cross = crossVec3(a, b);
  return quatNormalize([cross[0], cross[1], cross[2], 1 + dot]);
}

function quatRotateVec3(q, v) {
  const x = v[0];
  const y = v[1];
  const z = v[2];
  const qx = q[0];
  const qy = q[1];
  const qz = q[2];
  const qw = q[3];

  const ix = qw * x + qy * z - qz * y;
  const iy = qw * y + qz * x - qx * z;
  const iz = qw * z + qx * y - qy * x;
  const iw = -qx * x - qy * y - qz * z;

  return [
    ix * qw + iw * -qx + iy * -qz - iz * -qy,
    iy * qw + iw * -qy + iz * -qx - ix * -qz,
    iz * qw + iw * -qz + ix * -qy - iy * -qx
  ];
}

// ---------- figure definitions ----------
function createRangeSlider(id, label, min, max, step, value) {
  return { id, label, min, max, step, value };
}

function createLightingSliders(ambient) {
  return [
    createRangeSlider("light_yaw", "l_yaw", 0, 360, 5, 40),
    createRangeSlider("light_pitch", "l_pit", -90, 90, 5, 40),
    createRangeSlider("ambient", "amb", 0.0, 0.8, 0.05, ambient)
  ];
}

function createFigureDefinition(id, label, category, sliders) {
  return { id, label, category, sliders };
}

const RENDER_CATEGORIES = [
  // Слева полигональные, справа параметрические.
  { id: "polygon", title: "Polygonal" },
  { id: "parametric", title: "Parametric" }
];

const figureTemplates = [
  createFigureDefinition("sphere", "SPHERE", "parametric", [
    createRangeSlider("size", "size", 0.5, 5.0, 0.1, 2.5),
    createRangeSlider("speed", "speed", 0.0, 2.0, 0.1, 0.25),
    createRangeSlider("resolution", "res", 0.3, 1.0, 0.1, 0.8),
    ...createLightingSliders(0.2)
  ]),
  createFigureDefinition("torus", "TORUS", "parametric", [
    createRangeSlider("size", "size", 0.5, 2.5, 0.1, 1.6),
    createRangeSlider("speed", "speed", 0.0, 2.0, 0.1, 0.3),
    createRangeSlider("resolution", "res", 0.3, 1.0, 0.1, 0.7),
    ...createLightingSliders(0.15)
  ]),
  createFigureDefinition("mobius_strip", "MOBIUS STRIP", "parametric", [
    createRangeSlider("size", "size", 0.5, 4.0, 0.1, 2.3),
    createRangeSlider("speed", "speed", 0.0, 2.0, 0.1, 0.35),
    createRangeSlider("resolution", "res", 0.3, 1.0, 0.1, 0.9),
    ...createLightingSliders(0.18)
  ]),
  createFigureDefinition("cube", "CUBE", "polygon", [
    createRangeSlider("size", "size", 0.5, 3.0, 0.1, 1.8),
    createRangeSlider("speed", "speed", 0.0, 2.0, 0.1, 0.3),
    createRangeSlider("resolution", "res", 0.2, 1.0, 0.1, 1.0),
    ...createLightingSliders(0.15)
  ]),
  createFigureDefinition("octahedron", "OCTAHEDRON", "polygon", [
    createRangeSlider("size", "size", 0.5, 5.0, 0.1, 3.2),
    createRangeSlider("speed", "speed", 0.0, 2.0, 0.1, 0.3),
    createRangeSlider("resolution", "res", 0.2, 1.0, 0.1, 1.0),
    ...createLightingSliders(0.15)
  ]),
  createFigureDefinition("icosahedron", "ICOSAHEDRON", "polygon", [
    createRangeSlider("size", "size", 0.5, 5.0, 0.1, 3.0),
    createRangeSlider("speed", "speed", 0.0, 2.0, 0.1, 0.3),
    createRangeSlider("resolution", "res", 0.2, 1.0, 0.1, 1.0),
    ...createLightingSliders(0.14)
  ]),
  createFigureDefinition("star_polyhedron", "STAR POLY", "polygon", [
    createRangeSlider("size", "size", 0.5, 3.0, 0.1, 2.0),
    createRangeSlider("speed", "speed", 0.0, 2.0, 0.1, 0.3),
    createRangeSlider("resolution", "res", 0.2, 1.0, 0.1, 1.0),
    ...createLightingSliders(0.12)
  ])
];

// ---------- polygon meshes ----------
function getMeshCentroid(vertices) {
  if (vertices.length === 0) {
    return [0, 0, 0];
  }

  const sum = vertices.reduce((acc, vertex) => addVec3(acc, vertex), [0, 0, 0]);
  return scaleVec3(sum, 1 / vertices.length);
}

function orientMeshFacesOutward(mesh) {
  const reference = getMeshCentroid(mesh.vertices);
  const faces = mesh.faces.map((face) => {
    const a = mesh.vertices[face[0]];
    const b = mesh.vertices[face[1]];
    const c = mesh.vertices[face[2]];
    const normal = crossVec3(subVec3(b, a), subVec3(c, a));
    const center = scaleVec3(addVec3(addVec3(a, b), c), 1 / 3);
    const direction = subVec3(center, reference);
    return dotVec3(normal, direction) >= 0 ? face : [face[0], face[2], face[1]];
  });

  return { ...mesh, faces };
}

function createCubeMesh() {
  const vertices = [
    [-1, -1, -1],
    [1, -1, -1],
    [1, 1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
    [1, -1, 1],
    [1, 1, 1],
    [-1, 1, 1]
  ];

  const faces = [
    [0, 2, 1], [0, 3, 2],
    [4, 5, 6], [4, 6, 7],
    [0, 1, 5], [0, 5, 4],
    [1, 2, 6], [1, 6, 5],
    [2, 3, 7], [2, 7, 6],
    [3, 0, 4], [3, 4, 7]
  ];

  return orientMeshFacesOutward({ vertices, faces });
}

function createOctahedronMesh() {
  const vertices = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1]
  ];

  const faces = [
    [0, 2, 4],
    [4, 2, 1],
    [1, 2, 5],
    [5, 2, 0],
    [4, 3, 0],
    [1, 3, 4],
    [5, 3, 1],
    [0, 3, 5]
  ];

  return { vertices, faces };
}

function createSphereMesh() {
  const latSteps = 18;
  const lonSteps = 28;
  const vertices = [];
  const faces = [];

  for (let lat = 0; lat <= latSteps; lat += 1) {
    const theta = (lat / latSteps) * Math.PI;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let lon = 0; lon < lonSteps; lon += 1) {
      const phi = (lon / lonSteps) * Math.PI * 2;
      vertices.push([
        sinTheta * Math.cos(phi),
        cosTheta,
        sinTheta * Math.sin(phi)
      ]);
    }
  }

  for (let lat = 0; lat < latSteps; lat += 1) {
    for (let lon = 0; lon < lonSteps; lon += 1) {
      const nextLon = (lon + 1) % lonSteps;
      const a = lat * lonSteps + lon;
      const b = lat * lonSteps + nextLon;
      const c = (lat + 1) * lonSteps + lon;
      const d = (lat + 1) * lonSteps + nextLon;

      if (lat > 0) {
        faces.push([a, c, b]);
      }
      if (lat < latSteps - 1) {
        faces.push([b, c, d]);
      }
    }
  }

  return orientMeshFacesOutward({ vertices, faces });
}

function createMobiusStripMesh() {
  const uSteps = 52;
  const vSteps = 12;
  const vertices = [];
  const faces = [];

  for (let uIndex = 0; uIndex < uSteps; uIndex += 1) {
    const u = (uIndex / uSteps) * Math.PI * 2;
    const cosU = Math.cos(u);
    const sinU = Math.sin(u);
    const cosHalfU = Math.cos(u * 0.5);
    const sinHalfU = Math.sin(u * 0.5);

    for (let vIndex = 0; vIndex <= vSteps; vIndex += 1) {
      const v = -0.42 + (vIndex / vSteps) * 0.84;
      const radius = 1 + v * cosHalfU;
      vertices.push([
        radius * cosU,
        v * sinHalfU * 1.15,
        radius * sinU
      ]);
    }
  }

  for (let uIndex = 0; uIndex < uSteps; uIndex += 1) {
    const nextU = (uIndex + 1) % uSteps;
    for (let vIndex = 0; vIndex < vSteps; vIndex += 1) {
      const a = uIndex * (vSteps + 1) + vIndex;
      const b = a + 1;
      const nextVIndex = nextU === 0 ? vSteps - vIndex : vIndex;
      const c = nextU * (vSteps + 1) + nextVIndex;
      const d = c + (nextU === 0 ? -1 : 1);
      faces.push([a, c, b]);
      faces.push([b, c, d]);
    }
  }

  return { vertices, faces, doubleSided: true };
}

function createStarPolyhedronMesh() {
  const vertices = [
    [0, 0, 1.7],
    [0, 0, -1.7],
    [1.7, 0, 0],
    [-1.7, 0, 0],
    [0, 1.7, 0],
    [0, -1.7, 0],
    [0.55, 0.55, 0.55],
    [0.55, 0.55, -0.55],
    [0.55, -0.55, 0.55],
    [0.55, -0.55, -0.55],
    [-0.55, 0.55, 0.55],
    [-0.55, 0.55, -0.55],
    [-0.55, -0.55, 0.55],
    [-0.55, -0.55, -0.55]
  ];

  const faces = [
    [0, 6, 8], [0, 8, 12], [0, 12, 10], [0, 10, 6],
    [1, 9, 7], [1, 13, 9], [1, 11, 13], [1, 7, 11],
    [2, 6, 7], [2, 7, 9], [2, 9, 8], [2, 8, 6],
    [3, 11, 10], [3, 13, 11], [3, 12, 13], [3, 10, 12],
    [4, 10, 11], [4, 11, 7], [4, 7, 6], [4, 6, 10],
    [5, 8, 9], [5, 9, 13], [5, 13, 12], [5, 12, 8]
  ];

  return orientMeshFacesOutward({ vertices, faces });
}

function createIcosahedronMesh() {
  const phi = (1 + Math.sqrt(5)) * 0.5;
  const vertices = [
    [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
    [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
    [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1]
  ].map(normalizeVec3);

  const faces = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]
  ];

  return orientMeshFacesOutward({ vertices, faces });
}

const meshLibrary = {
  cube: createCubeMesh(),
  octahedron: createOctahedronMesh(),
  sphere: createSphereMesh(),
  mobius_strip: createMobiusStripMesh(),
  star_polyhedron: createStarPolyhedronMesh(),
  icosahedron: createIcosahedronMesh()
};

// ---------- program ----------
const figureRenderers = {
  sphere: renderSphere,
  mobius_strip: renderMobiusStrip,
  torus: renderTorus
};

export function createRender3DProgram() {
  return {
    id: "render3d",
    label: "Render 3D",
    createState,
    restoreState,
    serializeState,
    getHelpLines,
    enter,
    leave,
    render,
    tick,
    onKeyDown,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onWheel,
    onDoubleClick
  };
}

function createState() {
  return {
    mode: "menu",
    figures: cloneFigures(),
    menuIndex: 0,
    menuHover: -1, // фигура под мышью
    menuKbd: false, // выбор стрелками виден, пока мышь не сдвинули
    menuHits: [],
    helpVisible: false,
    sliderIndex: 0,
    settingsVisible: false,
    currentFigureId: null,
    renderCols: 100,
    renderRows: 28,
    charAspect: 0.5,
    userQuat: quatIdentity(),
    autoQuat: quatIdentity(),
    panX: 0,
    panY: 0,
    zoom: DEFAULT_VIEW_STATE.zoom,
    userInteracting: false,
    dragging: null,
    dragVector: null,
    lastPointerX: 0,
    lastPointerY: 0,
    autoRotateEnabled: true,
    autoRotateResumeAt: 0
  };
}

function restoreState(savedState, options = {}) {
  const state = createState();
  if (savedState && typeof savedState === "object") {
    state.mode = savedState.mode === "render" ? "render" : "menu";
    state.menuIndex = typeof savedState.menuIndex === "number" ? Math.floor(savedState.menuIndex) : 0;
    state.helpVisible = Boolean(savedState.helpVisible);
    state.sliderIndex = typeof savedState.sliderIndex === "number" ? Math.floor(savedState.sliderIndex) : 0;
    state.settingsVisible = Boolean(savedState.settingsVisible);
    state.currentFigureId = typeof savedState.currentFigureId === "string" ? savedState.currentFigureId : null;
    state.userQuat = normalizeSavedQuat(savedState.userQuat);
    state.autoQuat = normalizeSavedQuat(savedState.autoQuat);
    state.panX = typeof savedState.panX === "number" ? savedState.panX : DEFAULT_VIEW_STATE.panX;
    state.panY = typeof savedState.panY === "number" ? savedState.panY : DEFAULT_VIEW_STATE.panY;
    state.zoom = typeof savedState.zoom === "number" ? clamp(3.2, 11.5, savedState.zoom) : DEFAULT_VIEW_STATE.zoom;
    restoreFigureState(state.figures, savedState.figures);
  }

  if (options.legacyFigureSettings && (!savedState || !savedState.figures)) {
    restoreFigureState(state.figures, options.legacyFigureSettings);
  }

  const figure = getFigureById(state, state.currentFigureId);
  if (!figure) {
    state.mode = "menu";
    state.currentFigureId = null;
    state.helpVisible = false;
    state.settingsVisible = false;
    state.sliderIndex = 0;
  } else {
    state.menuIndex = getMenuFigures(state).findIndex((item) => item.id === figure.id);
    state.sliderIndex = clamp(0, Math.max(0, figure.sliders.length - 1), state.sliderIndex);
  }

  state.menuIndex = clamp(0, Math.max(0, state.figures.length - 1), state.menuIndex);

  return state;
}

function serializeState(state) {
  return {
    mode: state.mode,
    menuIndex: state.menuIndex,
    helpVisible: state.helpVisible,
    sliderIndex: state.sliderIndex,
    settingsVisible: state.settingsVisible,
    currentFigureId: state.currentFigureId,
    userQuat: state.userQuat.slice(),
    autoQuat: state.autoQuat.slice(),
    panX: state.panX,
    panY: state.panY,
    zoom: state.zoom,
    figures: serializeFigureState(state.figures)
  };
}

function getHelpLines() {
  return [
    ...buildTable([14, 17], ["Menu key", "Action"], [
      ["UP / DOWN", "choose figure"],
      ["ENTER", "open figure"],
      ["H", "this help"],
      ["ESC", "back"]
    ]),
    "",
    ...buildTable([14, 17], ["Figure input", "Action"], [
      ["LMB drag", "arcball rotate"],
      ["RMB or MMB", "pan"],
      ["Wheel", "zoom"],
      ["Double LMB", "reset view"],
      ["S", "open settings"],
      ["H", "this help"],
      ["ESC", "close or go back"]
    ]),
    "",
    ...buildTable([14, 33], ["Light param", "Effect"], [
      ["l_yaw", "light turn around, 0..360"],
      ["l_pit", "light height, -90..90"],
      ["amb", "ambient light, 0..0.8"]
    ])
  ];
}

function enter(state, ctx) {
  state.mode = "menu";
  state.currentFigureId = null;
  state.helpVisible = false;
  state.settingsVisible = false;
  state.sliderIndex = 0;
  state.menuHover = -1;
  state.menuKbd = false;
  ctx.setActiveProgram("render3d");
  ctx.persistProgramState("render3d");
  ctx.persistUiState();
}

function render(state, ctx) {
  if (state.mode === "menu") {
    return { format: "html", content: renderMenuView(state, ctx) };
  }

  return { format: "text", content: renderRenderView(state, ctx) };
}

function tick(state, ctx, _timestamp, deltaSeconds) {
  if (state.mode !== "render") {
    return;
  }
  updateAutoRotation(state, deltaSeconds, performance.now());
}

function onKeyDown(state, ctx, event) {
  if (state.mode === "menu") {
    handleMenuKeys(state, ctx, event);
    return;
  }

  handleRenderKeys(state, ctx, event);
}

function menuHitAt(state, ctx, event) {
  const cell = getTerminalCell(ctx, event.clientX, event.clientY);
  if (!cell || state.helpVisible) {
    return -1;
  }
  const hit = state.menuHits.find((item) => item.row === cell.row && cell.col >= item.from && cell.col < item.to);
  return hit ? hit.index : -1;
}

function onPointerDown(state, ctx, event) {
  if (state.mode === "menu") {
    const index = menuHitAt(state, ctx, event);
    if (event.button === 0 && index >= 0) {
      event.preventDefault();
      startFigure(state, ctx, getMenuFigures(state)[index].id);
    }
    return;
  }

  if (state.mode !== "render") {
    return;
  }

  if (event.button === DRAG_BUTTON.ROTATE) {
    state.dragging = "rotate";
    state.userInteracting = true;
    state.dragVector = projectArcballVector(event.clientX, event.clientY, event.currentTarget);
    pauseAutoRotate(state);
    return;
  }

  if (event.button === DRAG_BUTTON.PAN_MIDDLE || event.button === DRAG_BUTTON.PAN_RIGHT) {
    state.dragging = "pan";
    state.userInteracting = true;
    state.lastPointerX = event.clientX;
    state.lastPointerY = event.clientY;
    pauseAutoRotate(state);
  }
}

function onPointerMove(state, ctx, event) {
  if (state.mode === "menu") {
    state.menuHover = menuHitAt(state, ctx, event);
    state.menuKbd = false;
    ctx.terminal.style.cursor = state.menuHover >= 0 ? "pointer" : "default";
    return;
  }

  if (state.mode !== "render" || !state.dragging) {
    return;
  }

  if (state.dragging === "rotate") {
    const nextVector = projectArcballVector(event.clientX, event.clientY, event.currentTarget || event.target);
    const deltaQuat = quatFromVectors(nextVector, state.dragVector);
    state.userQuat = quatNormalize(quatMultiply(deltaQuat, state.userQuat));
    state.dragVector = nextVector;
    pauseAutoRotate(state);
    return;
  }

  const rect = event.currentTarget.getBoundingClientRect();
  const dx = event.clientX - state.lastPointerX;
  const dy = event.clientY - state.lastPointerY;
  const panFactor = state.zoom / Math.max(120, Math.min(rect.width, rect.height));
  state.panX += dx * panFactor * 0.75;
  state.panY -= dy * panFactor * 0.75;
  state.lastPointerX = event.clientX;
  state.lastPointerY = event.clientY;
  pauseAutoRotate(state);
}

function onPointerUp(state) {
  if (state.dragging) {
    state.userInteracting = false;
    scheduleAutoRotateResume(state);
  }
  state.dragging = null;
  state.dragVector = null;
}

function onWheel(state, _ctx, event) {
  if (state.mode !== "render") {
    return;
  }

  event.preventDefault();
  const delta = Math.sign(event.deltaY);
  state.zoom = clamp(3.2, 11.5, state.zoom + delta * 0.35);
  scheduleAutoRotateResume(state);
}

function onDoubleClick(state) {
  if (state.mode !== "render") {
    return;
  }

  resetView(state);
}

function renderMenuView(state, ctx) {
  const figures = getMenuFigures(state);
  const banner = BANNERS.render3d;
  const labelWidth = Math.max(16, ...figures.map((figure) => figure.label.length));
  const hot = state.menuHover >= 0 ? state.menuHover : (state.menuKbd ? state.menuIndex : -1);

  // По таблице из одного столбца на каждую группу фигур; выбранная строка инвертируется.
  // Таблицы групп стоят рядом по горизонтали.
  const GROUP_GAP = 4;
  const tables = [];
  const tableMarks = [];
  const tableHits = [];
  let offset = 0;
  let x = 0;
  RENDER_CATEGORIES.forEach((category) => {
    const group = figures.filter((figure) => figure.category === category.id);
    const table = buildTable([labelWidth], [category.title], group.map((figure) => [figure.label]));
    const width = table[0].length;
    group.forEach((figure, i) => {
      tableHits.push({ row: 3 + i, from: x + 1, to: x + width - 1, action: offset + i });
    });
    if (hot >= offset && hot < offset + group.length) {
      tableMarks.push({ row: 3 + hot - offset, from: x + 1, to: x + width - 1, cls: "hl" });
    }
    tables.push({ lines: table, width });
    offset += group.length;
    x += width + GROUP_GAP;
  });
  const height = Math.max(...tables.map((table) => table.lines.length));
  const rowsOfTables = Array.from({ length: height }, (item, row) => tables
    .map((table) => (table.lines[row] || "").padEnd(table.width))
    .join(" ".repeat(GROUP_GAP))
    .trimEnd());
  const blocks = [
    { lines: banner },
    { lines: [""] },
    { lines: rowsOfTables, marks: tableMarks, hits: tableHits }
  ];
  blocks.push({ lines: [""] }, {
    lines: buildHintTable([
      ["ARROWS - Select", "LMB/ENTER - Open"],
      ["H - Help", "ESC - Back"]
    ])
  });

  const view = composeView(blocks);
  const topInset = Math.max(1, Math.floor((ctx.viewportRows - view.lines.length) / 2));
  const leftInset = Math.max(2, Math.floor((ctx.viewportCols - view.width) / 2));
  state.menuHits = view.hits.map((hit) => ({
    row: hit.row + topInset,
    from: hit.from + leftInset,
    to: hit.to + leftInset,
    index: hit.action
  }));

  if (state.helpVisible) {
    const canvas = createTextCanvas(ctx.viewportCols, ctx.viewportRows);
    drawTextBlock(canvas, leftInset, topInset, view.lines);
    overlayHelpBox(canvas, getHelpLines());
    return rowsToHtml(canvas);
  }

  const lines = [
    ...new Array(topInset).fill(""),
    ...view.lines.map((line) => " ".repeat(leftInset) + line)
  ];
  const marks = view.marks.map((mark) => ({ ...mark, row: mark.row + topInset, from: mark.from + leftInset, to: mark.to + leftInset }));
  return rowsToHtml(lines, marks);
}

// Фигура в рамке, не на весь экран: поля по бокам, снизу таблица подсказок.
function renderRenderView(state, ctx) {
  const hints = buildHintTable([
    ["LMB - Rotate", "RMB - Pan", "WHEEL - Zoom"],
    ["S - Settings", "H - Help", "ESC - Back"]
  ]);
  const outerWidth = Math.max(46, ctx.viewportCols - 8);
  const outerHeight = Math.max(14, ctx.viewportRows - 2 - hints.length - 1);
  state.renderCols = outerWidth - 2;
  state.renderRows = outerHeight - 2;
  state.charAspect = ctx.charAspect;

  const frame = createFrameBuffer(state.renderCols, state.renderRows);
  renderCurrentFigure(state, frame);
  if (state.settingsVisible) {
    overlaySettings(state, frame);
  }
  if (state.helpVisible) {
    overlayHelpOnFrame(state, frame);
  }

  const border = fieldBorder(state.renderCols);
  const pad = " ".repeat(Math.max(0, Math.floor((ctx.viewportCols - outerWidth) / 2)));
  return [
    "",
    `${pad}${border.top}`,
    ...frame.lines.map((line) => `${pad}${border.side}${line}${border.side}`),
    `${pad}${border.bottom}`,
    "",
    ...hints.map((line) => centerText(line, ctx.viewportCols))
  ].join("\n");
}

function buildSettingsLines(state) {
  const figure = getCurrentFigure(state);
  const lines = [];
  lines.push(`view x=${formatSigned(state.panX)} y=${formatSigned(state.panY)} zoom=${state.zoom.toFixed(2)}`);
  lines.push("");

  figure.sliders.forEach((slider, index) => {
    lines.push(renderSliderLine(state, slider, index === state.sliderIndex));
  });

  return lines;
}

function overlaySettings(state, frame) {
  const content = buildSettingsLines(state);
  const box = windowBox(`settings / ${state.currentFigureId}`, content, {
    minInner: 18,
    maxInner: Math.max(10, frame.width - 6)
  });
  const startX = Math.max(0, Math.floor((frame.width - box[0].length) / 2));
  const startY = Math.max(0, Math.floor((frame.height - box.length) / 2));

  box.forEach((line, index) => {
    drawText(frame, startX, startY + index, line);
  });

  finalizeFrame(frame);
}

function renderSliderLine(state, slider, selected) {
  const width = Math.max(10, Math.min(24, state.renderCols - 28));
  const ratio = (slider.value - slider.min) / (slider.max - slider.min || 1);
  const fill = Math.round(ratio * width);
  const bar = `${SLIDER_FILL.repeat(fill)}${SLIDER_EMPTY.repeat(Math.max(0, width - fill))}`;
  const cursor = selected ? ">" : " ";
  return `${cursor} ${slider.label.padEnd(6, " ")} ${bar} ${slider.value.toFixed(2)}`;
}

function renderCurrentFigure(state, frame) {
  const renderer = figureRenderers[state.currentFigureId];
  if (renderer) {
    renderer(state, frame);
    return;
  }

  const mesh = meshLibrary[state.currentFigureId];
  if (mesh) {
    renderMesh(state, frame, mesh);
  }
}

function createFrameBuffer(width, height) {
  return {
    width,
    height,
    chars: new Array(width * height).fill(" "),
    depth: new Array(width * height).fill(-Infinity),
    lines: []
  };
}

function renderMesh(state, frame, mesh) {
  const size = getSliderValue(state, "size");
  const resolution = getMeshRenderResolution(state);
  const rotation = getSceneQuaternion(state);
  const light = getLightDirection(state);
  const ambient = getAmbientLight(state);
  const transformed = mesh.vertices.map((vertex) => quatRotateVec3(rotation, scaleVec3(vertex, size)));
  const screenVerts = transformed.map((vertex) => projectPoint(state, vertex));

  mesh.faces.forEach((face) => {
    const a = transformed[face[0]];
    const b = transformed[face[1]];
    const c = transformed[face[2]];
    const normal = normalizeVec3(crossVec3(subVec3(b, a), subVec3(c, a)));
    const isBackFace = normal[2] >= 0;
    if (!mesh.doubleSided && isBackFace) {
      return;
    }

    const lightDot = -dotVec3(normal, light);
    const diffuse = Math.max(0, mesh.doubleSided ? Math.abs(lightDot) : lightDot);
    const brightness = clamp(ambient, 1, ambient + diffuse * (1 - ambient));
    rasterizeTriangle(frame, screenVerts[face[0]], screenVerts[face[1]], screenVerts[face[2]], brightness, resolution);
  });

  finalizeFrame(frame);
}

function renderSphere(state, frame) {
  const size = getSliderValue(state, "size");
  const light = getLightDirection(state);
  const ambient = getAmbientLight(state);
  const radius = 1.25 * size;
  const rotation = getSceneQuaternion(state);
  const inverseRotation = quatConjugate(rotation);
  const objectOffset = [state.panX, state.panY, 0];
  const cameraOrigin = getCameraOrigin(state);
  const quality = getSphereRenderResolution(state);

  for (let y = 0; y < frame.height; y += 1) {
    for (let x = 0; x < frame.width; x += 1) {
      let brightnessSum = 0;
      let hitCount = 0;
      let nearestDepth = Infinity;

      for (let sampleIndex = 0; sampleIndex < quality.samples.length; sampleIndex += 1) {
        const sample = quality.samples[sampleIndex];
        const ray = getCameraRay(state, x + sample[0], y + sample[1]);
        const localOrigin = quatRotateVec3(inverseRotation, subVec3(cameraOrigin, objectOffset));
        const localDirection = normalizeVec3(quatRotateVec3(inverseRotation, ray.direction));
        const hitDistance = intersectSphere(localOrigin, localDirection, radius);
        if (hitDistance === null) {
          continue;
        }

        const localPoint = addVec3(localOrigin, scaleVec3(localDirection, hitDistance));
        const localNormal = normalizeVec3(localPoint);
        const worldNormal = normalizeVec3(quatRotateVec3(rotation, localNormal));
        const worldPoint = addVec3(ray.origin, scaleVec3(ray.direction, hitDistance));
        const viewAlignment = Math.max(0, -dotVec3(worldNormal, ray.direction));
        const diffuse = Math.max(0, -dotVec3(worldNormal, light));
        const rim = Math.pow(1 - viewAlignment, 2.4) * 0.22;
        const brightness = clamp(ambient * 0.72, 1, ambient + diffuse * (1 - ambient) * 0.88 + rim);

        brightnessSum += brightness;
        hitCount += 1;
        nearestDepth = Math.min(nearestDepth, worldPoint[2] + state.zoom);
      }

      if (hitCount === 0) {
        continue;
      }

      plotPoint(frame, x, y, nearestDepth, brightnessSum / hitCount);
    }
  }

  finalizeFrame(frame);
}

function renderTorus(state, frame) {
  const size = getSliderValue(state, "size");
  const light = getLightDirection(state);
  const ambient = getAmbientLight(state);
  const quality = getTorusRenderResolution(state);

  renderImplicitSurface(state, frame, {
    distanceEstimator(point) {
      return torusDistance(point, 1.45 * size, 0.58 * size);
    },
    maxSteps: quality.maxSteps,
    surfaceEpsilon: quality.surfaceEpsilon,
    normalDelta: quality.normalDelta,
    stepScale: quality.stepScale,
    getBrightness({ worldNormal, rayDirection }) {
      const viewAlignment = Math.max(0, -dotVec3(worldNormal, rayDirection));
      const diffuse = Math.max(0, -dotVec3(worldNormal, light));
      const rim = Math.pow(1 - viewAlignment, 3.2) * 0.18;
      const specular = Math.pow(Math.max(0, diffuse), 7) * 0.08;
      return clamp(ambient * 0.58, 1, ambient + diffuse * (1 - ambient) * 0.86 + rim + specular);
    }
  });

  finalizeFrame(frame);
}

function renderMobiusStrip(state, frame) {
  const size = getSliderValue(state, "size");
  const light = getLightDirection(state);
  const ambient = getAmbientLight(state);
  const quality = getMobiusRenderResolution(state);
  const rotation = getSceneQuaternion(state);
  const grid = [];

  for (let uIndex = 0; uIndex < quality.uSteps; uIndex += 1) {
    const row = [];
    for (let vIndex = 0; vIndex <= quality.vSteps; vIndex += 1) {
      const sample = sampleMobiusStripSurface(uIndex / quality.uSteps, vIndex / quality.vSteps, size);
      const worldPoint = quatRotateVec3(rotation, sample.point);
      const worldNormal = normalizeVec3(quatRotateVec3(rotation, sample.normal));
      const lightDot = -dotVec3(worldNormal, light);
      const diffuse = Math.max(0, Math.abs(lightDot));
      const brightness = clamp(ambient * 0.72, 1, ambient + diffuse * (1 - ambient) * 0.84 + 0.05 * Math.sin(sample.angle * 6));
      row.push({
        point: worldPoint,
        normal: worldNormal,
        projected: projectPoint(state, worldPoint),
        brightness
      });
    }
    grid.push(row);
  }

  for (let uIndex = 0; uIndex < quality.uSteps; uIndex += 1) {
    const nextU = (uIndex + 1) % quality.uSteps;
    for (let vIndex = 0; vIndex < quality.vSteps; vIndex += 1) {
      const a = grid[uIndex][vIndex];
      const b = grid[uIndex][vIndex + 1];
      const nextVIndex = nextU === 0 ? quality.vSteps - vIndex : vIndex;
      const c = grid[nextU][nextVIndex];
      const d = grid[nextU][nextVIndex + (nextU === 0 ? -1 : 1)];
      rasterizeSurfaceTriangle(frame, a, c, b, { doubleSided: true, resolution: quality.rasterResolution });
      rasterizeSurfaceTriangle(frame, b, c, d, { doubleSided: true, resolution: quality.rasterResolution });
    }
  }

  finalizeFrame(frame);
}

function renderImplicitSurface(state, frame, options) {
  const rotation = getSceneQuaternion(state);
  const inverseRotation = quatConjugate(rotation);
  const cameraOrigin = getCameraOrigin(state);
  const objectOffset = [state.panX, state.panY, 0];

  for (let y = 0; y < frame.height; y += 1) {
    for (let x = 0; x < frame.width; x += 1) {
      const ray = getCameraRay(state, x + 0.5, y + 0.5);
      const localOrigin = quatRotateVec3(inverseRotation, subVec3(cameraOrigin, objectOffset));
      const localDirection = normalizeVec3(quatRotateVec3(inverseRotation, ray.direction));
      const hitDistance = marchRay(localOrigin, localDirection, options.distanceEstimator, options);
      if (hitDistance === null) {
        continue;
      }

      const localPoint = addVec3(localOrigin, scaleVec3(localDirection, hitDistance));
      const localNormal = estimateImplicitNormal(localPoint, options.distanceEstimator, options.normalDelta || 0.03);
      const worldNormal = normalizeVec3(quatRotateVec3(rotation, localNormal));
      const worldPoint = addVec3(ray.origin, scaleVec3(ray.direction, hitDistance));
      const brightness = options.getBrightness({
        localPoint,
        localNormal,
        worldNormal,
        rayDirection: ray.direction,
        distance: hitDistance
      });

      plotPoint(frame, x, y, worldPoint[2] + state.zoom, brightness);
    }
  }
}

function rasterizeSurfaceTriangle(frame, p0, p1, p2, options) {
  const faceNormal = normalizeVec3(crossVec3(subVec3(p1.point, p0.point), subVec3(p2.point, p0.point)));
  if (faceNormal[0] === 0 && faceNormal[1] === 0 && faceNormal[2] === 0) {
    return;
  }

  const isBackFace = faceNormal[2] >= 0;
  if (!options.doubleSided && isBackFace) {
    return;
  }

  const brightness = (p0.brightness + p1.brightness + p2.brightness) / 3;
  rasterizeTriangle(frame, p0.projected, p1.projected, p2.projected, brightness, options.resolution);
}

function projectPoint(state, point) {
  const depth = point[2] + state.zoom;
  const scale = Math.min(state.renderCols, state.renderRows) * 0.72;
  const centerX = (state.renderCols - 1) / 2;
  const centerY = (state.renderRows - 1) / 2;
  const x = centerX + ((point[0] + state.panX) * scale) / (depth * getCharAspect(state));
  const y = centerY - ((point[1] + state.panY) * scale) / depth;
  return { x, y, depth };
}

function rasterizeTriangle(frame, p0, p1, p2, brightness, resolution = 1) {
  if (p0.depth <= 0 || p1.depth <= 0 || p2.depth <= 0) {
    return;
  }

  const minX = Math.max(0, Math.floor(Math.min(p0.x, p1.x, p2.x)));
  const maxX = Math.min(frame.width - 1, Math.ceil(Math.max(p0.x, p1.x, p2.x)));
  const minY = Math.max(0, Math.floor(Math.min(p0.y, p1.y, p2.y)));
  const maxY = Math.min(frame.height - 1, Math.ceil(Math.max(p0.y, p1.y, p2.y)));
  const area = edgeFunction(p0, p1, p2);

  if (Math.abs(area) < 1e-6) {
    return;
  }

  const sampleStep = clamp(0.35, 1.8, 1.45 / resolution);
  for (let y = minY; y <= maxY; y += sampleStep) {
    for (let x = minX; x <= maxX; x += sampleStep) {
      const sample = { x: x + sampleStep * 0.5, y: y + sampleStep * 0.5 };
      const w0 = edgeFunction(p1, p2, sample);
      const w1 = edgeFunction(p2, p0, sample);
      const w2 = edgeFunction(p0, p1, sample);
      const hasSameSign =
        (w0 >= 0 && w1 >= 0 && w2 >= 0) ||
        (w0 <= 0 && w1 <= 0 && w2 <= 0);

      if (!hasSameSign) {
        continue;
      }

      const b0 = w0 / area;
      const b1 = w1 / area;
      const b2 = w2 / area;
      const depth = b0 * p0.depth + b1 * p1.depth + b2 * p2.depth;
      plotPoint(frame, x, y, depth, brightness);
    }
  }
}

function plotPoint(frame, x, y, depth, brightness) {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || ix >= frame.width || iy < 0 || iy >= frame.height || depth <= 0) {
    return;
  }

  const index = iy * frame.width + ix;
  const invDepth = 1 / depth;
  if (invDepth <= frame.depth[index]) {
    return;
  }

  frame.depth[index] = invDepth;
  const paletteIndex = Math.max(0, Math.min(PALETTE.length - 1, Math.round(brightness * (PALETTE.length - 1))));
  frame.chars[index] = PALETTE[paletteIndex];
}

function finalizeFrame(frame) {
  frame.lines = [];
  for (let y = 0; y < frame.height; y += 1) {
    frame.lines.push(frame.chars.slice(y * frame.width, (y + 1) * frame.width).join(""));
  }
}

function drawText(frame, x, y, text) {
  if (y < 0 || y >= frame.height) {
    return;
  }

  for (let i = 0; i < text.length; i += 1) {
    const px = x + i;
    if (px < 0 || px >= frame.width) {
      continue;
    }

    const index = y * frame.width + px;
    frame.chars[index] = text[i];
    frame.depth[index] = Infinity;
  }
}

function getCameraOrigin(state) {
  return [0, 0, -state.zoom];
}

function getCameraRay(state, sampleX, sampleY) {
  const scale = Math.min(state.renderCols, state.renderRows) * 0.72;
  const centerX = (state.renderCols - 1) / 2;
  const centerY = (state.renderRows - 1) / 2;
  const screenX = ((sampleX - centerX) * getCharAspect(state)) / scale;
  const screenY = (centerY - sampleY) / scale;
  return { origin: getCameraOrigin(state), direction: normalizeVec3([screenX, screenY, 1]) };
}

function quatConjugate(q) {
  return [-q[0], -q[1], -q[2], q[3]];
}

function intersectSphere(origin, direction, radius) {
  const b = 2 * dotVec3(origin, direction);
  const c = dotVec3(origin, origin) - radius * radius;
  const discriminant = b * b - 4 * c;
  if (discriminant < 0) {
    return null;
  }

  const root = Math.sqrt(discriminant);
  const near = (-b - root) * 0.5;
  if (near > 0.001) {
    return near;
  }

  const far = (-b + root) * 0.5;
  return far > 0.001 ? far : null;
}

function marchRay(origin, direction, distanceEstimator, options = {}) {
  const maxSteps = options.maxSteps || 72;
  const maxDistance = options.maxDistance || 32;
  const surfaceEpsilon = options.surfaceEpsilon || 0.02;
  const minStep = options.minStep || 0.012;
  const stepScale = options.stepScale || 0.85;
  let distance = 0;

  for (let step = 0; step < maxSteps && distance <= maxDistance; step += 1) {
    const point = addVec3(origin, scaleVec3(direction, distance));
    const surfaceDistance = distanceEstimator(point);
    if (Math.abs(surfaceDistance) < surfaceEpsilon) {
      return distance;
    }
    distance += Math.max(minStep, surfaceDistance * stepScale);
  }

  return null;
}

function estimateImplicitNormal(point, distanceEstimator, delta) {
  const dx = distanceEstimator([point[0] + delta, point[1], point[2]]) - distanceEstimator([point[0] - delta, point[1], point[2]]);
  const dy = distanceEstimator([point[0], point[1] + delta, point[2]]) - distanceEstimator([point[0], point[1] - delta, point[2]]);
  const dz = distanceEstimator([point[0], point[1], point[2] + delta]) - distanceEstimator([point[0], point[1], point[2] - delta]);
  return normalizeVec3([dx, dy, dz]);
}

function torusDistance(point, majorRadius, minorRadius) {
  const radialDistance = Math.hypot(point[0], point[2]);
  return Math.hypot(radialDistance - majorRadius, point[1]) - minorRadius;
}

function sampleMobiusStripSurface(u, v, size) {
  const angle = u * Math.PI * 2;
  const stripV = (-0.42 + v * 0.84) * size;
  const cosAngle = Math.cos(angle);
  const sinAngle = Math.sin(angle);
  const halfAngle = angle * 0.5;
  const cosHalfAngle = Math.cos(halfAngle);
  const sinHalfAngle = Math.sin(halfAngle);
  const radius = size + stripV * cosHalfAngle;
  const point = [radius * cosAngle, stripV * sinHalfAngle * 1.15, radius * sinAngle];
  const tangentU = [
    -(size + stripV * cosHalfAngle) * sinAngle - 0.5 * stripV * sinHalfAngle * cosAngle,
    0.5 * stripV * cosHalfAngle * 1.15,
    (size + stripV * cosHalfAngle) * cosAngle - 0.5 * stripV * sinHalfAngle * sinAngle
  ];
  const tangentV = [cosHalfAngle * cosAngle, sinHalfAngle * 1.15, cosHalfAngle * sinAngle];
  return { point, normal: normalizeVec3(crossVec3(tangentV, tangentU)), angle };
}

function handleMenuKeys(state, ctx, event) {
  if (isKey(event, "h", "р")) {
    state.helpVisible = !state.helpVisible;
    ctx.persistProgramState("render3d");
    return;
  }

  if (state.helpVisible && event.key === "Escape") {
    state.helpVisible = false;
    ctx.persistProgramState("render3d");
    return;
  }

  if (state.helpVisible) {
    return;
  }

  const figures = getMenuFigures(state);

  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    event.preventDefault();
    state.menuIndex = stepIndex(state.menuIndex, figures.length, event.key === "ArrowDown" ? 1 : -1, state.menuKbd);
    state.menuKbd = true;
    state.menuHover = -1;
    ctx.persistProgramState("render3d");
    return;
  }

  if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && state.menuKbd) {
    // Между таблицами: та же строка в соседней группе.
    event.preventDefault();
    const groups = RENDER_CATEGORIES.map((category) => figures.filter((figure) => figure.category === category.id));
    const current = figures[state.menuIndex];
    const groupIndex = RENDER_CATEGORIES.findIndex((category) => category.id === current.category);
    const target = groups[(groupIndex + (event.key === "ArrowRight" ? 1 : groups.length - 1)) % groups.length];
    const row = Math.min(groups[groupIndex].indexOf(current), target.length - 1);
    state.menuIndex = figures.indexOf(target[row]);
    ctx.persistProgramState("render3d");
    return;
  }

  if (event.key === "Enter" && state.menuKbd) {
    event.preventDefault();
    startFigure(state, ctx, figures[state.menuIndex].id);
    return;
  }

  if (event.key === "Escape") {
    state.currentFigureId = null;
    ctx.persistProgramState("render3d");
    ctx.returnToMenu();
  }
}

function isKey(event, latin, cyrillic) {
  return event.key === latin
    || event.key === latin.toUpperCase()
    || event.key === cyrillic
    || event.key === cyrillic.toUpperCase();
}

// Фигуры в порядке показа в меню: группа за группой.
function getMenuFigures(state) {
  return RENDER_CATEGORIES.flatMap((category) => state.figures.filter((figure) => figure.category === category.id));
}

function handleRenderKeys(state, ctx, event) {
  const figure = getCurrentFigure(state);
  if (isKey(event, "h", "р")) {
    state.helpVisible = !state.helpVisible;
    ctx.persistProgramState("render3d");
    return;
  }

  if (state.helpVisible) {
    // Справка перекрывает настройки и забирает управление, пока открыта.
    if (event.key === "Escape") {
      state.helpVisible = false;
      ctx.persistProgramState("render3d");
    }
    return;
  }

  if (isKey(event, "s", "ы")) {
    state.settingsVisible = !state.settingsVisible;
    ctx.persistProgramState("render3d");
    return;
  }

  if (event.key === "Escape") {
    if (state.settingsVisible) {
      state.settingsVisible = false;
      ctx.persistProgramState("render3d");
      return;
    }
    state.mode = "menu";
    state.currentFigureId = null;
    state.sliderIndex = 0;
    state.settingsVisible = false;
    state.menuKbd = false;
    state.menuHover = -1;
    ctx.persistProgramState("render3d");
    ctx.persistUiState();
    return;
  }

  if (!state.settingsVisible) {
    return;
  }

  if (event.key === "ArrowUp") {
    state.sliderIndex = (state.sliderIndex - 1 + figure.sliders.length) % figure.sliders.length;
    ctx.persistProgramState("render3d");
    return;
  }

  if (event.key === "ArrowDown") {
    state.sliderIndex = (state.sliderIndex + 1) % figure.sliders.length;
    ctx.persistProgramState("render3d");
    return;
  }

  if (event.key === "ArrowLeft") {
    adjustSlider(state, ctx, figure.sliders[state.sliderIndex], -1);
    return;
  }

  if (event.key === "ArrowRight") {
    adjustSlider(state, ctx, figure.sliders[state.sliderIndex], 1);
  }
}

// Выход кликом по панели вкладок: в следующий раз игра открывается с меню фигур.
function leave(state, ctx) {
  state.mode = "menu";
  state.currentFigureId = null;
  state.helpVisible = false;
  state.settingsVisible = false;
  state.dragging = null;
  state.menuKbd = false;
  state.menuHover = -1;
  ctx.persistProgramState("render3d");
}

function startFigure(state, ctx, figureId) {
  state.menuIndex = Math.max(0, getMenuFigures(state).findIndex((item) => item.id === figureId));
  state.currentFigureId = figureId;
  state.mode = "render";
  state.helpVisible = false;
  state.sliderIndex = 0;
  state.settingsVisible = false;
  resetView(state);
  ctx.persistProgramState("render3d");
  ctx.persistUiState();
}

function createTextCanvas(width, height) {
  return new Array(height).fill(null).map(() => " ".repeat(Math.max(0, width)));
}

function drawTextBlock(canvas, startX, startY, lines) {
  lines.forEach((line, index) => {
    const y = startY + index;
    if (y < 0 || y >= canvas.length) {
      return;
    }
    canvas[y] = replaceAt(canvas[y], startX, line);
  });
}

function overlayHelpBox(canvas, content) {
  const box = windowBox("HELP", content, { maxInner: Math.max(10, canvas[0].length - 6) });
  const startX = Math.max(0, Math.floor((canvas[0].length - box[0].length) / 2));
  const startY = Math.max(0, Math.floor((canvas.length - box.length) / 2));

  box.forEach((line, index) => {
    const y = startY + index;
    if (y < canvas.length) {
      canvas[y] = replaceAt(canvas[y], startX, line);
    }
  });
}

// Справка поверх фигуры; рисуется после настроек и перекрывает их окно.
function overlayHelpOnFrame(state, frame) {
  const box = windowBox("HELP", getHelpLines(), { maxInner: Math.max(10, frame.width - 6) });
  const startX = Math.max(0, Math.floor((frame.width - box[0].length) / 2));
  const startY = Math.max(0, Math.floor((frame.height - box.length) / 2));

  box.forEach((line, index) => {
    drawText(frame, startX, startY + index, line);
  });

  finalizeFrame(frame);
}

function replaceAt(line, startX, fragment) {
  if (startX >= line.length || fragment.length === 0) {
    return line;
  }
  const prefix = line.slice(0, Math.max(0, startX));
  const clipped = fragment.slice(0, Math.max(0, line.length - startX));
  const suffix = line.slice(startX + clipped.length);
  return `${prefix}${clipped}${suffix}`;
}

function resetView(state) {
  state.userQuat = quatIdentity();
  state.autoQuat = quatIdentity();
  state.panX = DEFAULT_VIEW_STATE.panX;
  state.panY = DEFAULT_VIEW_STATE.panY;
  state.zoom = DEFAULT_VIEW_STATE.zoom;
  state.userInteracting = false;
  state.autoRotateEnabled = true;
  state.autoRotateResumeAt = 0;
}

function updateAutoRotation(state, deltaSeconds, timestamp) {
  if (state.userInteracting) {
    return;
  }

  if (!state.autoRotateEnabled && timestamp >= state.autoRotateResumeAt) {
    state.autoRotateEnabled = true;
  }

  if (!state.autoRotateEnabled) {
    return;
  }

  const speed = getSliderValue(state, "speed");
  if (speed <= 0) {
    return;
  }

  const yaw = quatFromAxisAngle([0, 1, 0], deltaSeconds * (0.65 + speed * 0.85));
  const pitch = quatFromAxisAngle([1, 0, 0], deltaSeconds * (0.3 + speed * 0.45));
  state.autoQuat = quatNormalize(quatMultiply(yaw, quatMultiply(pitch, state.autoQuat)));
}

function pauseAutoRotate(state) {
  state.autoRotateEnabled = false;
}

function scheduleAutoRotateResume(state) {
  state.autoRotateEnabled = false;
  state.autoRotateResumeAt = performance.now() + AUTO_RESUME_MS;
}

function adjustSlider(state, ctx, slider, direction) {
  slider.value = clamp(slider.min, slider.max, slider.value + slider.step * direction);
  ctx.persistProgramState("render3d");
}

function getCurrentFigure(state) {
  return getFigureById(state, state.currentFigureId) || state.figures[0];
}

function getFigureById(state, figureId) {
  return state.figures.find((figure) => figure.id === figureId) || null;
}

function getSliderValue(state, sliderId, figure = getCurrentFigure(state)) {
  const slider = figure.sliders.find((item) => item.id === sliderId);
  return slider ? slider.value : 0;
}

function getLightDirection(state) {
  const yaw = (normalizeAngle360(getSliderValue(state, "light_yaw")) * Math.PI) / 180;
  const pitch = (clamp(-90, 90, getSliderValue(state, "light_pitch")) * Math.PI) / 180;
  const cosPitch = Math.cos(pitch);
  return normalizeVec3([-Math.sin(yaw) * cosPitch, -Math.sin(pitch), Math.cos(yaw) * cosPitch]);
}

function getAmbientLight(state) {
  return clamp(0, 0.8, getSliderValue(state, "ambient"));
}

function getCharAspect(state) {
  return clamp(0.1, 2, state.charAspect || 0.5);
}

function getSphereRenderResolution(state) {
  const resolution = getSliderValue(state, "resolution");
  const sampleGrid = resolution >= 0.9 ? 3 : resolution >= 0.55 ? 2 : 1;
  return { sampleGrid, samples: createSubpixelOffsets(sampleGrid) };
}

function getTorusRenderResolution(state) {
  const resolution = getSliderValue(state, "resolution");
  return {
    maxSteps: Math.round(42 + resolution * 74),
    surfaceEpsilon: 0.038 - resolution * 0.02,
    normalDelta: 0.045 - resolution * 0.018,
    stepScale: 0.78 + resolution * 0.1
  };
}

function getMobiusRenderResolution(state) {
  const resolution = getSliderValue(state, "resolution");
  return {
    uSteps: Math.round(52 + resolution * 92),
    vSteps: Math.round(6 + resolution * 18),
    rasterResolution: 0.65 + resolution * 1.7
  };
}

function getMeshRenderResolution(state) {
  return getSliderValue(state, "resolution") * 2;
}

function createSubpixelOffsets(sampleGrid) {
  const offsets = [];
  for (let y = 0; y < sampleGrid; y += 1) {
    for (let x = 0; x < sampleGrid; x += 1) {
      offsets.push([(x + 0.5) / sampleGrid, (y + 0.5) / sampleGrid]);
    }
  }
  return offsets;
}

function getSceneQuaternion(state) {
  return quatNormalize(quatMultiply(state.userQuat, state.autoQuat));
}

function edgeFunction(a, b, c) {
  return (c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x);
}

function projectArcballVector(clientX, clientY, target) {
  const rect = target.getBoundingClientRect();
  const size = Math.max(1, Math.min(rect.width, rect.height));
  const x = ((clientX - rect.left) / rect.width) * 2 - 1;
  const y = 1 - ((clientY - rect.top) / rect.height) * 2;
  const scaledX = (x * rect.width) / size;
  const scaledY = (y * rect.height) / size;
  const lengthSq = scaledX * scaledX + scaledY * scaledY;

  if (lengthSq > 1) {
    const invLength = 1 / Math.sqrt(lengthSq);
    return [scaledX * invLength, scaledY * invLength, 0];
  }

  return [scaledX, scaledY, Math.sqrt(1 - lengthSq)];
}

function cloneFigures() {
  return figureTemplates.map((figure) => ({
    ...figure,
    sliders: figure.sliders.map((slider) => ({ ...slider }))
  }));
}

function serializeFigureState(figures) {
  const payload = {};
  figures.forEach((figure) => {
    payload[figure.id] = {};
    figure.sliders.forEach((slider) => {
      payload[figure.id][slider.id] = slider.value;
    });
  });
  return payload;
}

function restoreFigureState(figures, savedFigures) {
  if (!savedFigures || typeof savedFigures !== "object") {
    return;
  }

  figures.forEach((figure) => {
    const savedFigure = savedFigures[figure.id];
    if (!savedFigure || typeof savedFigure !== "object") {
      return;
    }

    figure.sliders.forEach((slider) => {
      const savedValue = savedFigure[slider.id];
      if (typeof savedValue !== "number" || Number.isNaN(savedValue)) {
        return;
      }
      slider.value = clamp(slider.min, slider.max, normalizeSliderValue(slider.id, savedValue));
    });
  });
}

function normalizeSliderValue(id, value) {
  if (id === "light_yaw") {
    return normalizeAngle360(value);
  }

  if (id === "light_pitch") {
    return clamp(-90, 90, value);
  }

  return value;
}

function normalizeAngle360(value) {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function normalizeSavedQuat(value) {
  if (!Array.isArray(value) || value.length !== 4 || value.some((item) => typeof item !== "number" || Number.isNaN(item))) {
    return quatIdentity();
  }
  return quatNormalize(value);
}
