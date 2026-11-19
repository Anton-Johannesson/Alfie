// Demo measurements remain separate from the editable floor-plan model.
// Switch DATA_MODE to "live" after implementing the contract in /backend/README.md.
const DATA_MODE = "demo";
const API_BASE = "/api";
const LAYOUT_KEY = "alfie.wifi-layout.v2";
const SVG_NS = "http://www.w3.org/2000/svg";
const defaultLayout = {
  accessPoints: [{ id: "ap-1", x: 380, y: 190, name: "MAIN ROUTER" }],
  rooms: [],
  walls: [],
  metersPerUnit: null,
};

const map = document.querySelector("#floorplan");
const heatmapLayer = document.querySelector("#heatmap-layer");
const roomLayer = document.querySelector("#rooms-layer");
const wallLayer = document.querySelector("#user-walls");
const accessPointLayer = document.querySelector("#user-access-points");
const saveState = document.querySelector("#save-state");
let layout = loadLayout();
let activeTool = "select";
let dragState = null;
let selectedRoomId = null;
let saveTimer;
let toastTimer;

function loadLayout() {
  try {
    const saved = JSON.parse(localStorage.getItem(LAYOUT_KEY));
    if (Array.isArray(saved?.accessPoints) && Array.isArray(saved?.walls)) {
      return {
        accessPoints: saved.accessPoints.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)),
        rooms: Array.isArray(saved.rooms) ? saved.rooms.filter((room) => [room.x, room.y, room.width, room.height].every(Number.isFinite)) : [],
        walls: saved.walls.filter((wall) => [wall.x1, wall.y1, wall.x2, wall.y2].every(Number.isFinite)),
        metersPerUnit: Number.isFinite(saved.metersPerUnit) && saved.metersPerUnit > 0 ? saved.metersPerUnit : null,
      };
    }
  } catch { /* Invalid or unavailable storage falls back to the starter layout. */ }
  return structuredClone(defaultLayout);
}

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}

function pointOnMap(event) {
  const point = map.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const mapped = point.matrixTransform(map.getScreenCTM().inverse());
  return { x: Math.max(90, Math.min(670, mapped.x)), y: Math.max(60, Math.min(320, mapped.y)) };
}

function wallCrosses(x1, y1, x2, y2, wall) {
  const denominator = (x1 - x2) * (wall.y1 - wall.y2) - (y1 - y2) * (wall.x1 - wall.x2);
  if (Math.abs(denominator) < 0.001) return false;
  const t = ((x1 - wall.x1) * (wall.y1 - wall.y2) - (y1 - wall.y1) * (wall.x1 - wall.x2)) / denominator;
  const u = -((x1 - x2) * (y1 - wall.y1) - (y1 - y2) * (wall.x1 - wall.x2)) / denominator;
  return t > 0 && t < 1 && u > 0 && u < 1;
}

function modelWalls() {
  const roomWalls = layout.rooms.flatMap((room) => {
    const { x, y, width, height } = room;
    return [
      { x1: x, y1: y, x2: x + width, y2: y, type: "drywall" },
      { x1: x + width, y1: y, x2: x + width, y2: y + height, type: "drywall" },
      { x1: x + width, y1: y + height, x2: x, y2: y + height, type: "drywall" },
      { x1: x, y1: y + height, x2: x, y2: y, type: "drywall" },
    ];
  });
  return [...roomWalls, ...layout.walls];
}

function estimateSignal(x, y) {
  if (!layout.accessPoints.length) return -90;
  return Math.max(...layout.accessPoints.map((point) => {
    const distance = Math.hypot(point.x - x, point.y - y);
    let signal = layout.metersPerUnit
      ? -35 - 20 * Math.log10(Math.max(distance * layout.metersPerUnit, 1))
      : -35 - distance * 0.105;
    for (const wall of modelWalls()) {
      if (wallCrosses(point.x, point.y, x, y, wall)) {
        signal -= ({ drywall: 5, brick: 10, concrete: 16 }[wall.type] ?? 7);
      }
    }
    return signal;
  }));
}

