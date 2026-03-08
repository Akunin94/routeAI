<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'
import type { ChatMessage } from '@/types/ai'

const props = defineProps<{ message: ChatMessage }>()

const isUser = computed(() => props.message.role === 'user')

const htmlContent = computed(() => {
  try {
    return marked.parse(props.message.content) as string
  } catch {
    return props.message.content
  }
})
</script>

<template>
  <div :class="['d-flex', 'mb-2', isUser ? 'justify-end' : 'justify-start']">
    <v-sheet
      :color="isUser ? 'primary' : 'surface-variant'"
      class="pa-3 rounded-lg message-bubble"
      max-width="85%"
    >
      <div
        :class="['text-body-2', isUser ? 'text-white' : '']"
        v-html="htmlContent"
      />
    </v-sheet>
  </div>
</template>

<style scoped>
.message-bubble {
  word-break: break-word;
}

.message-bubble :deep(pre) {
  margin-top: 12px;
  margin-bottom: 12px;
  white-space: pre-wrap;
  word-break: break-all;
  overflow-x: hidden;
}
</style>
