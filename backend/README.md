# Alfie Java backend

This is a Maven-based Spring Boot REST API skeleton. Java 21 keeps the runtime on an LTS release; Spring Boot 4 manages framework and test dependency versions.

## Structure

```text
src/main/java/dev/alfie/network/
  AlfieApplication.java     Spring Boot entry point
  api/                      HTTP controllers
    dto/                    API request/response records
  service/                  Use cases and orchestration
  domain/                   Core network concepts and rules
  integration/              Host, router, and mesh adapters
  config/                   Application configuration
src/main/resources/
  application.yml           Port and service settings
src/test/java/dev/alfie/network/
  AlfieApplicationTests.java JUnit 5 context smoke test
```

Keep network-vendor and operating-system details inside `integration/`. Put reusable decisions in `domain/` or `service/`, and keep HTTP types in `api/dto/` so the dashboard contract does not become coupled to a router library.

## Run locally

With Java 21 and Maven installed:

```sh
mvn test
mvn spring-boot:run
```

The service listens on port 8081. Spring Boot Actuator exposes a local health check at [http://localhost:8081/actuator/health](http://localhost:8081/actuator/health).

JUnit Jupiter and Spring test libraries are provided by `spring-boot-starter-test`. Add unit tests beside each package under `src/test/java`; keep hardware dependent checks separate from normal automated tests.

## Run with Docker Compose

From the repository root:

```sh
docker compose up --build
```

Compose maps the API to `localhost:8081`. The dashboard's Nginx proxy forwards `/api/*` requests to this service and keeps the `/api` prefix.

## API direction

The frontend currently expects:

- `GET /api/status`
- `GET /api/measurements/current`
- `GET /api/devices`
- Later: `GET /api/measurements/stream` using Server-Sent Events

Example response for `GET /api/measurements/current`:

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

Use `null` for measurements the current host or router cannot provide. Example `GET /api/devices` response:

```json
[
  { "id": "device-1", "name": "Laptop", "address": "192.168.1.20", "online": true }
]
```

The Java app currently contains no measurement collection or API endpoints; that part is yours to build.
