const pdfFileInput = document.querySelector("#pdf-file");
const pdfPageImage = document.querySelector("#pdf-underlay");
const pdfControls = document.querySelector("#pdf-controls");
const pdfName = document.querySelector("#pdf-name");
const pdfCropOverlay = document.querySelector("#pdf-crop-overlay");
const floorMap = document.querySelector("#floorplan");
const svgNamespace = "http://www.w3.org/2000/svg";
let pdfDocument = null;
let pdfPage = 1;
let pdfRenderTask = null;
let pdfLibraryPromise = null;
let pdfGeneration = 0;
let pageGeneration = 0;
let sourceCanvas = null;
let sourceGeometry = null;
let cropRectangle = null;
let renderedPageMetrics = null;
let cropMode = false;
let cropDrag = null;

function loadPdfLibrary() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (!pdfLibraryPromise) {
    pdfLibraryPromise = import("https://cdn.jsdelivr.net/npm/pdfjs-dist@6.5.438/build/pdf.mjs")
      .then((library) => {
        library.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.5.438/build/pdf.worker.mjs";
        return library;
      })
      .catch(() => { throw new Error("Could not load the PDF reader. Check your internet connection and try again."); });
  }
  return pdfLibraryPromise;
}

function mapPoint(event) {
  const point = floorMap.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const mapped = point.matrixTransform(floorMap.getScreenCTM().inverse());
  return { x: Math.max(90, Math.min(670, mapped.x)), y: Math.max(60, Math.min(320, mapped.y)) };
}

function showCropRectangle(start, end) {
  pdfCropOverlay.replaceChildren();
  const rect = document.createElementNS(svgNamespace, "rect");
  rect.setAttribute("x", Math.min(start.x, end.x));
  rect.setAttribute("y", Math.min(start.y, end.y));
  rect.setAttribute("width", Math.abs(end.x - start.x));
  rect.setAttribute("height", Math.abs(end.y - start.y));
  rect.setAttribute("class", "pdf-crop-selection");
  pdfCropOverlay.append(rect);
}

function setCropMode(enabled) {
  cropMode = enabled;
  floorMap.classList.toggle("cropping-pdf", enabled);
  document.querySelector("#pdf-crop").classList.toggle("active-tool", enabled);
  if (enabled) {
    pdfName.textContent = "Drag around the floor plan area to crop and enlarge it";
  } else if (pdfDocument) {
    pdfName.textContent = "Page " + pdfPage + " of " + pdfDocument.numPages;
  }
}

async function renderCurrentCrop() {
  if (!sourceCanvas || !sourceGeometry) return;
  const sourceCrop = cropRectangle || { x: 0, y: 0, width: sourceCanvas.width, height: sourceCanvas.height };
  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = Math.max(1, Math.floor(sourceCrop.width));
  cropCanvas.height = Math.max(1, Math.floor(sourceCrop.height));
  const cropContext = cropCanvas.getContext("2d", { alpha: false });
  cropContext.drawImage(
    sourceCanvas,
    sourceCrop.x, sourceCrop.y, sourceCrop.width, sourceCrop.height,
    0, 0, cropCanvas.width, cropCanvas.height,
  );
  const cssWidth = cropCanvas.width / sourceGeometry.outputScale;
  const cssHeight = cropCanvas.height / sourceGeometry.outputScale;
  const fitScale = Math.min(580 / cssWidth, 260 / cssHeight);
  const fittedWidth = cssWidth * fitScale;
  const fittedHeight = cssHeight * fitScale;
  renderedPageMetrics = {
    canvas: cropCanvas,
    mapPerPixel: fitScale / sourceGeometry.outputScale,
    offsetX: (580 - fittedWidth) / 2,
    offsetY: (260 - fittedHeight) / 2,
  };
  pdfPageImage.setAttribute("href", cropCanvas.toDataURL("image/png"));
  pdfPageImage.setAttribute("visibility", "visible");
  pdfPageImage.setAttribute("opacity", String(Number(document.querySelector("#pdf-opacity").value) / 100));
}

