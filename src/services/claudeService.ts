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
      model: (import.meta.env.VITE_CLAUDE_MODEL ?? 'claude-sonnet-5').trim(),
      max_tokens: 1024,
      // Sonnet 5 runs adaptive thinking by default, which eats the token budget
      // and can truncate the trailing JSON suggestion block. Disable it for this
      // short, structured-output call.
      thinking: { type: 'disabled' },
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
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    // Keep the last element — it may be an incomplete line split across reads.
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
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
