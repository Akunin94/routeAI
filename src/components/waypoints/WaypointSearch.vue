<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { usePlacesAutocomplete } from '@/composables/usePlacesAutocomplete'
import type { PlaceResult } from '@/types/maps'

const props = defineProps<{ label: string; initialValue?: string }>()

const emit = defineEmits<{ 'place-selected': [place: PlaceResult] }>()

const wrapperRef = ref<HTMLElement | null>(null)
const inputText = ref(props.initialValue ?? '')

const { selectedPlace, initialize, reset } = usePlacesAutocomplete()
let cleanup: (() => void) | null = null

onMounted(async () => {
  await nextTick()
  const input = wrapperRef.value?.querySelector('input')
  if (!input) return
  cleanup = await initialize(input as HTMLInputElement)
  input.focus()
  input.select()
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
      clearable
      hide-details
      autocomplete="off"
      @click:clear="inputText = ''"
    />
  </div>
</template>
