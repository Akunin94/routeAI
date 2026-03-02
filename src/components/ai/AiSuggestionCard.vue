<script setup lang="ts">
import type { AiSuggestion } from '@/types/ai'

defineProps<{ suggestion: AiSuggestion }>()

const emit = defineEmits<{ apply: []; dismiss: [] }>()
</script>

<template>
  <v-card variant="tonal" color="primary" class="ma-2 mb-0">
    <v-card-text class="pb-1">
      <div class="d-flex align-center mb-1">
        <v-icon size="16" class="mr-1">mdi-lightbulb-on-outline</v-icon>
        <span class="text-caption font-weight-bold text-uppercase">AI Suggestion</span>
      </div>
      <p class="text-body-2 mb-0">{{ suggestion.summary }}</p>
    </v-card-text>
    <v-card-actions class="pt-0">
      <v-btn size="small" color="primary" variant="flat" @click="emit('apply')">Apply</v-btn>
      <v-btn size="small" variant="text" @click="emit('dismiss')">Dismiss</v-btn>
    </v-card-actions>
  </v-card>
</template>
