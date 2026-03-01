import { defineStore } from 'pinia'
import { ref } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import type { ChatMessage, AiSuggestion } from '@/types/ai'

export const useAiStore = defineStore('ai', () => {
  const messages = ref<ChatMessage[]>([])
  const isStreaming = ref(false)
  const pendingSuggestion = ref<AiSuggestion | null>(null)
  const isChatOpen = ref(false)

  function addMessage(role: ChatMessage['role'], content: string): ChatMessage {
    const message: ChatMessage = {
      id: uuidv4(),
      role,
      content,
      timestamp: Date.now(),
    }
    messages.value.push(message)
    return message
  }

  function appendToLastMessage(chunk: string) {
    const last = messages.value.at(-1)
    if (last && last.role === 'assistant') {
      last.content += chunk
    }
  }

  function setPendingSuggestion(suggestion: AiSuggestion | null) {
    pendingSuggestion.value = suggestion
  }

  function toggleChat() {
    isChatOpen.value = !isChatOpen.value
  }

  function clearHistory() {
    messages.value = []
    pendingSuggestion.value = null
  }

  return {
    messages,
    isStreaming,
    pendingSuggestion,
    isChatOpen,
    addMessage,
    appendToLastMessage,
    setPendingSuggestion,
    toggleChat,
    clearHistory,
  }
})
