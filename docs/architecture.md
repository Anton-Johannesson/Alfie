# Architecture notes

```text
Browser
  └── HTML / CSS / JavaScript dashboard
       ├── demo measurements (current default)
       └── /api/* through the frontend Nginx proxy
              └── Java backend (your implementation)
                   └── host measurements and/or router integrations
```

The floor-plan editor starts as a blank grid. Users may render a selected PDF page as a temporary background and crop a region to enlarge it to the map. A raster heuristic detects long horizontal and vertical line segments as editable walls. Detected lines may include dimensions, furniture, or text and must be reviewed. Room rectangles remain user-drawn. The PDF stays in browser memory and must be reselected after refresh. PDF.js is loaded on demand from jsDelivr. Users can calibrate metres per map unit by marking a known distance. Room outlines and drawn walls affect the coverage estimate; distance uses the calibrated scale when available. It remains a planning approximation, not a radio propagation simulator.

The frontend has no framework or build step yet so that the first iteration is easy to inspect and modify. If the project grows, it can be migrated to a frontend build tool without changing the API boundary.
