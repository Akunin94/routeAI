<script setup lang="ts">
import { ref } from 'vue'
import type { Waypoint } from '@/types/waypoint'
import type { PlaceResult } from '@/types/maps'
import WaypointSearch from './WaypointSearch.vue'

const props = defineProps<{
  waypoint: Waypoint
  isDragging?: boolean
}>()

const emit = defineEmits<{
  remove: [id: string]
  update: [id: string, place: PlaceResult]
  editStart: []
  editEnd: []
}>()

const editing = ref(false)

function startEdit() {
  editing.value = true
  emit('editStart')
}

function cancelEdit() {
  editing.value = false
  emit('editEnd')
}

function onPlaceSelected(place: PlaceResult) {
  editing.value = false
  emit('editEnd')
  emit('update', props.waypoint.id, place)
}

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
  <!-- Edit mode: full-width flex row, no v-list-item constraints -->
  <div v-if="editing" class="edit-row px-2 py-1">
    <v-avatar :color="getColor(waypoint)" size="26" class="flex-shrink-0 mr-2">
      <v-icon size="14" color="white">{{ getIcon(waypoint) }}</v-icon>
    </v-avatar>
    <WaypointSearch
      :label="waypoint.label"
      :initial-value="waypoint.address"
      class="flex-1-1"
      @place-selected="onPlaceSelected"
    />
    <v-btn
      icon="mdi-close"
      size="x-small"
      variant="text"
      color="grey"
      class="flex-shrink-0 ml-1"
      @click="cancelEdit"
    />
  </div>

  <!-- Normal mode -->
  <v-list-item
    v-else
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
        icon="mdi-pencil"
        size="x-small"
        variant="text"
        color="grey"
        @click="startEdit"
      />
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
.edit-row {
  display: flex;
  align-items: center;
  min-height: 52px;
}
</style>
