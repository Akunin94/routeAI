<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import { useAiStore } from '@/stores/aiStore'
import { useWaypointStore } from '@/stores/waypointStore'
import { useRouteOptimizer } from '@/composables/useRouteOptimizer'
import AiMessage from './AiMessage.vue'
import AiSuggestionCard from './AiSuggestionCard.vue'

const aiStore = useAiStore()
const waypointStore = useWaypointStore()
const { optimizeRoute, sendUserMessage } = useRouteOptimizer()

const inputText = ref('')
const messagesRef = ref<HTMLElement | null>(null)

async function handleSend() {
  const text = inputText.value.trim()
  if (!text || aiStore.isStreaming) return
  inputText.value = ''
  await sendUserMessage(text)
}

async function handleOptimize() {
  await optimizeRoute()
}

function handleApply() {
  const s = aiStore.pendingSuggestion
  if (s?.type === 'reorder' && s.proposedOrder) {
    waypointStore.reorderWaypoints(s.proposedOrder)
  }
  aiStore.setPendingSuggestion(null)
}

watch(
  () => aiStore.messages.length,
  async () => {
    await nextTick()
    if (messagesRef.value) {
      messagesRef.value.scrollTop = messagesRef.value.scrollHeight
    }
  },
)
</script>

<template>
  <v-card
    v-if="aiStore.isChatOpen"
    class="ai-panel"
    elevation="8"
    rounded="lg"
  >
    <v-toolbar density="compact" color="primary" flat rounded="0">
      <v-icon class="ml-3 mr-2">mdi-robot-outline</v-icon>
      <v-toolbar-title class="text-body-1">AI Route Assistant</v-toolbar-title>
      <template #append>
        <v-btn icon="mdi-close" size="small" variant="text" @click="aiStore.toggleChat()" />
      </template>
    </v-toolbar>

    <div ref="messagesRef" class="messages-area pa-3">
      <div
        v-if="aiStore.messages.length === 0"
        class="text-center text-medium-emphasis py-6"
      >
        <v-icon size="40" class="mb-2">mdi-chat-outline</v-icon>
        <p class="text-body-2 mb-3">Ask me to optimize your route!</p>
        <v-btn
          v-if="waypointStore.hasEnoughWaypoints"
          size="small"
          color="primary"
          variant="tonal"
          prepend-icon="mdi-auto-fix"
          :loading="aiStore.isStreaming"
          @click="handleOptimize"
        >
          Optimize Route
        </v-btn>
      </div>

      <AiMessage v-for="msg in aiStore.messages" :key="msg.id" :message="msg" />

      <v-progress-linear
        v-if="aiStore.isStreaming"
        indeterminate
        color="primary"
        rounded
        class="mt-2"
      />
    </div>

    <AiSuggestionCard
      v-if="aiStore.pendingSuggestion"
      :suggestion="aiStore.pendingSuggestion"
      @apply="handleApply"
      @dismiss="aiStore.setPendingSuggestion(null)"
    />

    <v-divider />
    <div class="pa-2 d-flex align-center" style="gap: 8px;">
      <v-text-field
        v-model="inputText"
        placeholder="Ask about your route…"
        variant="outlined"
        density="compact"
        hide-details
        :disabled="aiStore.isStreaming"
        @keyup.enter="handleSend"
      />
      <v-btn
        icon="mdi-send"
        color="primary"
        size="default"
        :loading="aiStore.isStreaming"
        :disabled="!inputText.trim()"
        @click="handleSend"
      />
    </div>
  </v-card>
</template>

<style scoped>
.ai-panel {
  position: fixed;
  top: 64px;
  right: 16px;
  width: 380px;
  height: calc(100vh - 80px);
  display: flex;
  flex-direction: column;
  z-index: 1000;
}
.messages-area {
  overflow-y: auto;
  flex: 1;
}
</style>
