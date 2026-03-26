// lib/booking.ts

import { TripRequirements } from './types'

// ── Domestic city set ─────────────────────────────────────────────
// Determines routing: domestic → domestic URLs, else → international URLs
// Source: ported from trip-agent/lib/booking.ts
// Note: Ctrip accepts Chinese city names directly; Fliggy and Tongcheng require IATA codes.
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
// AI outputs Chinese display name; this maps to common OTA cabin codes
const CABIN_CODE: Record<string, string> = {
  '经济舱': 'y',
  '商务舱': 'c',
  '头等舱': 'f',
}

function toCabinCode(cabin: string): string {
  return CABIN_CODE[cabin.trim()] ?? 'y' // default to economy
}

// ── Ctrip URL builders ────────────────────────────────────────────

function buildCtripFlightUrl(req: TripRequirements, cabin: string): string {
  const { origin, destination, departDate, adults } = req
  const cabinCode = toCabinCode(cabin)

  if (isInternationalRoute(destination)) {
    const params = new URLSearchParams({
      adult: String(adults),
      cabin: cabinCode,
      dcity: origin,
      acity: destination,
      date: departDate.replace(/-/g, ''),
    })
    return `https://flights.ctrip.com/international/search/oneway?${params}`
  } else {
    const params = new URLSearchParams({
      adult: String(adults),
      fromCity: origin,
      toCity: destination,
      departDate,
    })
    return `https://m.ctrip.com/webapp/flights/domestic/?${params}`
  }
}

function buildCtripHotelUrl(req: TripRequirements): string {
  const { destination, departDate: checkin, returnDate: checkout, adults } = req
  const params = new URLSearchParams({
    city: destination,
    checkin,
    checkout,
    adult: String(adults),
  })
  return `https://m.ctrip.com/webapp/hotel/list/?${params}`
}

// ── Fliggy URL builders ───────────────────────────────────────────
// Flight: sjipiao.fliggy.com requires uppercase city codes.
//   Most cities use the same IATA airport code as CITY_TO_IATA, but Fliggy uses the
//   metropolitan city code for multi-airport cities:
//     北京 → BJS (covers PEK + PKX), confirmed from fliggy.com/jipiao/line-sha-bjs
//   Falls back to the flight landing page when city is not in IATA map.
// Hotel: Fliggy's hotel pages are SPA-only and don't deep link reliably without login.
//   Link to the jiudian landing page — users can search from there.

// Overrides for cities where Fliggy uses a city code instead of airport IATA
const FLIGGY_CODE_OVERRIDES: Record<string, string> = {
  '北京': 'bjs',  // BJS covers both Capital (PEK) and Daxing (PKX)
}

function buildFliggyFlightUrl(req: TripRequirements): string {
  const { origin, destination, departDate, adults } = req

  if (isInternationalRoute(destination)) {
    // International: no IATA map for foreign cities → fallback landing page
    return 'https://www.fliggy.com/ijipiao/'
  }

  const rawOrigin = FLIGGY_CODE_OVERRIDES[origin.trim()] ?? CITY_TO_IATA[origin.trim()]
  const rawDest   = FLIGGY_CODE_OVERRIDES[destination.trim()] ?? CITY_TO_IATA[destination.trim()]
  if (!rawOrigin || !rawDest) {
    // Domestic city without airport (苏州, 东莞 etc.) → fallback landing page
    return 'https://www.fliggy.com/jipiao/'
  }

  const params = new URLSearchParams({
    depCity: rawOrigin.toUpperCase(), // sjipiao.fliggy.com uses uppercase: SHA, BJS, CTU…
    arrCity: rawDest.toUpperCase(),
    depDate: departDate,              // YYYY-MM-DD (ISO)
    adult:   String(adults),
  })
  return `https://sjipiao.fliggy.com/flight_search_result.htm?${params}`
}

function buildFliggyHotelUrl(): string {
  // Fliggy hotel is SPA-only; no unauthenticated deep link exists.
  // /jiudian/ is the indexed hotel landing page — works without login.
  return 'https://www.fliggy.com/jiudian/'
}

