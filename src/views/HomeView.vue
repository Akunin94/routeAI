<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { useWaypointStore } from '@/stores/waypointStore'
import { useRouteStore } from '@/stores/routeStore'
import { useAiStore } from '@/stores/aiStore'
import { useSavedRoutesStore } from '@/stores/savedRoutesStore'
import type { PlaceResult } from '@/types/maps'
import type { SavedRoute } from '@/types/route'
import type { Waypoint } from '@/types/waypoint'
import MapView from '@/components/map/MapView.vue'
import WaypointSearch from '@/components/waypoints/WaypointSearch.vue'
import WaypointList from '@/components/waypoints/WaypointList.vue'
import RouteSummary from '@/components/routes/RouteSummary.vue'
import SaveRouteModal from '@/components/routes/SaveRouteModal.vue'
import SavedRoutesList from '@/components/routes/SavedRoutesList.vue'
import AiChatPanel from '@/components/ai/AiChatPanel.vue'
import { downloadRouteCsv } from '@/utils/routeCsv'
import { parseFile, resolveCoordinates } from '@/utils/routeImport'

const waypointStore = useWaypointStore()
const routeStore = useRouteStore()
const aiStore = useAiStore()
const savedRoutesStore = useSavedRoutesStore()

const mapViewRef = ref<InstanceType<typeof MapView> | null>(null)
const saveModalOpen = ref(false)
const savedExpanded = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const importLoading = ref(false)
const importProgress = ref(0)
const importTotal = ref(0)

const showRouteError = ref(false)
const showStorageError = ref(false)
const showImportError = ref(false)
const importError = ref('')

watch(() => routeStore.error, (val) => { if (val) showRouteError.value = true })
watch(() => savedRoutesStore.storageError, (val) => { if (val) showStorageError.value = true })

const searchLabel = computed(() => {
  if (waypointStore.waypoints.length === 0) return 'Add origin'
  if (waypointStore.waypoints.length === 1) return 'Add destination'
  return 'Add stop'
})

const showRoutePanel = computed(() =>
  !!(routeStore.activeRoute || routeStore.isCalculating || routeStore.error)
)

function onPlaceSelected(place: PlaceResult) {
  waypointStore.addWaypoint({
    address: place.address,
    placeId: place.placeId,
    location: place.location,
  })
}

function handleSaveRoute(name: string) {
  if (!routeStore.activeRoute) return
  const saved: SavedRoute = {
    ...routeStore.activeRoute,
    id: uuidv4(),
    name,
    savedAt: Date.now(),
  }
  savedRoutesStore.saveRoute(saved)
}

function handleClearAll() {
  waypointStore.clearWaypoints()
  routeStore.clearRoute()
  aiStore.clearHistory()
}

function triggerFileUpload() {
  fileInputRef.value?.click()
}

async function handleFileSelected(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  // Reset input so the same file can be re-uploaded
  ;(event.target as HTMLInputElement).value = ''

  const text = await file.text()
  const parsed = parseFile(text)
  if (parsed.length === 0) {
    importError.value = 'No valid addresses found in the file.'
    showImportError.value = true
    return
  }

  importLoading.value = true
  importProgress.value = 0
  importTotal.value = parsed.length

  try {
    const resolved = await resolveCoordinates(parsed, (done, total) => {
      importProgress.value = done
      importTotal.value = total
    })
    const newWaypoints: Waypoint[] = resolved.map((wp, i) => ({
      id: uuidv4(),
      address: wp.address,
      location: { lat: wp.lat, lng: wp.lng },
      order: i,
      isOrigin: i === 0,
      isDestination: i === resolved.length - 1 && resolved.length > 1,
      label: i === 0 ? 'Origin' : i === resolved.length - 1 && resolved.length > 1 ? 'Destination' : `Stop ${i}`,
    }))
    routeStore.clearRoute()
    waypointStore.loadWaypoints(newWaypoints)
  } catch (err) {
    importError.value = err instanceof Error ? err.message : 'Import failed.'
    showImportError.value = true
  } finally {
    importLoading.value = false
  }
}
</script>

