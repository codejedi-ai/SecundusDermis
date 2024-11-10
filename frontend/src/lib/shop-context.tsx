import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

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

export function ShopProvider({ children }: { children: ReactNode }) {
  const [gender, setGender]         = useState('')
  const [category, setCategory]     = useState('')
  const [query, setQuery]           = useState('')
  const [inputValue, setInputValue] = useState('')
  const [total, setTotal]           = useState(0)
  const [sidebarWidth, setSidebarWidth] = useState(220)
  return (
    <Ctx.Provider value={{
      gender, setGender,
      category, setCategory,
      query, setQuery,
      inputValue, setInputValue,
      total, setTotal,
      sidebarWidth, setSidebarWidth,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export function useShop() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useShop must be used within ShopProvider')
  return ctx
}
