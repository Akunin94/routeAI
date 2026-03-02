<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { usePlacesAutocomplete } from '@/composables/usePlacesAutocomplete'
import type { PlaceResult } from '@/types/maps'

defineProps<{ label: string }>()

const emit = defineEmits<{ 'place-selected': [place: PlaceResult] }>()

const wrapperRef = ref<HTMLElement | null>(null)
const inputText = ref('')

const { selectedPlace, initialize, reset } = usePlacesAutocomplete()
let cleanup: (() => void) | null = null

onMounted(async () => {
  await nextTick()
  const input = wrapperRef.value?.querySelector('input')
  if (!input) return
  cleanup = await initialize(input as HTMLInputElement)
})

onUnmounted(() => cleanup?.())

watch(selectedPlace, (place) => {
  if (!place) return
  emit('place-selected', place)
  inputText.value = ''
  reset()
})
</script>

<template>
  <div ref="wrapperRef">
    <v-text-field
      v-model="inputText"
      :label="label"
      variant="outlined"
      density="compact"
      prepend-inner-icon="mdi-map-search-outline"
      clearable
      hide-details
      autocomplete="off"
      @click:clear="inputText = ''"
    />
  </div>
</template>
