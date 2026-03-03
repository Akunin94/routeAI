import { useWaypointStore } from '@/stores/waypointStore'
import { useRouteStore } from '@/stores/routeStore'
import { useAiStore } from '@/stores/aiStore'
import { sendMessageToClaude } from '@/services/claudeService'
import type { AiSuggestion } from '@/types/ai'

// ---------------------------------------------------------------------------
// System prompt template — context injected at call time via {CONTEXT}
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT_TEMPLATE = `You are a route optimization expert. Help users plan efficient, time-saving routes.

## Behaviour rules
- Keep every response under 150 words
- Respond in the same language the user writes in
- Never invent waypoint IDs, addresses, or locations — only use what is listed in the route context
- If no reordering improves the route, say so plainly and omit the JSON block

## Structured output
When you have an actionable suggestion, append exactly ONE JSON block at the very end of your response.

Reorder stops:
\`\`\`json
{"type":"reorder","proposedOrder":["id1","id2","id3"],"summary":"One-sentence reason"}
\`\`\`
Rules for reorder:
  - proposedOrder MUST contain ALL waypoint IDs (no omissions)
  - Use the exact IDs from the route context — do not shorten or modify them

General observation (no action):
\`\`\`json
{"type":"general","summary":"One-sentence takeaway"}
\`\`\`

Omit the JSON block entirely for purely conversational replies.

## Current route context
{CONTEXT}`

// ---------------------------------------------------------------------------
// Context builder — injected fresh into system prompt on every API call
// ---------------------------------------------------------------------------
function buildContext(
  waypointStore: ReturnType<typeof useWaypointStore>,
  routeStore: ReturnType<typeof useRouteStore>,
): string {
  const wps = waypointStore.waypoints

  if (wps.length === 0) {
    return 'No waypoints added yet.'
  }

  const waypointLines = wps
    .map((wp, i) => `  ${i + 1}. [${wp.id}] ${wp.label}: "${wp.address}"`)
    .join('\n')

  let ctx = `Waypoints (${wps.length} total, in current order):\n${waypointLines}`

  if (routeStore.activeRoute) {
    const r = routeStore.activeRoute
    ctx += `\n\nCalculated route:\n  Total distance: ${r.totalDistance.text}\n  Total duration: ${r.totalDuration.text}`

    if (r.legs.length > 1) {
      ctx += '\n  Legs:'
      r.legs.forEach((leg, i) => {
        ctx += `\n    ${i + 1}. ${leg.startAddress} → ${leg.endAddress} (${leg.distance.text}, ${leg.duration.text})`
      })
    }
  } else {
    ctx += '\n\nRoute: not yet calculated.'
  }

  return ctx
}

function buildSystemPrompt(
  waypointStore: ReturnType<typeof useWaypointStore>,
  routeStore: ReturnType<typeof useRouteStore>,
): string {
  return SYSTEM_PROMPT_TEMPLATE.replace('{CONTEXT}', buildContext(waypointStore, routeStore))
}

// ---------------------------------------------------------------------------
// Suggestion parser — matches the last ```json ... ``` block in the response
// ---------------------------------------------------------------------------
function parseSuggestion(text: string): AiSuggestion | null {
  // Match the last JSON code block (Claude appends it at the end)
  const matches = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/g)]
  if (matches.length === 0) return null

  const lastMatch = matches[matches.length - 1]

  try {
    const parsed = JSON.parse(lastMatch[1])
    if (typeof parsed.type === 'string' && typeof parsed.summary === 'string') {
      return parsed as AiSuggestion
    }
  } catch {
    // malformed JSON — ignore
  }

  return null
}

// Export helpers for testing
export { parseSuggestion, buildContext }

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------
export function useRouteOptimizer() {
  const waypointStore = useWaypointStore()
  const routeStore = useRouteStore()
  const aiStore = useAiStore()

  async function _callClaude() {
    aiStore.isStreaming = true
    aiStore.addMessage('assistant', '')

    // Rebuild system prompt with the latest route state on every call
    const systemPrompt = buildSystemPrompt(waypointStore, routeStore)
    let fullResponse = ''

    try {
      await sendMessageToClaude(aiStore.messages, systemPrompt, (chunk) => {
        fullResponse += chunk
        aiStore.appendToLastMessage(chunk)
      })
      aiStore.setPendingSuggestion(parseSuggestion(fullResponse))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to reach AI service'
      aiStore.appendToLastMessage(`\n\n_${msg}_`)
    } finally {
      aiStore.isStreaming = false
    }
  }

  /** Triggered by the "Optimize Route" button */
  async function optimizeRoute() {
    if (!waypointStore.hasEnoughWaypoints) return
    aiStore.addMessage(
      'user',
      'Please analyze my route and suggest the most efficient order for the stops.',
    )
    await _callClaude()
  }

  /** Triggered by free-text input in the chat panel */
  async function sendUserMessage(text: string) {
    if (!text.trim() || aiStore.isStreaming) return
    // Context is always in the system prompt — user messages stay clean
    aiStore.addMessage('user', text.trim())
    await _callClaude()
  }

  return { optimizeRoute, sendUserMessage }
}
