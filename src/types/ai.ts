export type MessageRole = 'user' | 'assistant' | 'system'

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  timestamp: number
}

export interface AiSuggestion {
  type: 'reorder' | 'add_stop' | 'avoid_area' | 'time_suggestion' | 'general'
  summary: string
  proposedOrder?: string[]   // waypoint IDs in new order
  additionalInfo?: string
}
