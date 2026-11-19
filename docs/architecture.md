# Architecture notes

```text
Browser
  └── HTML / CSS / JavaScript dashboard
       ├── demo measurements (current default)
       └── /api/* through the frontend Nginx proxy
              └── Java backend (your implementation)
                   └── host measurements and/or router integrations
```

The current floor-plan display is a static visual prototype with illustrative coverage. It is not yet an editable planner or a radio propagation simulator. A later model can account for wall attenuation and access-point range, then be calibrated against measurements taken around the home.

The frontend has no framework or build step yet so that the first iteration is easy to inspect and modify. If the project grows, it can be migrated to a frontend build tool without changing the API boundary.
