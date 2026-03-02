<script setup lang="ts">
import { useRouteStore } from '@/stores/routeStore'

const routeStore = useRouteStore()
</script>

<template>
  <div v-if="routeStore.activeRoute" class="px-3 pb-2">
    <v-divider class="mb-3" />
    <div class="text-caption text-medium-emphasis font-weight-bold mb-2 text-uppercase">
      Route Summary
    </div>

    <div class="d-flex ga-2 mb-3">
      <v-chip size="small" color="primary" prepend-icon="mdi-map-marker-distance">
        {{ routeStore.activeRoute.totalDistance.text }}
      </v-chip>
      <v-chip size="small" color="secondary" prepend-icon="mdi-clock-outline">
        {{ routeStore.activeRoute.totalDuration.text }}
      </v-chip>
    </div>

    <v-expansion-panels variant="accordion" density="compact">
      <v-expansion-panel
        v-for="(leg, i) in routeStore.activeRoute.legs"
        :key="i"
        :title="`Leg ${i + 1} · ${leg.distance.text} · ${leg.duration.text}`"
      >
        <v-expansion-panel-text>
          <p class="text-caption text-medium-emphasis">
            {{ leg.startAddress }}
          </p>
          <v-icon size="14" class="mx-1">mdi-arrow-down</v-icon>
          <p class="text-caption text-medium-emphasis">
            {{ leg.endAddress }}
          </p>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>

  <div v-else-if="routeStore.isCalculating" class="d-flex align-center px-3 py-2">
    <v-progress-circular indeterminate size="18" width="2" color="primary" class="mr-2" />
    <span class="text-body-2 text-medium-emphasis">Calculating route…</span>
  </div>

  <div v-else-if="routeStore.error" class="px-3 pb-2">
    <v-alert type="error" density="compact" variant="tonal">
      {{ routeStore.error }}
    </v-alert>
  </div>
</template>
