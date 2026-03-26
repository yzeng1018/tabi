import { describe, it, expect } from 'vitest'
import { buildBookingLinks, isInternationalRoute } from '@/lib/booking'
import type { TripRequirements } from '@/lib/types'

// ── Fixtures ──────────────────────────────────────────────────────

const DOMESTIC: TripRequirements = {
  origin: '上海',
  destination: '北京',
  departDate: '2026-05-01',
  returnDate: '2026-05-05',
  adults: 2,
}

const INTERNATIONAL: TripRequirements = {
  origin: '上海',
  destination: '东京',
  departDate: '2026-05-01',
  returnDate: '2026-05-10',
  adults: 1,
}

const SINGLE_ADULT: TripRequirements = {
  origin: '广州',
  destination: '首尔',
  departDate: '2026-06-15',
  returnDate: '2026-06-20',
  adults: 1,
}

// ── isInternationalRoute ──────────────────────────────────────────

describe('isInternationalRoute', () => {
  it('returns false for known domestic city', () => {
    expect(isInternationalRoute('北京')).toBe(false)
    expect(isInternationalRoute('三亚')).toBe(false)
    expect(isInternationalRoute('上海')).toBe(false)
  })

  it('returns true for international destinations', () => {
    expect(isInternationalRoute('东京')).toBe(true)
    expect(isInternationalRoute('首尔')).toBe(true)
    expect(isInternationalRoute('曼谷')).toBe(true)
  })

  it('handles null and undefined', () => {
    expect(isInternationalRoute(null)).toBe(false)
    expect(isInternationalRoute(undefined)).toBe(false)
  })

  it('trims whitespace before checking', () => {
    expect(isInternationalRoute(' 上海 ')).toBe(false)
    expect(isInternationalRoute(' 东京 ')).toBe(true)
  })
})

// ── buildBookingLinks — structure ────────────────────────────────

describe('buildBookingLinks — structure', () => {
  it('always returns all 3 platforms', () => {
    const links = buildBookingLinks(DOMESTIC, '经济舱')
    expect(links).toHaveProperty('ctrip')
    expect(links).toHaveProperty('fliggy')
    expect(links).toHaveProperty('tongcheng')
  })

  it('ctrip and fliggy always have both flight and hotel links', () => {
    const links = buildBookingLinks(DOMESTIC, '经济舱')
    for (const platform of ['ctrip', 'fliggy'] as const) {
      expect(links[platform].flight.length).toBeGreaterThan(0)
      expect(links[platform].hotel.length).toBeGreaterThan(0)
    }
  })

  it('tongcheng.flight is defined when both cities are in IATA map', () => {
    const links = buildBookingLinks(DOMESTIC, '经济舱') // 上海→北京, both mapped
    expect(links.tongcheng.flight).toBeDefined()
    expect(links.tongcheng.hotel.length).toBeGreaterThan(0)
  })
})

// ── Ctrip URLs ────────────────────────────────────────────────────

describe('buildBookingLinks — Ctrip', () => {
  it('domestic flight: uses m.ctrip.com webapp URL', () => {
    const { ctrip } = buildBookingLinks(DOMESTIC, '经济舱')
    expect(ctrip.flight).toContain('m.ctrip.com/webapp/flights/domestic')
    expect(ctrip.flight).toContain('fromCity=%E4%B8%8A%E6%B5%B7') // 上海 encoded
    expect(ctrip.flight).toContain('toCity=%E5%8C%97%E4%BA%AC')   // 北京 encoded
    expect(ctrip.flight).toContain('adult=2')
  })

  it('international flight: uses flights.ctrip.com URL', () => {
    const { ctrip } = buildBookingLinks(INTERNATIONAL, '经济舱')
    expect(ctrip.flight).toContain('flights.ctrip.com/international/search/oneway')
    expect(ctrip.flight).toContain('adult=1')
    expect(ctrip.flight).toContain('cabin=y')
  })

  it('business class uses cabin=c', () => {
    const { ctrip } = buildBookingLinks(INTERNATIONAL, '商务舱')
    expect(ctrip.flight).toContain('cabin=c')
  })

  it('hotel URL includes city, checkin, checkout, adult', () => {
    const { ctrip } = buildBookingLinks(DOMESTIC, '经济舱')
    expect(ctrip.hotel).toContain('m.ctrip.com/webapp/hotel/list')
    expect(ctrip.hotel).toContain('checkin=2026-05-01')
    expect(ctrip.hotel).toContain('checkout=2026-05-05')
    expect(ctrip.hotel).toContain('adult=2')
  })
})

// ── Fliggy URLs ───────────────────────────────────────────────────

