"use client"

import { createContext, useCallback, useContext, useState } from "react"

// TODO: Import from @polyvn/shared-types once the package is consumable by the frontend
export type Exchange = "polymarket" | "okx"
export type ExchangeFilter = Exchange | "all"

interface ExchangeContextValue {
  exchange: ExchangeFilter
  setExchange: (exchange: ExchangeFilter) => void
}

const ExchangeContext = createContext<ExchangeContextValue | undefined>(
  undefined
)

const STORAGE_KEY = "cms-exchange-filter"
const VALID_VALUES: ExchangeFilter[] = ["all", "polymarket", "okx"]

function getStoredExchange(): ExchangeFilter {
  if (typeof window === "undefined") return "all"
  const stored = localStorage.getItem(STORAGE_KEY) as ExchangeFilter | null
  if (stored && VALID_VALUES.includes(stored)) return stored
  return "all"
}

export function ExchangeProvider({ children }: { children: React.ReactNode }) {
  const [exchange, setExchangeState] = useState<ExchangeFilter>(getStoredExchange)

  const setExchange = useCallback((value: ExchangeFilter) => {
    setExchangeState(value)
    localStorage.setItem(STORAGE_KEY, value)
  }, [])

  return (
    <ExchangeContext value={{ exchange, setExchange }}>
      {children}
    </ExchangeContext>
  )
}

export function useExchange() {
  const context = useContext(ExchangeContext)
  if (!context) {
    throw new Error("useExchange must be used within an ExchangeProvider")
  }
  return context
}
