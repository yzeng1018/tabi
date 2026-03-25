// lib/ai.ts

import { jsonrepair } from 'jsonrepair'
import { ChatMessage, PartialRequirements } from './types'

const DASHSCOPE_API_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
const MODEL = 'qwen-plus'

// ── System prompt ─────────────────────────────────────────────────

export function buildSystemPrompt(requirements: PartialRequirements): string {
  const known = Object.entries(requirements)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')

  return `你是 tabi，一个中文旅行订票助手。你的任务是帮用户订机票和酒店。

风格要求：
- 主动、简洁，每次只问一个问题
- 不废话，不重复已知信息
- 全程中文

需要收集的信息（必填）：
1. 出发地（origin）
2. 目的地（destination）
3. 出发日期（departDate，格式 YYYY-MM-DD）
4. 返回日期（returnDate，格式 YYYY-MM-DD）
5. 人数（adults，数字）

可选信息：预算（budget，人民币）、偏好（preferences，自由文本）

已知信息：
${known || '（暂无）'}

规则：
- 如果必填信息还没收集完，继续追问，每次只问一个问题
- 如果用户提到修改已有信息（比如"改去东京"），更新该字段，然后继续
- 一旦5个必填字段全部收集完毕，立即输出推荐 JSON，格式如下（不要输出任何其他文字）：
{
  "flight": {
    "from": "出发城市",
    "to": "目的地城市",
    "departDate": "YYYY-MM-DD",
    "returnDate": "YYYY-MM-DD",
    "cabin": "经济舱",
    "adults": 2
  },
  "hotel": {
    "city": "目的地城市",
    "checkin": "YYYY-MM-DD",
    "checkout": "YYYY-MM-DD",
    "stars": 4
  },
  "summary": "一句话推荐理由"
}
`
}

// ── JSON detection ────────────────────────────────────────────────

export function extractRecommendationJSON(text: string): object | null {
  const idx = text.search(/\{\s*"/)
  if (idx === -1) return null
  const candidate = text.slice(idx)
  try {
    return JSON.parse(candidate)
  } catch {
    try {
      return JSON.parse(jsonrepair(candidate))
    } catch {
      return null
    }
  }
}

// ── Qwen streaming call ───────────────────────────────────────────

export async function streamChat(
  messages: ChatMessage[],
  systemPrompt: string,
  signal?: AbortSignal
): Promise<ReadableStream<string>> {
  const apiKey = process.env.DASHSCOPE_API_KEY?.trim()
  if (!apiKey) throw new Error('DASHSCOPE_API_KEY not set')

  const res = await fetch(DASHSCOPE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    }),
    signal,
  })

  if (!res.ok || !res.body) {
    throw new Error(`DashScope API error: ${res.status}`)
  }

  // Transform SSE stream into a stream of content delta strings
  const reader = res.body.getReader()
  const decoder = new TextDecoder()

  return new ReadableStream<string>({
    async pull(controller) {
      const { done, value } = await reader.read()
      if (done) {
        controller.close()
        return
      }
      const chunk = decoder.decode(value, { stream: true })
      for (const line of chunk.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const data = trimmed.slice(5).trim()
        if (data === '[DONE]') {
          controller.close()
          reader.cancel()
          return
        }
        try {
          const parsed = JSON.parse(data)
          const delta = parsed.choices?.[0]?.delta?.content
          if (delta) controller.enqueue(delta)
        } catch {
          // Skip malformed SSE lines
        }
      }
    },
    cancel() {
      reader.cancel()
    },
  })
}
