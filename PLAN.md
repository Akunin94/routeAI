# Route Planner AI — Implementation Plan

## UI Library — Vuetify 3
- Самая популярная UI библиотека для Vue 3 (Material Design 3)
- Заменяет Tailwind CSS (они конфликтуют — используем только Vuetify)
- Установка:
  ```bash
  npm install vuetify @mdi/font
  npm install -D vite-plugin-vuetify
  ```
- Конфигурация в `main.ts`:
  ```ts
  import { createVuetify } from 'vuetify'
  import * as components from 'vuetify/components'
  import * as directives from 'vuetify/directives'
  import 'vuetify/styles'
  import '@mdi/font/css/materialdesignicons.css'

  const vuetify = createVuetify({ components, directives, icons: { defaultSet: 'mdi' } })
  app.use(vuetify)
  ```
- Используемые компоненты вместо кастомных AppXxx:
  - `v-btn` → AppButton
  - `v-text-field` / `v-autocomplete` → AppInput / WaypointSearch
  - `v-dialog` → AppModal / SaveRouteModal
  - `v-navigation-drawer` → боковая панель
  - `v-snackbar` → AppToast / уведомления
  - `v-progress-circular` → AppSpinner
  - `v-list` / `v-list-item` → WaypointList / SavedRoutesList
  - `v-card` → AiSuggestionCard
  - `v-sheet` → AiChatPanel

## Phase 1 — Project Scaffolding
- Vite + Vue 3 + TypeScript init
- Dependencies: Pinia, Vue Router, Vuetify 3, `@mdi/font`, `@googlemaps/js-api-loader`, `axios`, `@vueuse/core`, `uuid`, `marked`
- Dev deps: `vite-plugin-vuetify`, `@types/google.maps`, `vitest`, `@vue/test-utils`, `happy-dom`
- `.env` с ключами (сразу в `.gitignore`):
  - `VITE_GOOGLE_MAPS_API_KEY`
  - `VITE_CLAUDE_API_KEY` (только для dev proxy)
  - `VITE_CLAUDE_MODEL=claude-opus-4-6`
- Path alias `@/` → `src/` в `vite.config.ts` и `tsconfig.json`
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
│       └── (нет кастомных — используем Vuetify напрямую)
├── views/
│   └── HomeView.vue
├── router/
│   └── index.ts
├── App.vue
└── main.ts
```

## Phase 3 — Type Definitions
Все типы до написания любого компонента или store.

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
  proposedOrder?: string[]   // waypoint IDs в новом порядке
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

### Порядок: waypointStore → routeStore → aiStore → savedRoutesStore

**waypointStore** — главный store, источник правды:
- `waypoints: Waypoint[]`
- computed: `origin`, `destination`, `stops`, `hasEnoughWaypoints`
- actions: `addWaypoint`, `removeWaypoint`, `reorderWaypoints(orderedIds: string[])`, `loadWaypoints`, `clearWaypoints`

**routeStore**:
- `activeRoute: Route | null`, `alternativeRoutes: Route[]`, `isCalculating: boolean`, `error: string | null`

**aiStore**:
- `messages: ChatMessage[]`, `isStreaming: boolean`, `pendingSuggestion: AiSuggestion | null`, `isChatOpen: boolean`
- actions: `addMessage`, `appendToLastMessage`, `setPendingSuggestion`, `toggleChat`, `clearHistory`

**savedRoutesStore**:
- `routes: SavedRoute[]` (инициализируется из localStorage)
- actions: `saveRoute`, `deleteRoute`

## Phase 5 — Service Layer

### googleMapsService.ts
- `loadGoogleMaps()` — singleton loader, libraries: `['places', 'geometry']`
- `calculateRoute(waypoints, travelMode)` — возвращает `DirectionsResult`
- `optimizeWaypoints: false` — оптимизацию делает Claude, не Google

### claudeService.ts (ВАЖНО: через proxy, не напрямую)
- `sendMessageToClaude(messages, systemPrompt, onChunk)` — SSE стриминг
- URL: `/api/claude` (проксируется на `https://api.anthropic.com/v1/messages`)
- Dev: Vite proxy в `vite.config.ts`
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
- Ключ localStorage: `route_planner_saved_routes`

