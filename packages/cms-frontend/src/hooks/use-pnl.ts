"use client"

import { useQuery } from "@tanstack/react-query"
import type { PnLResponse } from "@shared/index"
import { api } from "@/lib/api-client"
import { useExchange } from "@/lib/exchange-context"

interface PnLParams {
  entityType: "bot" | "strategy" | "wallet" | "exchange" | "total"
  entityId?: string
  period?: "1h" | "4h" | "1d" | "1w"
  from?: string
  to?: string
  isPaper?: boolean
  page?: number
  limit?: number
}

export function usePnL(params: PnLParams) {
  const { exchange } = useExchange()
  return useQuery({
    queryKey: ["pnl", exchange, params],
    queryFn: () =>
      api.get<PnLResponse>("/api/pnl", {
        ...params,
        exchange: exchange === "all" ? undefined : exchange,
      }),
  })
}

export function useDashboardPnL() {
  const { exchange } = useExchange()
  return useQuery({
    queryKey: ["pnl", "dashboard", exchange],
    queryFn: () =>
      api.get<PnLResponse>("/api/pnl", {
        entityType: "total",
        period: "1d",
        limit: 30,
        exchange: exchange === "all" ? undefined : exchange,
      }),
  })
}
