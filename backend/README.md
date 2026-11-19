# Java backend workspace

This folder is reserved for your Java implementation. No Java source or framework has been chosen for you.

## Suggested responsibilities

- Read measurements exposed by the host or supported by your router/mesh system.
- Keep hardware-specific integrations behind a small service interface.
- Expose a stable HTTP API for the dashboard.
- Clearly report unavailable measurements instead of inventing real network data.

## Proposed API contract

The frontend is configured to use the same-origin `/api` path. Nginx forwards `/api/*` requests to the `backend` Compose service at port `8081`, preserving the `/api` prefix. The current Compose backend is only a placeholder so the dashboard can start before your Java service exists. When you replace it, keep port `8081` inside the container or update the proxy target in `frontend/nginx.conf`.

Suggested endpoints:

### `GET /api/status`

```json
{
  "mode": "live",
  "updatedAt": "2026-11-19T10:30:00Z",
  "source": "host"
}
```

### `GET /api/measurements/current`

```json
{
  "latencyMs": 12,
  "downloadMbps": 184.2,
  "uploadMbps": 31.7,
  "signalDbm": -54,
  "connectionMbps": 433,
  "source": "host"
}
```

Use `null` for a measurement your current platform or router cannot provide.

### `GET /api/devices`

```json
[
  { "id": "device-1", "name": "Laptop", "address": "192.168.1.20", "online": true }
]
```

Only return devices and traffic details your network equipment can actually identify. A normal client cannot necessarily see all traffic or per-device throughput.

### Optional live updates

Add `GET /api/measurements/stream` as a Server-Sent Events endpoint when you are ready. Events can use the same measurement object as `/api/measurements/current`. The frontend currently requests measurements when the user presses “Run speed test”; periodic refresh or streaming can be added when you implement the API.

## Connecting the dashboard

The browser code in `frontend/src/app.js` has a `DATA_MODE` setting. Keep it as `"demo"` while developing the backend, then change it to `"live"` to request the API. This keeps the demo dashboard useful while the backend is incomplete.
