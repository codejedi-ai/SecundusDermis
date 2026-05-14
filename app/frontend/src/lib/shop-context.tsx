import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from './auth-context'
import * as fashionApi from '../services/fashionApi'

const LS_KEY = 'sd_shop_selection_v2'
const DEBOUNCE_MS = 450

interface ShopCtx {
  gender: string
  setGender: (g: string) => void
  category: string
  setCategory: (c: string) => void
  query: string
  setQuery: (q: string) => void
  inputValue: string
  setInputValue: (v: string) => void
  total: number
  setTotal: (n: number) => void
  sidebarWidth: number
  setSidebarWidth: (w: number) => void
}

const Ctx = createContext<ShopCtx | null>(null)

function readLocalShopSnapshot(): Partial<{
  gender: string
  category: string
  query: string
  inputValue: string
  sidebarWidth: number
}> {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return {}
    const o = JSON.parse(raw) as Record<string, unknown>
    const out: Partial<{
      gender: string
      category: string
      query: string
      inputValue: string
      sidebarWidth: number
    }> = {}
    if (typeof o.gender === 'string') out.gender = o.gender
    if (typeof o.category === 'string') out.category = o.category
    if (typeof o.query === 'string') out.query = o.query
    if (typeof o.inputValue === 'string') out.inputValue = o.inputValue
    if (typeof o.sidebarWidth === 'number' && Number.isFinite(o.sidebarWidth)) out.sidebarWidth = o.sidebarWidth
    return out
  } catch {
    return {}
  }
}

function writeLocalShopSnapshot(data: {
  gender: string
  category: string
  query: string
  inputValue: string
  sidebarWidth: number
}) {
  try {
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({ ...data, updatedAt: Date.now() }),
    )
  } catch {
    /* quota / private mode */
  }
}

export function ShopProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const [gender, setGender] = useState('')
  const [category, setCategory] = useState('')
  const [query, setQuery] = useState('')
  const [inputValue, setInputValue] = useState('')
  const [total, setTotal] = useState(0)
  const [sidebarWidth, setSidebarWidth] = useState(220)

  const didHydrateLocalRef = useRef(false)

  // One-time: restore from localStorage so selections survive refresh and non-shop routes.
  useEffect(() => {
    if (didHydrateLocalRef.current) return
    didHydrateLocalRef.current = true
    const s = readLocalShopSnapshot()
    if (s.gender !== undefined) setGender(s.gender)
    if (s.category !== undefined) setCategory(s.category)
    if (s.query !== undefined) setQuery(s.query)
    if (s.inputValue !== undefined) setInputValue(s.inputValue)
    if (s.sidebarWidth !== undefined) setSidebarWidth(s.sidebarWidth)
  }, [])

  // Logged-in: merge server copy when it has real data (cross-device / return visit).
  useEffect(() => {
    const sid = session?.session_id
    if (!sid) return
    let cancelled = false
    fashionApi.getPatronShopSelection(sid).then((remote) => {
      if (cancelled || !remote) return
      const hasTextual =
        (remote.gender && String(remote.gender).trim()) ||
        (remote.category && String(remote.category).trim()) ||
        (remote.query && String(remote.query).trim()) ||
        (remote.input_value && String(remote.input_value).trim())
      const hasWidth = typeof remote.sidebar_width === 'number'
      if (!hasTextual && !hasWidth) return
      if (remote.gender !== undefined) setGender(remote.gender ?? '')
      if (remote.category !== undefined) setCategory(remote.category ?? '')
      if (remote.query !== undefined) setQuery(remote.query ?? '')
      if (remote.input_value !== undefined) setInputValue(remote.input_value ?? '')
      if (typeof remote.sidebar_width === 'number') setSidebarWidth(remote.sidebar_width)
    })
    return () => {
      cancelled = true
    }
  }, [session?.session_id])

  // Debounced: persist to localStorage (always) + backend when authenticated.
  useEffect(() => {
    const t = window.setTimeout(() => {
      writeLocalShopSnapshot({ gender, category, query, inputValue, sidebarWidth })
      const sid = session?.session_id
      if (sid) {
        fashionApi.putPatronShopSelection(sid, {
          gender,
          category,
          query,
          input_value: inputValue,
          sidebar_width: sidebarWidth,
        })
      }
    }, DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [gender, category, query, inputValue, sidebarWidth, session?.session_id])

  return (
    <Ctx.Provider
      value={{
        gender,
        setGender,
        category,
        setCategory,
        query,
        setQuery,
        inputValue,
        setInputValue,
        total,
        setTotal,
        sidebarWidth,
        setSidebarWidth,
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

export function useShop() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useShop must be used within ShopProvider')
  return ctx
}
