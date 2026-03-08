<script setup lang="ts">
import { ref } from 'vue'
import { useWaypointStore } from '@/stores/waypointStore'
import WaypointItem from './WaypointItem.vue'
import type { PlaceResult } from '@/types/maps'

const waypointStore = useWaypointStore()
const draggedId = ref<string | null>(null)
const editingId = ref<string | null>(null)

function onDragStart(_e: DragEvent, id: string) {
  draggedId.value = id
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
}

function onDrop(e: DragEvent, targetId: string) {
  e.preventDefault()
  if (!draggedId.value || draggedId.value === targetId) {
    draggedId.value = null
    return
  }

  const ids = waypointStore.waypoints.map((w) => w.id)
  const fromIdx = ids.indexOf(draggedId.value)
  const toIdx = ids.indexOf(targetId)

  const newOrder = [...ids]
  newOrder.splice(fromIdx, 1)
  newOrder.splice(toIdx, 0, draggedId.value)

  waypointStore.reorderWaypoints(newOrder)
  draggedId.value = null
}

function onDragEnd() {
  draggedId.value = null
}

function onUpdate(id: string, place: PlaceResult) {
  waypointStore.updateWaypointLocation(id, place.location, place.address)
  const wp = waypointStore.waypoints.find(w => w.id === id)
  if (wp && place.placeId) wp.placeId = place.placeId
  editingId.value = null
}
</script>

<template>
  <v-list density="compact" class="pa-0">
    <div
      v-for="wp in waypointStore.waypoints"
      :key="wp.id"
      :draggable="editingId !== wp.id"
      @dragstart="editingId !== wp.id && onDragStart($event, wp.id)"
      @dragover="onDragOver"
      @drop="onDrop($event, wp.id)"
      @dragend="onDragEnd"
    >
      <WaypointItem
        :waypoint="wp"
        :is-dragging="draggedId === wp.id"
        @remove="waypointStore.removeWaypoint"
        @update="onUpdate"
        @edit-start="editingId = wp.id"
        @edit-end="editingId = null"
      />
    </div>
  </v-list>
</template>
