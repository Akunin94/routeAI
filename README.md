# Route Planner AI

**Live:** [route-ai-nine.vercel.app](https://route-ai-nine.vercel.app)

## Screenshots
<img width="2294" height="1320" alt="image" src="https://github.com/user-attachments/assets/0044907b-c4bd-498c-aeaf-8c4ca2ae7d5f" />
<img width="2294" height="1301" alt="image" src="https://github.com/user-attachments/assets/8ed41b33-9b2e-4ad0-abf4-e65a444a6857" />
<img width="444" height="1304" alt="image" src="https://github.com/user-attachments/assets/f7fd0d97-008b-447e-9aba-1f88c8b5e8e0" />



A web app for multi-stop route planning with an AI assistant powered by Claude. Supports drag-and-drop editing, traffic-aware ETAs, export/import, and shareable links.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Vue 3.5 (Composition API) + TypeScript 5.8 |
| UI | Vuetify 3.8 (Material Design 3) + MDI Icons |
| Build | Vite 6.2 |
| State | Pinia 2.3 |
| Maps | Google Maps JavaScript API (`@googlemaps/js-api-loader`) |
| AI | Claude API (Anthropic) — `claude-haiku-4-5` |
| Tests | Vitest 3 + Vue Test Utils |

## Getting Started

```bash
npm install
npm run dev        # dev server
npm run build      # production build
npm run test       # unit tests
npm run type-check # TypeScript check only
```

Create `.env.local` with your API keys:

```env
VITE_GOOGLE_MAPS_API_KEY=...
VITE_ANTHROPIC_API_KEY=...   # dev proxy only
```

---

## Features

### Waypoint Management

- **Add waypoints** — Google Places Autocomplete search (origin → destination → stops)
- **Edit address** — pencil button opens an inline autocomplete field pre-filled with the current address and auto-focused
- **Drag markers on the map** — drop a marker to a new position; address updates automatically via reverse geocoding
- **Reorder stops** — drag and drop in the sidebar list
- **Remove waypoints** — × button per item
- **Clear all** — reset the entire route

### Route Calculation

- **4 travel modes** — Driving / Walking / Bicycling / Transit
- **Departure time** — HH:MM picker; only applied if the time is in the future
- **ETA per stop** — arrival time = departure + cumulative leg durations
- **Traffic data** — shows actual traffic duration vs base duration per leg when available
- **Route summary** — total distance and time, per-leg breakdown (from → to, distance, duration, ETA)

### Export / Import

**Export (.tsv)**
Downloads the route as a TSV file (UTF-8 BOM — compatible with Excel and Numbers). Three sections:
1. Summary — distance, duration, date, departure time
2. Waypoints — index, label, address, lat/lng coordinates
3. Route Steps — turn-by-turn instructions with distance and duration per step

**Import**
Supports two formats:
- Own exported TSV — coordinates used directly, no geocoding needed
- Plain address list (CSV / TSV / .txt, one address per line) — auto-geocoded via Google Geocoder with a "Geocoding X/Y…" progress indicator

### Sharing

- **Share** button encodes the current route (waypoints, travel mode, departure time) into URL parameters and copies the link to the clipboard
- Opening the link restores the full route automatically

### Saved Routes

- Routes are saved locally (localStorage)
- Collapsible list in the sidebar; each saved route can be restored with one click

### Open in Google Maps

- Builds a Google Maps URL with `saddr`, `daddr`, and intermediate `waypoints` and opens it in a new tab

### AI Assistant

- Floating action button on the map opens a chat panel
- The assistant (Claude) analyzes the current route and suggests optimizations
- Responses stream in real time (SSE) with Markdown rendering
- Users explicitly apply or dismiss each suggestion

### Dark Mode

- Automatically follows system preference on first load
- Manual toggle in the sidebar header
- Map switches to dark tiles (custom Google Maps styles)
- Marker InfoWindows and AI chat bubbles adapt to the dark background

---

## Project Structure

```
src/
├── components/
│   ├── map/
│   │   ├── MapView.vue          # Google Map, markers, drag handler
│   │   └── MapMarker.vue        # Renderless: single draggable marker
│   ├── waypoints/
│   │   ├── WaypointList.vue     # List with drag-and-drop reordering
│   │   ├── WaypointItem.vue     # List item: view / inline edit mode
│   │   └── WaypointSearch.vue   # Places Autocomplete input
│   ├── route/
│   │   └── RouteSummary.vue     # Route summary, ETAs, traffic chips
│   └── ai/
│       └── AiChat.vue           # Claude chat panel
├── composables/
│   ├── useGoogleMaps.ts         # Map initialization
│   ├── useDirections.ts         # DirectionsService + DirectionsRenderer
│   └── usePlacesAutocomplete.ts # Google Places Autocomplete
├── stores/
│   ├── waypointStore.ts         # Waypoints — single source of truth
│   └── routeStore.ts            # Calculated route, travel mode, departure time
├── utils/
│   ├── routeCsv.ts              # TSV export
│   └── routeImport.ts           # Import + geocoding
├── services/
│   └── googleMapsService.ts     # Singleton Maps API loader
├── types/
│   ├── waypoint.ts
│   └── maps.ts
└── views/
    └── HomeView.vue             # Main layout: sidebar + map + details panel
```