async function renderPdfPage(pageNumber) {
  if (!pdfDocument) return;
  const documentForRender = pdfDocument;
  const generation = pdfGeneration;
  const pageToken = ++pageGeneration;
  try { pdfRenderTask?.cancel(); } catch { /* A completed task cannot be cancelled. */ }
  const page = await documentForRender.getPage(pageNumber);
  if (generation !== pdfGeneration || pageToken !== pageGeneration) return;
  const originalViewport = page.getViewport({ scale: 1 });
  const fitScale = Math.min(580 / originalViewport.width, 260 / originalViewport.height);
  const outputScale = Math.min(window.devicePixelRatio || 1, 2);
  const viewport = page.getViewport({ scale: fitScale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width * outputScale);
  canvas.height = Math.floor(viewport.height * outputScale);
  const context = canvas.getContext("2d", { alpha: false });
  pdfRenderTask = page.render({
    canvasContext: context,
    viewport,
    transform: outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0],
  });
  await pdfRenderTask.promise;
  if (generation !== pdfGeneration || pageToken !== pageGeneration) return;
  sourceCanvas = canvas;
  sourceGeometry = {
    outputScale,
    mapLeft: 90 + (580 - viewport.width) / 2,
    mapTop: 60 + (260 - viewport.height) / 2,
    mapPerPixel: 1 / outputScale,
  };
  cropRectangle = null;
  await renderCurrentCrop();
  document.querySelector("#pdf-page-number").textContent = "Page " + pageNumber + " / " + pdfDocument.numPages;
  document.querySelector("#pdf-prev").disabled = pageNumber <= 1;
  document.querySelector("#pdf-next").disabled = pageNumber >= pdfDocument.numPages;
  document.querySelector("#pdf-fit").disabled = true;
}

document.querySelector("#upload-pdf").addEventListener("click", () => pdfFileInput.click());
pdfFileInput.addEventListener("change", async () => {
  const file = pdfFileInput.files?.[0];
  pdfFileInput.value = "";
  if (!file) return;
  const generation = ++pdfGeneration;
  if (file.size > 30 * 1024 * 1024) {
    showToast("Choose a PDF smaller than 30 MB.");
    return;
  }
  try {
    pdfName.textContent = "Loading PDF…";
    const library = await loadPdfLibrary();
    const bytes = new Uint8Array(await file.arrayBuffer());
    const documentTask = library.getDocument({ data: bytes });
    const nextDocument = await documentTask.promise;
    if (generation !== pdfGeneration) { nextDocument.destroy(); return; }
    const previousDocument = pdfDocument;
    pdfDocument = nextDocument;
    previousDocument?.destroy();
    pdfPage = 1;
    pdfControls.hidden = false;
    await renderPdfPage(pdfPage);
    pdfName.textContent = file.name;
    showToast("PDF loaded. Crop around the apartment to fit it to the map, then detect walls.");
  } catch (error) {
    pdfName.textContent = "PDF could not be opened";
    showToast(error?.message || "Could not read that PDF.");
  }
});

document.querySelector("#pdf-prev").addEventListener("click", async () => {
  if (!pdfDocument || pdfPage <= 1) return;
  pdfPage -= 1;
  await renderPdfPage(pdfPage);
});
document.querySelector("#pdf-next").addEventListener("click", async () => {
  if (!pdfDocument || pdfPage >= pdfDocument.numPages) return;
  pdfPage += 1;
  await renderPdfPage(pdfPage);
});
document.querySelector("#pdf-crop").addEventListener("click", async () => {
  if (!pdfDocument || !sourceCanvas || !sourceGeometry) return;
  if (!cropMode) {
    cropRectangle = null;
    await renderCurrentCrop();
    setCropMode(true);
  } else {
    setCropMode(false);
    pdfName.textContent = "Page " + pdfPage + " of " + pdfDocument.numPages;
  }
});
document.querySelector("#pdf-fit").addEventListener("click", async () => {
  cropRectangle = null;
  setCropMode(false);
  await renderCurrentCrop();
  document.querySelector("#pdf-fit").disabled = true;
  if (pdfDocument) pdfName.textContent = "Page " + pdfPage + " of " + pdfDocument.numPages;
});

floorMap.addEventListener("pointerdown", (event) => {
  if (!cropMode || !sourceGeometry) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  cropDrag = mapPoint(event);
  floorMap.setPointerCapture(event.pointerId);
}, true);
floorMap.addEventListener("pointermove", (event) => {
  if (!cropMode || !cropDrag) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  showCropRectangle(cropDrag, mapPoint(event));
}, true);
floorMap.addEventListener("pointerup", async (event) => {
  if (!cropMode || !cropDrag) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const end = mapPoint(event);
  pdfCropOverlay.replaceChildren();
  const start = cropDrag;
  cropDrag = null;
  const mapWidth = Math.abs(end.x - start.x);
  const mapHeight = Math.abs(end.y - start.y);
  if (mapWidth < 18 || mapHeight < 18) {
    showToast("Drag a larger box around the part of the plan to keep.");
    return;
  }
  const sourceX1 = Math.max(0, Math.min(sourceCanvas.width, Math.floor((Math.min(start.x, end.x) - sourceGeometry.mapLeft) / sourceGeometry.mapPerPixel)));
  const sourceY1 = Math.max(0, Math.min(sourceCanvas.height, Math.floor((Math.min(start.y, end.y) - sourceGeometry.mapTop) / sourceGeometry.mapPerPixel)));
  const sourceX2 = Math.max(0, Math.min(sourceCanvas.width, Math.ceil((Math.max(start.x, end.x) - sourceGeometry.mapLeft) / sourceGeometry.mapPerPixel)));
  const sourceY2 = Math.max(0, Math.min(sourceCanvas.height, Math.ceil((Math.max(start.y, end.y) - sourceGeometry.mapTop) / sourceGeometry.mapPerPixel)));
  if (sourceX2 - sourceX1 < 20 || sourceY2 - sourceY1 < 20) {
    showToast("Crop a region over the visible PDF page.");
    return;
  }
  cropRectangle = { x: sourceX1, y: sourceY1, width: sourceX2 - sourceX1, height: sourceY2 - sourceY1 };
  await renderCurrentCrop();
  setCropMode(false);
  document.querySelector("#pdf-fit").disabled = false;
  pdfName.textContent = "Cropped plan · enlarged to map";
});
floorMap.addEventListener("pointercancel", (event) => {
  if (!cropDrag) return;
  cropDrag = null;
  pdfCropOverlay.replaceChildren();
}, true);

