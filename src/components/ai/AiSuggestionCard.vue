<script setup lang="ts">
import { computed } from 'vue'
import type { AiSuggestion } from '@/types/ai'

const props = defineProps<{ suggestion: AiSuggestion }>()

const emit = defineEmits<{ apply: []; dismiss: [] }>()

// Only a reorder with a concrete order is actionable — other types (general,
// add_stop, avoid_area, time_suggestion) are informational, so no Apply button.
const canApply = computed(
  () => props.suggestion.type === 'reorder' && !!props.suggestion.proposedOrder?.length,
)
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
      <v-btn v-if="canApply" size="small" color="primary" variant="flat" @click="emit('apply')">Apply</v-btn>
      <v-btn size="small" variant="text" @click="emit('dismiss')">{{ canApply ? 'Dismiss' : 'Got it' }}</v-btn>
    </v-card-actions>
  </v-card>
</template>