function renderRooms(preview) {
  roomLayer.replaceChildren();
  if (layout.rooms.length === 0) {
    const hint = svgElement("text", {
      x: 380, y: 105, "text-anchor": "middle", class: "empty-map-hint",
    });
    hint.textContent = "Choose + Room and draw your first room";
    roomLayer.append(hint);
  }
  layout.rooms.forEach((room) => {
    const group = svgElement("g", {
      class: `room-shape ${selectedRoomId === room.id ? "selected-room" : ""}`,
      "data-room-id": room.id,
    });
    group.append(svgElement("rect", { x: room.x, y: room.y, width: room.width, height: room.height, rx: 3 }));
    const title = svgElement("text", {
      x: room.x + room.width / 2, y: room.y + room.height / 2,
      "text-anchor": "middle", "dominant-baseline": "middle",
    });
    title.textContent = room.name;
    group.append(title);
    roomLayer.append(group);
  });
  if (preview) roomLayer.append(svgElement("rect", {
    x: preview.x, y: preview.y, width: preview.width, height: preview.height,
    rx: 3, class: "room-preview",
  }));
}

function renderHeatmap() {
  heatmapLayer.replaceChildren();
  const cell = 18;
  for (let y = 68; y < 320; y += cell) {
    for (let x = 98; x < 670; x += cell) {
      const signal = estimateSignal(x + cell / 2, y + cell / 2);
      const color = signal >= -55 ? "#3978f6" : signal >= -68 ? "#789bd7" : "#929baa";
      const opacity = Math.max(0, Math.min(0.34, 0.1 + ((signal + 90) / 55) * 0.24));
      if (opacity > 0.1) heatmapLayer.append(svgElement("rect", {
        x, y, width: cell, height: cell, fill: color, "fill-opacity": opacity, rx: 2,
      }));
    }
  }
}

function renderWalls(preview) {
  wallLayer.replaceChildren();
  layout.walls.forEach((wall, index) => {
    const group = svgElement("g", { class: "user-wall", "data-wall-id": wall.id });
    group.append(svgElement("line", {
      x1: wall.x1, y1: wall.y1, x2: wall.x2, y2: wall.y2,
      stroke: wall.source === "pdf" ? "#86aaff" : "#6f9fff",
      "stroke-width": 5, "stroke-linecap": "round", opacity: 0.9,
    }));
    if (wall.source !== "pdf") {
      const label = svgElement("text", {
        x: (wall.x1 + wall.x2) / 2, y: (wall.y1 + wall.y2) / 2 - 7,
        "text-anchor": "middle", fill: "#bed0f3", "font-size": 7, "font-family": "DM Mono, monospace",
      });
      label.textContent = `${wall.type.toUpperCase()} · ${index + 1}`;
      group.append(label);
    }
    wallLayer.append(group);
  });
  if (preview) wallLayer.append(svgElement("line", {
    x1: preview.x1, y1: preview.y1, x2: preview.x2, y2: preview.y2,
    stroke: "#9abaff", "stroke-width": 3, "stroke-dasharray": "5 4", "pointer-events": "none",
  }));
}

function renderAccessPoints() {
  accessPointLayer.replaceChildren();
  const list = document.querySelector("#ap-list");
  list.replaceChildren();
  layout.accessPoints.forEach((point, index) => {
    const group = svgElement("g", {
      class: `ap-marker ${index === 0 ? "" : "secondary"}`,
      transform: `translate(${point.x} ${point.y})`,
      "data-ap-id": point.id, tabindex: 0, role: "button",
      "aria-label": `${point.name}. Drag to move access point.`,
    });
    group.append(svgElement("circle", { r: index === 0 ? 25 : 22, class: "ap-range" }));
    group.append(svgElement("circle", { r: index === 0 ? 13 : 11, class: "ap-core" }));
    group.append(svgElement("path", { d: "M-5 1a7 7 0 0 1 10 0M-9-3a13 13 0 0 1 18 0", class: "wifi-icon" }));
    group.append(svgElement("circle", { r: 2, class: "wifi-dot" }));
    const name = svgElement("text", { x: 0, y: 40, "text-anchor": "middle" });
    name.textContent = point.name;
    group.append(name);
    accessPointLayer.append(group);

    const row = document.createElement("div");
    row.className = "ap-row";
    const icon = document.createElement("div");
    icon.className = `ap-symbol ${index === 0 ? "main-ap" : ""}`;
    icon.textContent = "⌁";
    const details = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = point.name;
    const coordinates = document.createElement("small");
    coordinates.textContent = `Plan position · ${Math.round(point.x)}, ${Math.round(point.y)}`;
    details.append(title, coordinates);
    const status = document.createElement("span");
    status.className = "ap-health";
    status.textContent = "Estimated";
    row.append(icon, details, status);
    list.append(row);
  });
}