describe('buildBookingLinks — Fliggy', () => {
  it('domestic flight with mapped cities: uses sjipiao.fliggy.com with city codes', () => {
    const { fliggy } = buildBookingLinks(DOMESTIC, '经济舱') // 上海→北京
    expect(fliggy.flight).toContain('sjipiao.fliggy.com/flight_search_result.htm')
    expect(fliggy.flight).toContain('depCity=SHA')
    expect(fliggy.flight).toContain('arrCity=BJS') // Fliggy uses BJS (city code) not PEK
    expect(fliggy.flight).toContain('adult=2')
  })

  it('domestic flight date is ISO (YYYY-MM-DD), not compact', () => {
    const { fliggy } = buildBookingLinks(DOMESTIC, '经济舱')
    expect(fliggy.flight).toContain('depDate=2026-05-01')
    expect(fliggy.flight).not.toContain('20260501')
  })

  it('international flight: falls back to ijipiao landing page', () => {
    const { fliggy } = buildBookingLinks(INTERNATIONAL, '经济舱')
    expect(fliggy.flight).toContain('fliggy.com/ijipiao')
  })

  it('domestic flight for unmapped city: falls back to jipiao landing page', () => {
    const noAirport: TripRequirements = {
      origin: '上海', destination: '苏州',
      departDate: '2026-05-01', returnDate: '2026-05-03', adults: 1,
    }
    const { fliggy } = buildBookingLinks(noAirport, '经济舱')
    expect(fliggy.flight).toContain('fliggy.com/jipiao')
  })

  it('hotel URL is fliggy.com/jiudian/ landing page', () => {
    const { fliggy } = buildBookingLinks(DOMESTIC, '经济舱')
    expect(fliggy.hotel).toBe('https://www.fliggy.com/jiudian/')
  })
})

// ── Tongcheng (ly.com) URLs ───────────────────────────────────────

describe('buildBookingLinks — Tongcheng', () => {
  it('domestic flight with mapped cities: returns ly.com URL with IATA codes', () => {
    const { tongcheng } = buildBookingLinks(DOMESTIC, '经济舱') // 上海→北京
    expect(tongcheng.flight).toBeDefined()
    expect(tongcheng.flight).toContain('ly.com/flights/itinerary/oneway/sha-pek')
  })

  it('flight URL uses ISO date (YYYY-MM-DD) as query param', () => {
    const { tongcheng } = buildBookingLinks(DOMESTIC, '经济舱')
    expect(tongcheng.flight).toContain('date=2026-05-01')
    // not compact YYYYMMDD
    expect(tongcheng.flight).not.toContain('20260501')
  })

  it('flight URL includes from/to display names', () => {
    const { tongcheng } = buildBookingLinks(DOMESTIC, '经济舱')
    expect(tongcheng.flight).toContain('from=')
    expect(tongcheng.flight).toContain('to=')
  })

  it('international route: flight is undefined (同程 is domestic-focused)', () => {
    const { tongcheng } = buildBookingLinks(INTERNATIONAL, '经济舱') // 上海→东京
    expect(tongcheng.flight).toBeUndefined()
  })

  it('unmapped domestic city (no airport): flight is undefined', () => {
    const noAirport: TripRequirements = {
      origin: '上海', destination: '苏州', // 苏州 has no commercial airport
      departDate: '2026-05-01', returnDate: '2026-05-03', adults: 1,
    }
    const { tongcheng } = buildBookingLinks(noAirport, '经济舱')
    expect(tongcheng.flight).toBeUndefined()
  })

  it('tourist destination with airport: returns valid URL', () => {
    const { tongcheng } = buildBookingLinks({
      origin: '上海', destination: '桂林',
      departDate: '2026-05-01', returnDate: '2026-05-05', adults: 2,
    }, '经济舱')
    expect(tongcheng.flight).toContain('sha-kwl')
  })

  it('hotel URL uses ly.com hotellist with numeric city code', () => {
    const { tongcheng } = buildBookingLinks(DOMESTIC, '经济舱') // 上海→北京, 北京=53
    expect(tongcheng.hotel).toContain('ly.com/hotel/hotellist')
    expect(tongcheng.hotel).toContain('city=53')
    expect(tongcheng.hotel).toContain('checkIn=2026-05-01')
    expect(tongcheng.hotel).toContain('checkOut=2026-05-05')
  })

  it('hotel URL for unmapped city falls back to landing page', () => {
    const { tongcheng } = buildBookingLinks({
      origin: '上海', destination: '色达',
      departDate: '2026-05-01', returnDate: '2026-05-05', adults: 1,
    }, '经济舱')
    expect(tongcheng.hotel).toBe('https://www.ly.com/hotel/')
  })
})

// ── Adults passthrough ────────────────────────────────────────────

describe('adults passthrough', () => {
  it('ctrip, fliggy flight, tongcheng hotel reflect correct adult count', () => {
    const req = { ...DOMESTIC, adults: 3 }
    const links = buildBookingLinks(req, '经济舱')
    expect(links.ctrip.flight).toContain('adult=3')
    expect(links.fliggy.flight).toContain('adult=3')
    expect(links.ctrip.hotel).toContain('adult=3')
    expect(links.tongcheng.hotel).toContain('adult=3')
  })

  // Note: 同程 flight doesn't carry adult= (ly.com doesn't accept passenger count in URL)
  // Note: fliggy hotel is a static landing page — no adult count in URL
})
