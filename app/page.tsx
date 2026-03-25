// app/page.tsx
'use client'

import { useState } from 'react'
import ChatWindow from '@/components/ChatWindow'
import RecommendCard from '@/components/RecommendCard'
import { ChatMessage, PartialRequirements, RecommendationCard } from '@/lib/types'

const INITIAL_MESSAGE: ChatMessage = {
  role: 'assistant',
  content: '你好，我是 tabi！你想去哪里旅行？',
}

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE])
  const [requirements, setRequirements] = useState<PartialRequirements>({})
  const [mode, setMode] = useState<'collecting' | 'recommending'>('collecting')
  const [card, setCard] = useState<RecommendationCard | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSend(text: string) {
    // If in recommending mode, treat new message as a revision request
    if (mode === 'recommending') {
      setMode('collecting')
      setCard(null)
    }

    const userMsg: ChatMessage = { role: 'user', content: text }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages, requirements }),
      })

      if (!res.ok) throw new Error('API error')

      const data = await res.json()

      if (data.type === 'recommendation') {
        // Update requirements from the recommendation
        const rec = data.card as RecommendationCard
        setRequirements(prev => ({
          ...prev,
          origin: rec.flight.from,
          destination: rec.flight.to,
          departDate: rec.flight.departDate,
          returnDate: rec.flight.returnDate,
        }))
        setCard(rec)
        setMode('recommending')
        // Add summary as assistant message
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: rec.summary },
        ])
      } else {
        // Plain text reply
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: data.content },
        ])
      }
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: '网络开小差了，请重试 🙏' },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleRevise() {
    setMode('collecting')
    setCard(null)
    setMessages(prev => [
      ...prev,
      { role: 'assistant', content: '好的，告诉我你想调整什么？' },
    ])
  }

  return (
    <main className="flex flex-col h-dvh max-w-lg mx-auto bg-white">
      {/* Header */}
      <header className="flex items-center px-4 py-3 border-b border-gray-100">
        <h1 className="text-lg font-bold text-blue-500">tabi</h1>
        <span className="ml-2 text-sm text-gray-400">说说你想去哪</span>
      </header>

      {/* Content area — renders ChatWindow XOR RecommendCard, never both.
          overflow-hidden lets each child manage its own scroll. */}
      <div className="flex-1 overflow-hidden">
        {mode === 'collecting' ? (
          <ChatWindow
            messages={messages}
            loading={loading}
            onSend={handleSend}
          />
        ) : (
          card && (
            <div className="h-full overflow-y-auto">
              <RecommendCard card={card} onRevise={handleRevise} />
            </div>
          )
        )}
      </div>
    </main>
  )
}
