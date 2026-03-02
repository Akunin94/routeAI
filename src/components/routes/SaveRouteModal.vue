<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{ modelValue: boolean }>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  save: [name: string]
}>()

const routeName = ref('')

watch(
  () => props.modelValue,
  (open) => {
    if (open) routeName.value = ''
  },
)

function handleSave() {
  if (!routeName.value.trim()) return
  emit('save', routeName.value.trim())
  emit('update:modelValue', false)
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="400"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title>Save Route</v-card-title>
      <v-card-text>
        <v-text-field
          v-model="routeName"
          label="Route name"
          variant="outlined"
          density="compact"
          autofocus
          hide-details
          @keyup.enter="handleSave"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="emit('update:modelValue', false)">Cancel</v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :disabled="!routeName.trim()"
          @click="handleSave"
        >
          Save
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
