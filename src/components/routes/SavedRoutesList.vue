<script setup lang="ts">
import { useSavedRoutesStore } from '@/stores/savedRoutesStore'
import { useWaypointStore } from '@/stores/waypointStore'
import { useRouteStore } from '@/stores/routeStore'

const savedRoutesStore = useSavedRoutesStore()
const waypointStore = useWaypointStore()
const routeStore = useRouteStore()

function loadRoute(id: string) {
  const route = savedRoutesStore.routes.find((r) => r.id === id)
  if (!route) return
  waypointStore.loadWaypoints(route.waypoints)
  routeStore.clearRoute()
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
</script>

<template>
  <div v-if="savedRoutesStore.routes.length === 0" class="text-center text-medium-emphasis pa-3">
    <v-icon size="28" class="mb-1">mdi-bookmark-outline</v-icon>
    <p class="text-caption">No saved routes</p>
  </div>

  <v-list v-else density="compact" class="pa-0">
    <v-list-item
      v-for="route in savedRoutesStore.routes"
      :key="route.id"
      class="px-3"
      min-height="48"
    >
      <v-list-item-title class="text-body-2 font-weight-medium">
        {{ route.name }}
      </v-list-item-title>
      <v-list-item-subtitle class="text-caption">
        {{ route.totalDistance.text }} · {{ route.totalDuration.text }} ·
        {{ formatDate(route.savedAt) }}
      </v-list-item-subtitle>
      <template #append>
        <v-btn
          icon="mdi-map-marker-path"
          size="x-small"
          variant="text"
          color="primary"
          title="Load route"
          @click="loadRoute(route.id)"
        />
        <v-btn
          icon="mdi-delete-outline"
          size="x-small"
          variant="text"
          color="error"
          title="Delete"
          @click="savedRoutesStore.deleteRoute(route.id)"
        />
      </template>
    </v-list-item>
  </v-list>
</template>
