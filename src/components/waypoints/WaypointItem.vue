<script setup lang="ts">
import type { Waypoint } from '@/types/waypoint'

defineProps<{
  waypoint: Waypoint
  isDragging?: boolean
}>()

const emit = defineEmits<{ remove: [id: string] }>()

function getColor(wp: Waypoint): string {
  if (wp.isOrigin) return 'success'
  if (wp.isDestination) return 'error'
  return 'primary'
}

function getIcon(wp: Waypoint): string {
  if (wp.isOrigin) return 'mdi-map-marker-star'
  if (wp.isDestination) return 'mdi-flag-checkered'
  return 'mdi-map-marker'
}
</script>

<template>
  <v-list-item
    :class="{ 'bg-blue-lighten-5': isDragging }"
    min-height="52"
    class="px-2"
  >
    <template #prepend>
      <v-icon class="drag-handle mr-1" color="grey-lighten-1" size="20">
        mdi-drag-vertical
      </v-icon>
      <v-avatar :color="getColor(waypoint)" size="26" class="mr-2">
        <v-icon size="14" color="white">{{ getIcon(waypoint) }}</v-icon>
      </v-avatar>
    </template>

    <v-list-item-title class="text-body-2 font-weight-medium">
      {{ waypoint.label }}
    </v-list-item-title>
    <v-list-item-subtitle class="text-caption text-truncate">
      {{ waypoint.address }}
    </v-list-item-subtitle>

    <template #append>
      <v-btn
        icon="mdi-close"
        size="x-small"
        variant="text"
        color="grey"
        @click="emit('remove', waypoint.id)"
      />
    </template>
  </v-list-item>
</template>

<style scoped>
.drag-handle {
  cursor: grab;
}
.drag-handle:active {
  cursor: grabbing;
}
</style>