## Phase 6 — Composables

- **useGoogleMaps(mapContainerRef)** — инициализирует карту, возвращает `{ mapInstance, isLoaded, loadError }`
- **usePlacesAutocomplete(inputRef)** — возвращает `{ selectedPlace, initialize }`
- **useDirections(mapInstance, rendererRef)** — `renderRoute()`, читает из waypointStore, пишет в routeStore
- **useRouteOptimizer()** — `optimizeRoute()`, `sendUserMessage(text)`, строит контекст из store, парсит JSON из ответа Claude

## Phase 7 — Порядок сборки компонентов
1. Настройка Vuetify темы (цвета, шрифты) в `plugins/vuetify.ts`
2. WaypointSearch.vue — использует usePlacesAutocomplete + `v-autocomplete`, emits `place-selected`
3. WaypointItem.vue + WaypointList.vue — drag-to-reorder через HTML5 DnD
4. MapView.vue — инит карты, watch на waypointStore → renderRoute()
5. DirectionsRenderer интеграция в MapView
6. RouteSummary.vue — читает из routeStore
7. AiMessage.vue + AiChatPanel.vue + AiSuggestionCard.vue
8. SaveRouteModal.vue + SavedRoutesList.vue
9. HomeView.vue — сборка layout (sidebar + map + AI drawer)

## Phase 8 — AI Prompt Engineering

Системный промпт Claude:
- Роль: эксперт по маршрутам, лаконичные ответы (< 150 слов)
- Структурированный вывод: JSON-блок в конце для предложений по перестановке
- Формат JSON:
  ```json
  { "type": "reorder", "proposedOrder": ["id1", "id2"], "summary": "..." }
  ```
- Ограничения: только переданные waypoint ID, не выдумывать адреса
- Контекст: передавать только список waypoints + суммарные stats (не геометрию)

## Phase 9 — Backend Proxy (продакшн)

`api/claude.ts` — Vercel Serverless Function:
- Принимает POST, проксирует на Anthropic API со стримингом
- `CLAUDE_API_KEY` — только в env переменных сервера, никогда во фронтенде
- Обязателен для деплоя, без него ключ утечёт в браузер

## Phase 10 — Error Handling, Tests, Polish

### Error Boundaries:
- Google Maps load failure → fullscreen error + retry
- Directions API error → toast + routeStore.error, waypoints сохраняются
- Claude API error → сообщение в чате, история не очищается
- localStorage quota → toast с предупреждением

### Тесты (Vitest):
```bash
npm install -D vitest @vue/test-utils happy-dom
```
- `storageService.test.ts` — mocked localStorage
- `waypointStore.test.ts` — add/remove/reorder logic
- `useRouteOptimizer.test.ts` — prompt building + suggestion parsing

## Layout (HomeView.vue)
```
┌─────────────────┬──────────────────────────┐
│  v-navigation-  │  Map (flex-1)            │
│  drawer (400px) │                          │
│                 │                          │
│  [Search input] │  Google Maps             │
│  [Waypoint 1]   │                          │
│  [Waypoint 2]   │           [AI Button] 🤖 │
│  [+ Add Stop]   │                          │
│  ─────────────  │  ┌─────────────────────┐ │
│  [Calc Route]   │  │  AI Chat Drawer     │ │
│  [Save Route]   │  │  (slides in/out)    │ │
│  ─────────────  │  └─────────────────────┘ │
│  Route Summary  │                          │
│  ─────────────  │                          │
│  Saved Routes   │                          │
└─────────────────┴──────────────────────────┘
```
