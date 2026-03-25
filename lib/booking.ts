// lib/booking.ts

import { TripRequirements } from './types'

// ── Domestic city set ─────────────────────────────────────────────
// Determines routing: domestic → Ctrip domestic URLs, else → Ctrip international URLs
// Source: ported from trip-agent/lib/booking.ts
// NOTE: CITY_TO_IATA mapping is intentionally NOT included in this MVP.
// Ctrip international URLs accept city names directly — IATA codes only needed for mid-term API integration.
const DOMESTIC_CITIES = new Set([
  // Tier-1 + major cities
  '北京', '上海', '广州', '深圳', '成都', '重庆', '杭州', '南京', '武汉', '西安',
  '苏州', '天津', '长沙', '青岛', '郑州', '昆明', '大连', '厦门', '宁波', '福州',
  '济南', '哈尔滨', '沈阳', '长春', '南宁', '海口', '三亚', '贵阳', '兰州', '西宁',
  '乌鲁木齐', '拉萨', '呼和浩特', '银川', '太原', '石家庄', '合肥', '南昌', '温州',
  '扬州', '烟台', '无锡', '常州', '徐州', '珠海', '佛山', '东莞',
  // Tourist destinations
  '丽江', '桂林', '黄山', '张家界', '九寨沟', '峨眉山', '敦煌', '喀什',
  '西双版纳', '稻城', '香格里拉', '凤凰', '阳朔', '泸沽湖', '色达',
])

export function isInternationalRoute(destination?: string | null): boolean {
  if (!destination) return false
  return !DOMESTIC_CITIES.has(destination.trim())
}

// ── Cabin code mapping ────────────────────────────────────────────
// AI outputs Chinese display name; this maps to IATA cabin code for URL params
const CABIN_CODE: Record<string, string> = {
  '经济舱': 'y',
  '商务舱': 'c',
  '头等舱': 'f',
}

function toCabinCode(cabin: string): string {
  return CABIN_CODE[cabin.trim()] ?? 'y' // default to economy
}

// ── Flight URL builder ────────────────────────────────────────────

function buildFlightUrl(req: TripRequirements, cabin: string): string {
  const { origin, destination, departDate, adults } = req
  const cabinCode = toCabinCode(cabin)

  if (isInternationalRoute(destination)) {
    // Ctrip international flight (oneway outbound; user books return separately on OTA)
    const params = new URLSearchParams({
      adult: String(adults),
      cabin: cabinCode,
      dcity: origin,
      acity: destination,
      date: departDate.replace(/-/g, ''),
    })
    return `https://flights.ctrip.com/international/search/oneway?${params}`
  } else {
    // Ctrip domestic flight
    const params = new URLSearchParams({
      adult: String(adults),
      fromCity: origin,
      toCity: destination,
      departDate,
    })
    return `https://m.ctrip.com/webapp/flights/domestic/?${params}`
  }
}

// ── Hotel URL builder ─────────────────────────────────────────────

function buildHotelUrl(req: TripRequirements): string {
  const { destination, departDate: checkin, returnDate: checkout, adults } = req
  // Ctrip for both domestic and international hotels (per tabi spec)
  const params = new URLSearchParams({
    city: destination,
    checkin,
    checkout,
    adult: String(adults),
  })
  return `https://m.ctrip.com/webapp/hotel/list/?${params}`
}

// ── Main export ───────────────────────────────────────────────────

export function buildBookingLinks(
  req: TripRequirements,
  cabin: string
): { flight: string; hotel: string } {
  return {
    flight: buildFlightUrl(req, cabin),
    hotel: buildHotelUrl(req),
  }
}
