<script setup lang="ts">
import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { useWaypointStore } from '@/stores/waypointStore'
import { useRouteStore } from '@/stores/routeStore'
import { useAiStore } from '@/stores/aiStore'
import { useSavedRoutesStore } from '@/stores/savedRoutesStore'
import type { PlaceResult } from '@/types/maps'
import type { SavedRoute } from '@/types/route'
import MapView from '@/components/map/MapView.vue'
import WaypointSearch from '@/components/waypoints/WaypointSearch.vue'
import WaypointList from '@/components/waypoints/WaypointList.vue'
import RouteSummary from '@/components/routes/RouteSummary.vue'
import SaveRouteModal from '@/components/routes/SaveRouteModal.vue'
import SavedRoutesList from '@/components/routes/SavedRoutesList.vue'
import AiChatPanel from '@/components/ai/AiChatPanel.vue'

const waypointStore = useWaypointStore()
const routeStore = useRouteStore()
const aiStore = useAiStore()
const savedRoutesStore = useSavedRoutesStore()

const mapViewRef = ref<InstanceType<typeof MapView> | null>(null)
const saveModalOpen = ref(false)
const savedExpanded = ref(false)

const searchLabel = computed(() => {
  if (waypointStore.waypoints.length === 0) return 'Add origin'
  if (waypointStore.waypoints.length === 1) return 'Add destination'
  return 'Add stop'
})

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
</script>

<template>
  <!-- Left sidebar -->
  <v-navigation-drawer permanent width="380">
    <v-toolbar density="compact" color="primary" flat>
      <v-icon class="ml-3 mr-2">mdi-map-marker-path</v-icon>
      <v-toolbar-title class="text-body-1 font-weight-bold">Route Planner AI</v-toolbar-title>
    </v-toolbar>

    <div class="pa-3">
      <WaypointSearch :label="searchLabel" @place-selected="onPlaceSelected" />
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

    <RouteSummary />

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

  <!-- Map area -->
  <v-main>
    <div style="position: relative; height: 100vh;">
      <MapView ref="mapViewRef" style="height: 100%; width: 100%;" />

      <!-- AI toggle FAB -->
      <v-btn
        icon
        color="primary"
        size="large"
        elevation="4"
        style="position: absolute; bottom: 24px; right: 24px;"
        @click="aiStore.toggleChat()"
      >
        <v-icon>mdi-robot</v-icon>
      </v-btn>
    </div>

    <AiChatPanel />
  </v-main>

  <SaveRouteModal v-model="saveModalOpen" @save="handleSaveRoute" />
</template>