function render() {
  renderHeatmap();
  renderRooms();
  renderWalls();
  renderAccessPoints();
  document.querySelector("#ap-count").textContent = layout.accessPoints.length;
  document.querySelector("#metric-ap-count").textContent = `${layout.accessPoints.length} access points`;
  document.querySelector(".ap-mini").setAttribute("aria-label", `${layout.accessPoints.length} access points`);
  document.querySelector("#remove-room").disabled = !layout.rooms.some((room) => room.id === selectedRoomId);
  document.querySelector("#scale-status").textContent = layout.metersPerUnit
    ? `1 UNIT = ${layout.metersPerUnit.toFixed(3)} M`
    : "SCALE NOT SET";
}

function saveLayout() {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
    saveState.textContent = "Layout saved in this browser";
    saveState.classList.remove("save-error");
  } catch {
    saveState.textContent = "Could not save layout in this browser";
    saveState.classList.add("save-error");
  }
}

function updateLayout() {
  render();
  saveState.textContent = "Saving layout…";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveLayout, 180);
}

window.addDetectedPdfWalls = (walls) => {
  layout.walls = layout.walls.filter((wall) => wall.source !== "pdf");
  layout.walls.push(...walls);
  updateLayout();
};

function setTool(tool) {
  activeTool = tool;
  document.querySelectorAll(".tool-button").forEach((button) => button.classList.remove("active-tool"));
  document.querySelector("#tool-scale").classList.remove("active-tool");
  document.querySelector(`#tool-${tool}`).classList.add("active-tool");
  document.querySelector("#map-instructions").textContent = ({
    select: "Click a room to select · double-click to name",
    room: "Drag to draw a room · double-click it later to rename",
    ap: "Click inside the plan to place an access point",
    wall: "Drag across the plan to draw a wall",
    scale: "Click two ends of a known length, then enter its length in metres",
  })[tool];
  map.classList.toggle("adding-ap", tool === "ap");
  map.classList.toggle("drawing-wall", tool === "wall");
  map.classList.toggle("drawing-room", tool === "room");
  map.classList.toggle("setting-scale", tool === "scale");
}

let scalePoints = [];

map.addEventListener("pointerdown", (event) => {
  const marker = event.target.closest?.("[data-ap-id]");
  if (marker && activeTool === "select") {
    event.preventDefault();
    dragState = { id: marker.dataset.apId, pointerId: event.pointerId };
    map.setPointerCapture(event.pointerId);
  } else if (activeTool === "wall") {
    event.preventDefault();
    dragState = { wall: true, start: pointOnMap(event), moved: false, pointerId: event.pointerId };
    map.setPointerCapture(event.pointerId);
  } else if (activeTool === "room") {
    event.preventDefault();
    dragState = { room: true, start: pointOnMap(event), pointerId: event.pointerId };
    map.setPointerCapture(event.pointerId);
  }
});

map.addEventListener("pointermove", (event) => {
  if (!dragState || dragState.pointerId !== event.pointerId) return;
  const position = pointOnMap(event);
  if (dragState.id) {
    const point = layout.accessPoints.find((item) => item.id === dragState.id);
    if (point) { point.x = position.x; point.y = position.y; updateLayout(); }
  } else if (dragState.wall) {
    dragState.end = position;
    dragState.moved = Math.hypot(position.x - dragState.start.x, position.y - dragState.start.y) > 10;
    renderWalls(dragState.moved ? { ...dragState.start, x2: position.x, y2: position.y } : null);
  } else if (dragState.room) {
    dragState.end = position;
    const x = Math.min(position.x, dragState.start.x);
    const y = Math.min(position.y, dragState.start.y);
    renderRooms({
      x, y, width: Math.abs(position.x - dragState.start.x),
      height: Math.abs(position.y - dragState.start.y),
    });
  }
});

map.addEventListener("pointerup", (event) => {
  if (!dragState || dragState.pointerId !== event.pointerId) return;
  if (dragState.wall && dragState.moved) {
    layout.walls.push({
      id: `wall-${Date.now()}`, x1: dragState.start.x, y1: dragState.start.y,
      x2: dragState.end.x, y2: dragState.end.y,
      type: document.querySelector("#wall-type").value,
    });
    updateLayout();
  } else if (dragState.room && dragState.end) {
    const x = Math.min(dragState.end.x, dragState.start.x);
    const y = Math.min(dragState.end.y, dragState.start.y);
    const width = Math.abs(dragState.end.x - dragState.start.x);
    const height = Math.abs(dragState.end.y - dragState.start.y);
    if (width >= 28 && height >= 24) {
      layout.rooms.push({
        id: `room-${Date.now()}`, x, y, width, height,
        name: `Room ${layout.rooms.length + 1}`,
      });
      updateLayout();
    }
  }
  dragState = null;
});

