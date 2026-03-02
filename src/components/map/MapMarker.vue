<script setup lang="ts">
import { watch, onUnmounted } from 'vue'

const props = defineProps<{
  map: google.maps.Map | null
  position: { lat: number; lng: number }
  label: string
  isOrigin: boolean
  isDestination: boolean
}>()

let marker: google.maps.Marker | null = null

function getIconColor(): string {
  if (props.isOrigin) return '#4CAF50'
  if (props.isDestination) return '#F44336'
  return '#2196F3'
}

function getMarkerLabel(): string {
  if (props.isOrigin) return 'A'
  if (props.isDestination) return 'B'
  return props.label.replace('Stop ', '')
}

function sync() {
  if (!props.map) return

  const icon: google.maps.Symbol = {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: getIconColor(),
    fillOpacity: 1,
    strokeColor: '#fff',
    strokeWeight: 2,
    scale: 11,
  }

  const labelOpt: google.maps.MarkerLabel = {
    text: getMarkerLabel(),
    color: '#fff',
    fontSize: '11px',
    fontWeight: 'bold',
  }

  if (!marker) {
    marker = new google.maps.Marker({
      map: props.map,
      position: props.position,
      icon,
      label: labelOpt,
    })
  } else {
    marker.setPosition(props.position)
    marker.setIcon(icon)
    marker.setLabel(labelOpt)
  }
}

watch(
  () => [props.map, props.position.lat, props.position.lng, props.isOrigin, props.isDestination],
  sync,
  { immediate: true },
)

onUnmounted(() => {
  marker?.setMap(null)
  marker = null
})
</script>

<template><!-- renderless --></template>
