// components/RecommendCard.tsx
'use client'

import { RecommendationCard } from '@/lib/types'

interface Props {
  card: RecommendationCard
  onRevise: () => void
}

// Shared class strings for the two button styles
const BTN_PRIMARY = 'flex-1 rounded-xl bg-blue-500 text-white text-center py-2.5 text-sm font-medium transition-transform active:bg-blue-600 active:scale-95'
const BTN_GHOST   = 'flex-1 rounded-xl border border-blue-500 text-blue-500 text-center py-2.5 text-sm font-medium transition-transform active:scale-95 active:opacity-80'

export default function RecommendCard({ card, onRevise }: Props) {
  const { flight, hotel, summary, links } = card

  return (
    <div className="animate-slide-in mx-4 mt-4 space-y-3">
      {/* Summary */}
      <p className="text-sm text-gray-500 px-1">{summary}</p>

      {/* Flight card */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">机票</span>
          <span className="text-xs text-gray-400">{flight.cabin}</span>
        </div>
        <div className="flex items-center gap-2 text-lg font-semibold text-gray-800">
          <span>{flight.from}</span>
          <span className="text-gray-300">→</span>
          <span>{flight.to}</span>
        </div>
        <div className="mt-1 text-sm text-gray-500">
          {flight.departDate} 出发 · {flight.returnDate} 返回
        </div>
        {/* Booking platform row — 同程 hidden when destination has no IATA mapping */}
        <div className="mt-3 flex gap-2">
          <a href={links.ctrip.flight}  target="_blank" rel="noopener noreferrer" className={BTN_PRIMARY}>携程</a>
          <a href={links.fliggy.flight} target="_blank" rel="noopener noreferrer" className={BTN_GHOST}>飞猪</a>
          {links.tongcheng.flight && (
            <a href={links.tongcheng.flight} target="_blank" rel="noopener noreferrer" className={BTN_GHOST}>同程</a>
          )}
        </div>
      </div>

      {/* Hotel card */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">酒店</span>
          <span className="text-xs text-gray-400">{'★'.repeat(Math.min(5, Math.max(1, hotel.stars)))}</span>
        </div>
        <div className="text-lg font-semibold text-gray-800">{hotel.city}</div>
        <div className="mt-1 text-sm text-gray-500">
          {hotel.checkin} 入住 · {hotel.checkout} 退房
        </div>
        {/* 3-platform booking row */}
        <div className="mt-3 flex gap-2">
          <a href={links.ctrip.hotel}     target="_blank" rel="noopener noreferrer" className={BTN_PRIMARY}>携程</a>
          <a href={links.fliggy.hotel}    target="_blank" rel="noopener noreferrer" className={BTN_GHOST}>飞猪</a>
          <a href={links.tongcheng.hotel} target="_blank" rel="noopener noreferrer" className={BTN_GHOST}>同程</a>
        </div>
      </div>

      {/* Revision prompt */}
      <button
        onClick={onRevise}
        className="w-full text-center text-sm text-gray-400 py-2 active:text-gray-600"
      >
        不满意？告诉我调整哪里
      </button>
    </div>
  )
}
