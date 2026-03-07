# Route Planner AI — Implementation Plan

## UI Library — Vuetify 3
- The most popular UI library for Vue 3 (Material Design 3)
- Replaces Tailwind CSS (they conflict — use only Vuetify)
- Installation:
  ```bash
  npm install vuetify @mdi/font
  npm install -D vite-plugin-vuetify
  ```
- Configuration in `main.ts`:
  ```ts
  import { createVuetify } from 'vuetify'
  import * as components from 'vuetify/components'
  import * as directives from 'vuetify/directives'
  import 'vuetify/styles'
  import '@mdi/font/css/materialdesignicons.css'

  const vuetify = createVuetify({ components, directives, icons: { defaultSet: 'mdi' } })
  app.use(vuetify)
  ```
- Components used instead of custom AppXxx:
  - `v-btn` → AppButton
  - `v-text-field` / `v-autocomplete` → AppInput / WaypointSearch
  - `v-dialog` → AppModal / SaveRouteModal
  - `v-navigation-drawer` → sidebar panel
  - `v-snackbar` → AppToast / notifications
  - `v-progress-circular` → AppSpinner
  - `v-list` / `v-list-item` → WaypointList / SavedRoutesList
  - `v-card` → AiSuggestionCard
  - `v-sheet` → AiChatPanel

## Phase 1 — Project Scaffolding
- Vite + Vue 3 + TypeScript init
- Dependencies: Pinia, Vue Router, Vuetify 3, `@mdi/font`, `@googlemaps/js-api-loader`, `axios`, `@vueuse/core`, `uuid`, `marked`
- Dev deps: `vite-plugin-vuetify`, `@types/google.maps`, `vitest`, `@vue/test-utils`, `happy-dom`
- `.env` with keys (added to `.gitignore` immediately):
  - `VITE_GOOGLE_MAPS_API_KEY`
  - `VITE_CLAUDE_API_KEY` (for dev proxy only)
  - `VITE_CLAUDE_MODEL=claude-opus-4-6`
- Path alias `@/` → `src/` in `vite.config.ts` and `tsconfig.json`
- TypeScript strict mode

## Phase 2 — Folder Structure
```
src/
├── assets/
│   └── main.css
├── types/
│   ├── waypoint.ts
│   ├── route.ts
│   ├── ai.ts
│   └── maps.ts
├── services/
│   ├── googleMapsService.ts
│   ├── claudeService.ts
│   └── storageService.ts
├── stores/
│   ├── waypointStore.ts
│   ├── routeStore.ts
│   ├── aiStore.ts
│   └── savedRoutesStore.ts
├── composables/
│   ├── useGoogleMaps.ts
│   ├── useDirections.ts
│   ├── usePlacesAutocomplete.ts
│   └── useRouteOptimizer.ts
├── components/
│   ├── map/
│   │   ├── MapView.vue
│   │   ├── MapMarker.vue
│   │   └── MapRoute.vue
│   ├── waypoints/
│   │   ├── WaypointList.vue
│   │   ├── WaypointItem.vue
│   │   └── WaypointSearch.vue
│   ├── ai/
│   │   ├── AiChatPanel.vue
│   │   ├── AiMessage.vue
│   │   └── AiSuggestionCard.vue
│   ├── routes/
│   │   ├── RouteSummary.vue
│   │   ├── SaveRouteModal.vue
│   │   └── SavedRoutesList.vue
│   └── ui/
│       └── (no custom components — use Vuetify directly)
├── views/
│   └── HomeView.vue
├── router/
│   └── index.ts
├── App.vue
└── main.ts
```

## Phase 3 — Type Definitions
All types before writing any component or store.

### waypoint.ts
```ts
export interface Waypoint {
  id: string
  label: string           // "Origin", "Stop 1", "Destination"
  address: string
  placeId?: string
  location: { lat: number; lng: number }
  order: number
  isOrigin: boolean
  isDestination: boolean
}
```

### route.ts
```ts
export interface RouteStep { instruction: string; distance: string; duration: string }
export interface RouteLeg {
  startAddress: string; endAddress: string
  distance: { text: string; value: number }
  duration: { text: string; value: number }
  steps: RouteStep[]
}
export interface Route {
  id: string; waypoints: Waypoint[]; legs: RouteLeg[]
  totalDistance: { text: string; value: number }
  totalDuration: { text: string; value: number }
  overviewPolyline: string; createdAt: number
}
export interface SavedRoute extends Route { name: string; savedAt: number }
```

### ai.ts
```ts
export type MessageRole = 'user' | 'assistant' | 'system'
export interface ChatMessage { id: string; role: MessageRole; content: string; timestamp: number }
export interface AiSuggestion {
  type: 'reorder' | 'add_stop' | 'avoid_area' | 'time_suggestion' | 'general'
  summary: string
  proposedOrder?: string[]   // waypoint IDs in new order
  additionalInfo?: string
}
```

### maps.ts
```ts
export interface MapViewport { center: { lat: number; lng: number }; zoom: number }
export interface PlaceResult {
  placeId: string; address: string
  location: { lat: number; lng: number }; name?: string
}
```

## Phase 4 — Pinia Stores

### Order: waypointStore → routeStore → aiStore → savedRoutesStore

**waypointStore** — main store, single source of truth:
- `waypoints: Waypoint[]`
- computed: `origin`, `destination`, `stops`, `hasEnoughWaypoints`
- actions: `addWaypoint`, `removeWaypoint`, `reorderWaypoints(orderedIds: string[])`, `loadWaypoints`, `clearWaypoints`

