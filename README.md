# Alfie

Alfie is a home Wi-Fi monitor and placement planner. The project is split into a browser dashboard and a Java backend that you will build.

## Project layout

```text
frontend/          Static HTML, CSS, and JavaScript dashboard
backend/           Java backend workspace and API contract
docs/              Architecture and development notes
compose.yaml       Local Docker Compose setup
```

## Run the dashboard

Install Docker Desktop, then from this folder run:

```sh
docker compose up --build
```

Open [http://localhost:8080](http://localhost:8080). The dashboard currently runs in demo mode with simulated measurements; it does not inspect your network yet.

You can also open `frontend/index.html` directly while working on the visual interface. No frontend package installation is needed.

## Java backend

The `backend/` folder is intentionally yours to implement. See [backend/README.md](backend/README.md) for the proposed API contract and connection points. The Compose file already reserves port 8081 for the future API service.

## Current scope

- Visual home layout with access point and device markers
- Draw and name rooms to make your own floor plan
- Drag, add, and remove access points; draw and remove walls
- Estimated coverage changes with access point distance and wall material
- Layout saved automatically in your browser
- Upload a PDF page, detect likely wall lines, and trace the plan
- Demo latency, signal, and speed readings
- Frontend structure ready to switch to a Java API

Use the map tools above the grid to draw rooms and build your floor plan. Double-click a room to name it; select a room and use “Remove room” to delete it. Click a drawn wall to remove it. Drag to draw a wall or drag an access point to move it. Double-click an added access point to remove it. Reset restores a blank plan with one router. Upload a PDF page, select “Crop to plan,” and drag a box around the apartment to enlarge it to the map. Choose “Detect walls” to add likely line segments as editable walls; review the result and click false detections to remove them. Room rectangles and names are still drawn in the map. Use “Set scale” and click two points with a known distance, then enter that length in metres to calibrate the model.

The coverage calculation is only a planning approximation, not a measurement or radio simulation. Actual Wi-Fi behavior depends on hardware, placement, interference, and building materials. Browser storage keeps the layout on this device only.

Use “Upload floor plan PDF” to choose a page and adjust its opacity while tracing. The PDF is read and rendered in your browser, is not uploaded to Alfie's backend, and must be added again after refreshing the page. PDF.js is loaded from jsDelivr the first time you import a file, so an internet connection is needed for that step. PDF line detection is heuristic and works best on high contrast, mostly straight architectural plans.