// ── Tongcheng (ly.com) IATA mapping ──────────────────────────────
// ly.com requires IATA airport codes in the URL path.
// Real URL format (from live indexed pages):
//   https://www.ly.com/flights/itinerary/oneway/sha-pek?date=2026-05-01&from=上海&to=北京
// Cities not in this map → tongcheng.flight = undefined → button hidden.
// Note: cities without commercial airports (苏州, 东莞, 阳朔 etc.) are intentionally omitted.
const CITY_TO_IATA: Record<string, string> = {
  // Tier-1 cities
  '上海': 'sha',   // Hongqiao; ly.com uses 'sha' as the Shanghai city code
  '北京': 'pek',   // Capital
  '广州': 'can',   // Baiyun
  '深圳': 'szx',   // Bao'an
  '成都': 'ctu',   // Shuangliu
  '重庆': 'ckg',   // Jiangbei
  // Major cities
  '杭州': 'hgh',
  '南京': 'nkg',
  '武汉': 'wuh',
  '西安': 'xiy',   // Xianyang
  '天津': 'tsn',
  '长沙': 'csx',
  '青岛': 'tao',
  '郑州': 'cgo',
  '昆明': 'kmg',
  '大连': 'dlc',
  '厦门': 'xmn',
  '宁波': 'ngb',
  '福州': 'foc',
  '济南': 'tna',
  '哈尔滨': 'hrb',
  '沈阳': 'she',
  '长春': 'cgq',
  '南宁': 'nng',
  '海口': 'hak',
  '三亚': 'syx',
  '贵阳': 'kwe',
  '兰州': 'lhw',
  '西宁': 'xnn',
  '乌鲁木齐': 'urc',
  '拉萨': 'lxa',
  '呼和浩特': 'het',
  '银川': 'inc',
  '太原': 'tyn',
  '石家庄': 'sjw',
  '合肥': 'hfe',
  '南昌': 'khn',
  '温州': 'wnz',
  '扬州': 'yty',   // Yangzhou Taizhou
  '烟台': 'ynt',
  '无锡': 'wux',
  '常州': 'czx',
  '徐州': 'xuz',
  '珠海': 'zuh',
  // Tourist destinations with airports
  '丽江': 'ljg',
  '桂林': 'kwl',
  '黄山': 'txn',   // Tunxi
  '张家界': 'dyg',
  '九寨沟': 'jzh',
  '敦煌': 'dnh',
  '喀什': 'khg',
  '西双版纳': 'jhg', // Jinghong
  '稻城': 'dcy',   // Daocheng Yading
  '香格里拉': 'dig',
}

// ── Tongcheng (ly.com) hotel city codes ──────────────────────────
// ly.com hotel search uses numeric internal city IDs, not city names.
// Source: extracted from https://www.ly.com/hotel/hotellist?city=53 footer links.
// Cities not in this map fall back to the hotel landing page.
const TONGCHENG_CITY_CODE: Record<string, number> = {
  '北京': 53,   '上海': 321,  '广州': 80,   '深圳': 91,
  '南京': 224,  '杭州': 383,  '成都': 324,  '厦门': 61,
  '青岛': 292,  '三亚': 133,  '苏州': 226,  '西安': 317,
  '长沙': 199,  '贵阳': 114,  '桂林': 102,  '佛山': 79,
  '天津': 343,  '宁波': 388,  '武汉': 192,  '合肥': 42,
  '郑州': 163,  '南昌': 239,  '重庆': 394,
}

// ── Tongcheng URL builders (ly.com) ──────────────────────────────
// Flight URL requires IATA codes; returns undefined for unmapped cities (button hidden).
// Hotel URL uses numeric city code from TONGCHENG_CITY_CODE;
//   falls back to hotel landing page for unmapped cities.

function buildTongchengFlightUrl(req: TripRequirements): string | undefined {
  const { origin, destination, departDate } = req
  // International routes: 同程 is domestic-focused; skip for non-Chinese destinations
  if (isInternationalRoute(destination)) return undefined
  const originCode = CITY_TO_IATA[origin.trim()]
  const destCode   = CITY_TO_IATA[destination.trim()]
  if (!originCode || !destCode) return undefined
  const params = new URLSearchParams({
    date: departDate,
    from: origin,
    to: destination,
  })
  return `https://www.ly.com/flights/itinerary/oneway/${originCode}-${destCode}?${params}`
}

function buildTongchengHotelUrl(req: TripRequirements): string {
  const { destination, departDate: checkin, returnDate: checkout, adults } = req
  const cityCode = TONGCHENG_CITY_CODE[destination.trim()]
  if (!cityCode) {
    // City not in our code map — link to hotel landing page
    return 'https://www.ly.com/hotel/'
  }
  const params = new URLSearchParams({
    city:      String(cityCode),
    checkIn:   checkin,
    checkOut:  checkout,
    adult:     String(adults),
  })
  return `https://www.ly.com/hotel/hotellist?${params}`
}

// ── Main export ───────────────────────────────────────────────────

export function buildBookingLinks(
  req: TripRequirements,
  cabin: string
): {
  ctrip:     { flight: string; hotel: string }
  fliggy:    { flight: string; hotel: string }
  tongcheng: { flight: string | undefined; hotel: string }
} {
  return {
    ctrip: {
      flight: buildCtripFlightUrl(req, cabin),
      hotel:  buildCtripHotelUrl(req),
    },
    fliggy: {
      flight: buildFliggyFlightUrl(req),
      hotel:  buildFliggyHotelUrl(),
    },
    tongcheng: {
      flight: buildTongchengFlightUrl(req),
      hotel:  buildTongchengHotelUrl(req),
    },
  }
}
