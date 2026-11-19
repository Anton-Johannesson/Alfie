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
- Illustrative demo placement and coverage visualization
- Demo latency, signal, and speed readings
- Frontend structure ready to switch to a Java API

The coverage calculation is only a planning approximation. Actual Wi-Fi behavior depends on hardware, placement, interference, and building materials.
