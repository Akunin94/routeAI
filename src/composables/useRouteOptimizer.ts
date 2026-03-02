import { useWaypointStore } from '@/stores/waypointStore'
import { useRouteStore } from '@/stores/routeStore'
import { useAiStore } from '@/stores/aiStore'
import { sendMessageToClaude } from '@/services/claudeService'
import type { AiSuggestion } from '@/types/ai'

const SYSTEM_PROMPT = `You are a route optimization expert. Help users plan efficient routes.
Keep responses concise (under 150 words). When you suggest reordering waypoints, append a JSON block at the END of your response in this exact format:
\`\`\`json
{"type":"reorder","proposedOrder":["id1","id2"],"summary":"Brief reason"}
\`\`\`
Only use the waypoint IDs provided to you. Do not invent addresses or locations.
If no reordering is needed, omit the JSON block.`

function buildContext(
  waypointStore: ReturnType<typeof useWaypointStore>,
  routeStore: ReturnType<typeof useRouteStore>,
): string {
  const waypointsInfo = waypointStore.waypoints
    .map((wp) => `  - ID: ${wp.id} | ${wp.label}: ${wp.address}`)
    .join('\n')

  let context = `Current waypoints:\n${waypointsInfo}`

  if (routeStore.activeRoute) {
    const r = routeStore.activeRoute
    context += `\n\nCurrent route stats:\n  Total distance: ${r.totalDistance.text}\n  Total duration: ${r.totalDuration.text}`
  }

  return context
}

function parseSuggestion(text: string): AiSuggestion | null {
  const match = text.match(/```json\s*([\s\S]*?)\s*```/)
  if (!match) return null

  try {
    const parsed = JSON.parse(match[1])
    if (parsed.type && parsed.summary) {
      return parsed as AiSuggestion
    }
  } catch {
    // not valid JSON
  }

  return null
}

export function useRouteOptimizer() {
  const waypointStore = useWaypointStore()
  const routeStore = useRouteStore()
  const aiStore = useAiStore()

  async function _callClaude() {
    aiStore.isStreaming = true
    aiStore.addMessage('assistant', '')

    let fullResponse = ''

    try {
      await sendMessageToClaude(aiStore.messages, SYSTEM_PROMPT, (chunk) => {
        fullResponse += chunk
        aiStore.appendToLastMessage(chunk)
      })

      const suggestion = parseSuggestion(fullResponse)
      aiStore.setPendingSuggestion(suggestion)
    } finally {
      aiStore.isStreaming = false
    }
  }

  async function optimizeRoute() {
    if (!waypointStore.hasEnoughWaypoints) return

    const context = buildContext(waypointStore, routeStore)
    const prompt = `Please analyze my route and suggest optimizations if possible.\n\n${context}`

    aiStore.addMessage('user', prompt)
    await _callClaude()
  }

  async function sendUserMessage(text: string) {
    if (!text.trim() || aiStore.isStreaming) return

    const context = buildContext(waypointStore, routeStore)
    const userContent =
      aiStore.messages.length === 0 ? `${text}\n\nContext:\n${context}` : text

    aiStore.addMessage('user', userContent)
    await _callClaude()
  }

  return { optimizeRoute, sendUserMessage }
}