document.querySelector("#detect-pdf-walls").addEventListener("click", () => {
  if (!renderedPageMetrics) return showToast("Load a PDF page first.");
  const { canvas, mapPerPixel, offsetX, offsetY } = renderedPageMetrics;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
  const segments = [];

  function addCandidate(axis, fixed, start, end) {
    const existing = segments.find((segment) =>
      segment.axis === axis &&
      Math.abs(segment.fixed - fixed) <= 5 &&
      Math.abs(segment.start - start) <= 18 &&
      Math.abs(segment.end - end) <= 18
    );
    if (existing) {
      existing.fixed = (existing.fixed * existing.samples + fixed) / (existing.samples + 1);
      existing.start = Math.min(existing.start, start);
      existing.end = Math.max(existing.end, end);
      existing.samples += 1;
    } else if (segments.length < 140) {
      segments.push({ axis, fixed, start, end, samples: 1 });
    }
  }
  function isInk(x, y) {
    const at = (y * width + x) * 4;
    return data[at + 3] > 80 && (data[at] + data[at + 1] + data[at + 2]) / 3 < 155;
  }

  const minHorizontal = Math.max(38, width * 0.065);
  for (let y = 0; y < height; y += 2) {
    let run = -1;
    for (let x = 0; x <= width; x += 1) {
      if (x < width && isInk(x, y)) { if (run < 0) run = x; }
      else if (run >= 0) {
        if (x - run >= minHorizontal) addCandidate("h", y, run, x);
        run = -1;
      }
    }
  }
  const minVertical = Math.max(32, height * 0.075);
  for (let x = 0; x < width; x += 2) {
    let run = -1;
    for (let y = 0; y <= height; y += 1) {
      if (y < height && isInk(x, y)) { if (run < 0) run = y; }
      else if (run >= 0) {
        if (y - run >= minVertical) addCandidate("v", x, run, y);
        run = -1;
      }
    }
  }

  const walls = segments.map((segment, index) => {
    const base = { id: "pdf-wall-" + Date.now() + "-" + index, type: "drywall", source: "pdf" };
    return segment.axis === "h"
      ? { ...base, x1: 90 + offsetX + segment.start * mapPerPixel, y1: 60 + offsetY + segment.fixed * mapPerPixel, x2: 90 + offsetX + segment.end * mapPerPixel, y2: 60 + offsetY + segment.fixed * mapPerPixel }
      : { ...base, x1: 90 + offsetX + segment.fixed * mapPerPixel, y1: 60 + offsetY + segment.start * mapPerPixel, x2: 90 + offsetX + segment.fixed * mapPerPixel, y2: 60 + offsetY + segment.end * mapPerPixel };
  });
  if (walls.length) window.addDetectedPdfWalls(walls);
  showToast(walls.length
    ? "Added " + walls.length + " likely wall lines. Review the map and click false detections to remove them."
    : "No long wall lines detected. Try another page or trace rooms manually.");
});
document.querySelector("#pdf-opacity").addEventListener("input", (event) => {
  pdfPageImage.setAttribute("opacity", String(Number(event.currentTarget.value) / 100));
});
document.querySelector("#remove-pdf").addEventListener("click", () => {
  ++pdfGeneration;
  ++pageGeneration;
  const oldDocument = pdfDocument;
  pdfDocument = null;
  sourceCanvas = null;
  sourceGeometry = null;
  cropRectangle = null;
  renderedPageMetrics = null;
  cropDrag = null;
  pdfCropOverlay.replaceChildren();
  setCropMode(false);
  try { pdfRenderTask?.cancel(); } catch { /* Ignore an already completed render. */ }
  pdfRenderTask = null;
  pdfPageImage.removeAttribute("href");
  pdfPageImage.setAttribute("visibility", "hidden");
  Promise.resolve(oldDocument?.destroy()).catch(() => {});
  pdfControls.hidden = true;
  pdfName.textContent = "PDF is rendered locally; re-add it after refreshing";
});
