import { describe, expect, it } from 'vitest'
import { isAtelierExperience, parseExperienceMode } from './experience-mode'

describe('parseExperienceMode', () => {
  it('defaults to boutique', () => {
    expect(parseExperienceMode(undefined)).toBe('boutique')
    expect(parseExperienceMode('')).toBe('boutique')
    expect(parseExperienceMode('ATELIER')).toBe('boutique')
  })

  it('accepts atelier', () => {
    expect(parseExperienceMode('atelier')).toBe('atelier')
  })
})

describe('isAtelierExperience', () => {
  it('is false without user or in boutique', () => {
    expect(isAtelierExperience(null)).toBe(false)
    expect(isAtelierExperience({ experience_mode: 'boutique' })).toBe(false)
  })

  it('is true for atelier', () => {
    expect(isAtelierExperience({ experience_mode: 'atelier' })).toBe(true)
  })
})
