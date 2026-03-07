<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { useGoogleMaps } from '@/composables/useGoogleMaps'
import { useDirections } from '@/composables/useDirections'
import { useWaypointStore } from '@/stores/waypointStore'
import { useRouteStore } from '@/stores/routeStore'
import MapMarker from './MapMarker.vue'

const mapContainer = ref<HTMLElement | null>(null)
const waypointStore = useWaypointStore()
const routeStore = useRouteStore()

const { mapInstance, isLoaded, loadError } = useGoogleMaps(mapContainer)

function reloadPage() { window.location.reload() }
const { renderRoute, clearRoute } = useDirections(mapInstance)

watch(
  () => waypointStore.waypoints,
  (wps) => {
    if (wps.length >= 2) {
      renderRoute()
    } else {
      clearRoute()
    }
  },
  { deep: true },
)

watch(
  () => routeStore.travelMode,
  () => {
    if (waypointStore.hasEnoughWaypoints) renderRoute()
  },
)

let departureTimeTimer: ReturnType<typeof setTimeout> | null = null
watch(
  () => routeStore.departureTime,
  () => {
    if (departureTimeTimer) clearTimeout(departureTimeTimer)
    departureTimeTimer = setTimeout(() => {
      if (waypointStore.hasEnoughWaypoints) renderRoute()
    }, 600)
  },
)

onUnmounted(() => clearRoute())

defineExpose({ renderRoute })
</script>

<template>
  <div class="map-wrapper">
    <div ref="mapContainer" class="map-container" />

    <div v-if="!isLoaded && !loadError" class="map-overlay d-flex align-center justify-center">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <div
      v-if="loadError"
      class="map-overlay d-flex align-center justify-center flex-column text-center pa-6"
    >
      <v-icon size="48" color="error">mdi-map-marker-off</v-icon>
      <p class="mt-2 text-body-1">Failed to load map</p>
      <p class="text-caption text-medium-emphasis mb-4">{{ loadError }}</p>
      <v-btn color="primary" variant="tonal" prepend-icon="mdi-refresh" @click="reloadPage">
        Reload page
      </v-btn>
    </div>

    <template v-if="isLoaded && mapInstance">
      <MapMarker
        v-for="wp in waypointStore.waypoints"
        :key="wp.id"
        :map="mapInstance"
        :position="wp.location"
        :label="wp.label"
        :address="wp.address"
        :is-origin="wp.isOrigin"
        :is-destination="wp.isDestination"
      />
    </template>
  </div>
</template>

<style scoped>
.map-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}
.map-container {
  width: 100%;
  height: 100%;
}
.map-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.9);
}
</style>