**routeStore**:
- `activeRoute: Route | null`, `alternativeRoutes: Route[]`, `isCalculating: boolean`, `error: string | null`

**aiStore**:
- `messages: ChatMessage[]`, `isStreaming: boolean`, `pendingSuggestion: AiSuggestion | null`, `isChatOpen: boolean`
- actions: `addMessage`, `appendToLastMessage`, `setPendingSuggestion`, `toggleChat`, `clearHistory`

**savedRoutesStore**:
- `routes: SavedRoute[]` (initialized from localStorage)
- actions: `saveRoute`, `deleteRoute`

## Phase 5 — Service Layer

### googleMapsService.ts
- `loadGoogleMaps()` — singleton loader, libraries: `['places', 'geometry']`
- `calculateRoute(waypoints, travelMode)` — returns `DirectionsResult`
- `optimizeWaypoints: false` — optimization is handled by Claude, not Google

### claudeService.ts (IMPORTANT: via proxy, not directly)
- `sendMessageToClaude(messages, systemPrompt, onChunk)` — SSE streaming
- URL: `/api/claude` (proxied to `https://api.anthropic.com/v1/messages`)
- Dev: Vite proxy in `vite.config.ts`
- Prod: Vercel/Cloudflare Worker

```ts
// vite.config.ts — dev proxy
server: {
  proxy: {
    '/api/claude': {
      target: 'https://api.anthropic.com/v1/messages',
      changeOrigin: true,
      rewrite: () => '',
      configure: (proxy) => {
        proxy.on('proxyReq', (proxyReq) => {
          proxyReq.setHeader('x-api-key', process.env.VITE_CLAUDE_API_KEY)
          proxyReq.setHeader('anthropic-version', '2023-06-01')
        })
      }
    }
  }
}
```

### storageService.ts
- `loadRoutes(): SavedRoute[]`
- `persistRoutes(routes: SavedRoute[]): void`
- localStorage key: `route_planner_saved_routes`

## Phase 6 — Composables

- **useGoogleMaps(mapContainerRef)** — initializes the map, returns `{ mapInstance, isLoaded, loadError }`
- **usePlacesAutocomplete(inputRef)** — returns `{ selectedPlace, initialize }`
- **useDirections(mapInstance, rendererRef)** — `renderRoute()`, reads from waypointStore, writes to routeStore
- **useRouteOptimizer()** — `optimizeRoute()`, `sendUserMessage(text)`, builds context from store, parses JSON from Claude response

## Phase 7 — Component Build Order
1. Vuetify theme setup (colors, fonts) in `plugins/vuetify.ts`
2. WaypointSearch.vue — uses usePlacesAutocomplete + `v-autocomplete`, emits `place-selected`
3. WaypointItem.vue + WaypointList.vue — drag-to-reorder via HTML5 DnD
4. MapView.vue — map init, watch waypointStore → renderRoute()
5. DirectionsRenderer integration in MapView
6. RouteSummary.vue — reads from routeStore
7. AiMessage.vue + AiChatPanel.vue + AiSuggestionCard.vue
8. SaveRouteModal.vue + SavedRoutesList.vue
9. HomeView.vue — layout assembly (sidebar + map + AI drawer)

## Phase 8 — AI Prompt Engineering

Claude system prompt:
- Role: route optimization expert, concise answers (< 150 words)
- Structured output: JSON block at the end for reorder suggestions
- JSON format:
  ```json
  { "type": "reorder", "proposedOrder": ["id1", "id2"], "summary": "..." }
  ```
- Constraints: only use provided waypoint IDs, do not invent addresses
- Context: pass only waypoints list + summary stats (no geometry)

## Phase 9 — Backend Proxy (production)

`api/claude.ts` — Vercel Serverless Function:
- Accepts POST, proxies to Anthropic API with streaming
- `CLAUDE_API_KEY` — server env variables only, never in the frontend
- Required for deployment; without it the key would leak to the browser

## Phase 10 — Error Handling, Tests, Polish

### Error Boundaries:
- Google Maps load failure → fullscreen error + retry
- Directions API error → toast + routeStore.error, waypoints are preserved
- Claude API error → message in chat, history is not cleared
- localStorage quota → toast with warning

### Tests (Vitest):
```bash
npm install -D vitest @vue/test-utils happy-dom
```
- `storageService.test.ts` — mocked localStorage
- `waypointStore.test.ts` — add/remove/reorder logic
- `useRouteOptimizer.test.ts` — prompt building + suggestion parsing


## Phase 11 — Additional Features (Backlog)

### High priority
- **Travel mode** — driving / walking / cycling / transit selector. One button, Google Directions API already supports it via `travelMode` param in `calculateRoute()`
- **"Open in Google Maps"** — button to open the built route in native Google Maps app. Encode as `https://www.google.com/maps/dir/?api=1&origin=...&destination=...&waypoints=...`
- **Departure time → ETA per stop** — user sets departure time, app shows estimated arrival at each waypoint

### Medium priority
- **Alternative routes** — Google returns up to 3 alternatives (`provideRouteAlternatives: true`). `alternativeRoutes` in routeStore already exists, just unused
- **Share route via URL** — encode waypoints as URL params (base64 or JSON), share as a link
- **Fuel cost estimate** — user inputs fuel consumption (l/100km) + price per litre → app shows estimated trip cost

### Low priority / UX polish
- **Undo/redo** for waypoint changes
- **Dark mode** — Vuetify supports it natively via theme toggle
- **Drag markers on map** — reorder stops by dragging directly on the map