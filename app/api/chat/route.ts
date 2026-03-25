// app/api/chat/route.ts

import { NextRequest } from 'next/server'
import { buildSystemPrompt, streamChat, extractRecommendationJSON } from '@/lib/ai'
import { buildBookingLinks } from '@/lib/booking'
import { ChatMessage, PartialRequirements, RecommendationCard } from '@/lib/types'

// Use Node.js runtime — this route accumulates the full AI response before
// responding, so edge runtime provides no benefit and may add restrictions.
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const { messages, requirements }: {
    messages: ChatMessage[]
    requirements: PartialRequirements
  } = await req.json()

  const systemPrompt = buildSystemPrompt(requirements)

  let stream: ReadableStream<string>
  try {
    stream = await streamChat(messages, systemPrompt, req.signal)
  } catch {
    return new Response(
      JSON.stringify({ error: '网络开小差了，请重试' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Accumulate the full AI response to check for recommendation JSON
  const reader = stream.getReader()
  let fullText = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    fullText += value
  }

  // Check if AI output is a recommendation JSON
  const recommendation = extractRecommendationJSON(fullText)
  if (recommendation && isValidRecommendation(recommendation)) {
    const rec = recommendation as Omit<RecommendationCard, 'links'>
    // Extract adults from the AI's recommendation JSON (most reliable source,
    // since requirements.adults may be undefined if the client hasn't parsed it)
    const adultsFromRec = (rec.flight as Record<string, unknown>).adults
    const links = buildBookingLinks(
      {
        origin: rec.flight.from,
        destination: rec.flight.to,
        departDate: rec.flight.departDate,
        returnDate: rec.flight.returnDate,
        adults: typeof adultsFromRec === 'number' ? adultsFromRec : (requirements.adults ?? 1),
        budget: requirements.budget,
        preferences: requirements.preferences,
      },
      rec.flight.cabin
    )
    const card: RecommendationCard = { ...rec, links }
    return new Response(JSON.stringify({ type: 'recommendation', card }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Otherwise return plain text response
  return new Response(JSON.stringify({ type: 'message', content: fullText }), {
    headers: { 'Content-Type': 'application/json' },
  })
}

function isValidRecommendation(obj: object): boolean {
  const r = obj as Record<string, unknown>
  return (
    r.flight !== null && typeof r.flight === 'object' &&
    r.hotel !== null && typeof r.hotel === 'object' &&
    typeof r.summary === 'string'
  )
}
