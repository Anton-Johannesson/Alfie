// Keep the dashboard usable before the Java service exists. Change to "live"
// when the backend exposes the contract documented in /backend/README.md.
const DATA_MODE = "demo";
const API_BASE = "/api";

const toast = document.querySelector("#toast");
let toastTimer;
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

document.querySelector("#edit-layout").addEventListener("click", () => {
  showToast("Floor-plan editing is a next step. This map is a visual prototype.");
});

document.querySelectorAll(".map-tabs button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".map-tabs button").forEach((tab) => tab.classList.remove("selected"));
    button.classList.add("selected");
    if (button.textContent !== "Signal strength") showToast("Floor-plan editing will be added in a later milestone.");
  });
});

if (DATA_MODE === "live") {
  document.querySelector(".demo-pill").innerHTML = "<i></i> LIVE MODE";
}
