<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { useTheme } from 'vuetify'
import { useGoogleMaps } from '@/composables/useGoogleMaps'
import { useDirections } from '@/composables/useDirections'
import { useWaypointStore } from '@/stores/waypointStore'
import { useRouteStore } from '@/stores/routeStore'
import MapMarker from './MapMarker.vue'

const DARK_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#263c3f' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#6b9a76' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#38414e' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca5b3' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#746855' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1f2835' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#f3d19c' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
  { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#515c6d' }] },
  { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#17263c' }] },
]

const mapContainer = ref<HTMLElement | null>(null)
const waypointStore = useWaypointStore()
const routeStore = useRouteStore()
const theme = useTheme()

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

// Apply dark/light styles whenever map loads or theme toggles
watch(
  [mapInstance, () => theme.global.current.value.dark],
  ([map, isDark]) => {
    if (map) (map as google.maps.Map).setOptions({ styles: isDark ? DARK_MAP_STYLES : [] })
  },
  { immediate: true },
)

async function onMarkerDragEnd(waypointId: string, lat: number, lng: number) {
  const geocoder = new google.maps.Geocoder()
  const result = await geocoder.geocode({ location: { lat, lng } })
  const address = result.results[0]?.formatted_address ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  waypointStore.updateWaypointLocation(waypointId, { lat, lng }, address)
}

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
        :waypoint-id="wp.id"
        @drag-end="onMarkerDragEnd"
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