<template>
  <!-- Left sidebar — controls -->
  <v-navigation-drawer permanent width="280" style="z-index: 1006;">
    <v-toolbar density="compact" color="primary" flat>
      <v-icon class="ml-3 mr-2">mdi-map-marker-path</v-icon>
      <v-toolbar-title class="text-body-1 font-weight-bold">Route Planner AI</v-toolbar-title>
    </v-toolbar>

    <div class="pa-3 d-flex flex-column" style="gap: 8px;">
      <WaypointSearch :label="searchLabel" @place-selected="onPlaceSelected" />
      <v-btn
        block
        variant="tonal"
        color="secondary"
        size="small"
        prepend-icon="mdi-upload-outline"
        :loading="importLoading"
        @click="triggerFileUpload"
      >
        {{ importLoading ? `Geocoding ${importProgress}/${importTotal}…` : 'Upload file' }}
      </v-btn>
      <input
        ref="fileInputRef"
        type="file"
        accept=".csv,.tsv,.txt"
        style="display: none;"
        @change="handleFileSelected"
      />
    </div>

    <WaypointList v-if="waypointStore.waypoints.length > 0" />

    <div
      v-if="waypointStore.waypoints.length > 0"
      class="px-3 pb-2 d-flex flex-column"
      style="gap: 8px;"
    >
      <v-divider class="mb-1" />

      <v-btn
        block
        color="primary"
        variant="flat"
        prepend-icon="mdi-directions"
        :loading="routeStore.isCalculating"
        :disabled="!waypointStore.hasEnoughWaypoints"
        @click="mapViewRef?.renderRoute()"
      >
        Calculate Route
      </v-btn>

      <v-btn
        block
        color="secondary"
        variant="tonal"
        prepend-icon="mdi-content-save-outline"
        :disabled="!routeStore.activeRoute"
        @click="saveModalOpen = true"
      >
        Save Route
      </v-btn>

      <v-btn
        block
        variant="text"
        color="error"
        prepend-icon="mdi-delete-sweep-outline"
        @click="handleClearAll"
      >
        Clear All
      </v-btn>
    </div>

    <v-divider class="mx-3 my-2" />

    <div
      class="d-flex align-center px-3 py-1"
      style="cursor: pointer; user-select: none;"
      @click="savedExpanded = !savedExpanded"
    >
      <v-icon size="16" class="mr-1">
        {{ savedExpanded ? 'mdi-chevron-down' : 'mdi-chevron-right' }}
      </v-icon>
      <span class="text-caption font-weight-bold text-uppercase text-medium-emphasis">
        Saved Routes ({{ savedRoutesStore.routes.length }})
      </span>
    </div>

    <SavedRoutesList v-if="savedExpanded" />
  </v-navigation-drawer>

  <!-- Route Details Panel — slides in to the right of the sidebar -->
  <Transition name="slide-panel">
    <div v-if="showRoutePanel" class="route-details-panel elevation-4">
      <v-toolbar density="compact" color="surface-variant" flat>
        <v-icon class="ml-3 mr-2" color="primary">mdi-routes</v-icon>
        <v-toolbar-title class="text-body-2 font-weight-bold">Route Details</v-toolbar-title>
        <template #append>
          <v-btn
            v-if="routeStore.activeRoute"
            icon="mdi-download-outline"
            size="small"
            variant="text"
            title="Download TSV"
            :disabled="routeStore.isCalculating"
            @click="downloadRouteCsv(routeStore.activeRoute!)"
          />
          <v-btn
            icon="mdi-close"
            size="small"
            variant="text"
            @click="routeStore.clearRoute()"
          />
        </template>
      </v-toolbar>
      <v-divider />
      <div class="overflow-y-auto" style="height: calc(100vh - 48px);">
        <RouteSummary />
      </div>
    </div>
  </Transition>

  <!-- Map area -->
  <v-main>
    <div style="position: relative; height: 100vh;">
      <MapView ref="mapViewRef" style="height: 100%; width: 100%;" />

      <!-- AI toggle FAB -->
      <v-btn
        color="primary"
        size="large"
        elevation="6"
        rounded="pill"
        prepend-icon="mdi-robot"
        style="position: absolute; top: 16px; right: 16px;"
        @click="aiStore.toggleChat()"
      >
        AI Assistant
      </v-btn>
    </div>

    <AiChatPanel />
  </v-main>

  <SaveRouteModal v-model="saveModalOpen" @save="handleSaveRoute" />

  <v-snackbar v-model="showRouteError" color="error" timeout="5000">
    {{ routeStore.error }}
    <template #actions>
      <v-btn variant="text" @click="showRouteError = false">Close</v-btn>
    </template>
  </v-snackbar>

  <v-snackbar v-model="showStorageError" color="warning" timeout="5000">
    {{ savedRoutesStore.storageError }}
    <template #actions>
      <v-btn variant="text" @click="showStorageError = false">Close</v-btn>
    </template>
  </v-snackbar>

  <v-snackbar v-model="showImportError" color="error" timeout="6000">
    {{ importError }}
    <template #actions>
      <v-btn variant="text" @click="showImportError = false">Close</v-btn>
    </template>
  </v-snackbar>
</template>

<style scoped>
.route-details-panel {
  position: fixed;
  top: 0;
  left: 280px;
  width: 300px;
  height: 100vh;
  background: rgb(var(--v-theme-surface));
  z-index: 1005;
  display: flex;
  flex-direction: column;
}

.slide-panel-enter-active,
.slide-panel-leave-active {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-panel-enter-from,
.slide-panel-leave-to {
  transform: translateX(-100%);
}
</style>