map.addEventListener("click", (event) => {
  if (activeTool === "scale") {
    scalePoints.push(pointOnMap(event));
    if (scalePoints.length === 2) {
      const pixelDistance = Math.hypot(scalePoints[1].x - scalePoints[0].x, scalePoints[1].y - scalePoints[0].y);
      scalePoints = [];
      const entered = window.prompt("What real-world distance is this in metres?", "5");
      const metres = Number(entered);
      if (entered !== null && Number.isFinite(metres) && metres > 0 && pixelDistance > 0) {
        layout.metersPerUnit = metres / pixelDistance;
        updateLayout();
        showToast("Map scale calibrated. Coverage now uses metres.");
      }
      setTool("select");
    }
    return;
  }
  if (activeTool === "select") {
    const room = event.target.closest?.("[data-room-id]");
    if (room) {
      selectedRoomId = room.dataset.roomId;
      render();
      return;
    }
    const wall = event.target.closest?.("[data-wall-id]");
    if (wall) {
      layout.walls = layout.walls.filter((item) => item.id !== wall.dataset.wallId);
      updateLayout();
    }
    return;
  }
  if (activeTool !== "ap" || event.target.closest?.("[data-ap-id]")) return;
  if (layout.accessPoints.length >= 6) { showToast("The planner supports up to six access points for now."); return; }
  const position = pointOnMap(event);
  const index = layout.accessPoints.length + 1;
  layout.accessPoints.push({ id: `ap-${Date.now()}`, x: position.x, y: position.y, name: `ACCESS POINT ${index}` });
  updateLayout();
  setTool("select");
});

map.addEventListener("dblclick", (event) => {
  const room = event.target.closest?.("[data-room-id]");
  if (room) {
    const current = layout.rooms.find((item) => item.id === room.dataset.roomId);
    const name = window.prompt("Name this room", current?.name ?? "Room");
    if (current && name?.trim()) {
      current.name = name.trim().slice(0, 32);
      updateLayout();
    }
    return;
  }
  const marker = event.target.closest?.("[data-ap-id]");
  if (!marker || layout.accessPoints.length <= 1) return;
  layout.accessPoints = layout.accessPoints.filter((point) => point.id !== marker.dataset.apId);
  updateLayout();
  showToast("Access point removed from the layout.");
});

document.querySelector("#tool-select").addEventListener("click", () => setTool("select"));
document.querySelector("#tool-room").addEventListener("click", () => setTool("room"));
document.querySelector("#tool-ap").addEventListener("click", () => setTool("ap"));
document.querySelector("#tool-wall").addEventListener("click", () => setTool("wall"));
document.querySelector("#tool-scale").addEventListener("click", () => setTool("scale"));
document.querySelector("#remove-room").addEventListener("click", () => {
  if (!selectedRoomId) return;
  layout.rooms = layout.rooms.filter((room) => room.id !== selectedRoomId);
  selectedRoomId = null;
  updateLayout();
});
document.querySelector("#reset-layout").addEventListener("click", () => {
  layout = structuredClone(defaultLayout);
  selectedRoomId = null;
  updateLayout();
  setTool("select");
  showToast("Floor plan reset to the starter layout.");
});
const toast = document.querySelector("#toast");
function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 2800);
}

async function getMeasurements() {
  if (DATA_MODE === "live") {
    const response = await fetch(`${API_BASE}/measurements/current`);
    if (!response.ok) throw new Error("The Java API did not return measurements.");
    return response.json();
  }
  return { downloadMbps: 184.2, uploadMbps: 31.7, latencyMs: 12, source: "demo" };
}

document.querySelector("#run-test").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  button.innerHTML = "<span>↻</span> Measuring…";
  try {
    const data = await getMeasurements();
    if (data.downloadMbps != null) document.querySelector("#download-value").textContent = Number(data.downloadMbps).toFixed(1);
    if (data.uploadMbps != null) document.querySelector("#upload-value").textContent = Number(data.uploadMbps).toFixed(1);
    if (data.latencyMs != null) document.querySelector("#latency-value").textContent = Math.round(data.latencyMs);
    showToast(DATA_MODE === "demo" ? "Demo readings refreshed. Connect the Java API for real measurements." : "Measurements updated.");
  } catch (error) {
    showToast(error.message || "Could not reach the Java API.");
  } finally {
    button.disabled = false;
    button.innerHTML = "<span>↻</span> Run speed test";
  }
});

if (DATA_MODE === "live") document.querySelector(".demo-pill").innerHTML = "<i></i> LIVE MODE";
setTool("select");
render();
saveLayout();
