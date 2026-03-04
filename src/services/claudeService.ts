import type { ChatMessage } from '@/types/ai'

export async function sendMessageToClaude(
  messages: ChatMessage[],
  systemPrompt: string,
  onChunk: (text: string) => void,
): Promise<void> {
  const response = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: (import.meta.env.VITE_CLAUDE_MODEL ?? 'claude-haiku-4-5-20251001').trim(),
      max_tokens: 1024,
      stream: true,
      system: systemPrompt,
      messages: messages
        .filter((m) => m.role !== 'system' && m.content.trim() !== '')
        .map((m) => ({ role: m.role, content: m.content })),
    }),
  })

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status} ${response.statusText}`)
  }

  if (!response.body) {
    throw new Error('Response body is empty')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const lines = decoder.decode(value, { stream: true }).split('\n')
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') return

      try {
        const event = JSON.parse(data)
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          onChunk(event.delta.text)
        }
      } catch {
        // ignore non-JSON lines (e.g. empty ping events)
      }
    }
  }
}
