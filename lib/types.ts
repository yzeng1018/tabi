// lib/types.ts

export interface TripRequirements {
  origin: string          // 出发城市名，如 "上海"
  destination: string     // 目的地城市名，如 "大阪"
  departDate: string      // ISO 8601，如 "2026-04-25"
  returnDate: string      // ISO 8601，如 "2026-04-30"
  adults: number
  budget?: number         // CNY，可选
  preferences?: string    // 自由文本，可选
}

export interface RecommendationCard {
  flight: {
    from: string
    to: string
    departDate: string
    returnDate: string
    cabin: string         // 显示用中文，如 "经济舱"
    adults?: number       // AI outputs this in recommendation JSON; used for deep link generation
  }
  hotel: {
    city: string
    checkin: string
    checkout: string
    stars: number
  }
  summary: string
  links: {
    flight: string        // 携程机票深链
    hotel: string         // 携程酒店深链
  }
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// Partial requirements as they are collected during conversation
export type PartialRequirements = Partial<TripRequirements>

// Check whether all 5 required fields are present
export function requirementsComplete(r: PartialRequirements): r is TripRequirements {
  return !!(r.origin && r.destination && r.departDate && r.returnDate && r.adults)
}
