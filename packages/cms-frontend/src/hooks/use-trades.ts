"use client"

import { useQuery } from "@tanstack/react-query"
import type { Trade } from "@shared/index"
import { api } from "@/lib/api-client"
import { useExchange } from "@/lib/exchange-context"

interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

interface TradeListParams {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: "asc" | "desc"
  botId?: string
  instId?: string
  isPaper?: boolean
}

export function useTrades(params: TradeListParams = {}) {
  const { exchange } = useExchange()
  return useQuery({
    queryKey: ["trades", exchange, params],
    queryFn: () =>
      api.get<PaginatedResponse<Trade>>("/api/trades", {
        ...params,
        exchange: exchange === "all" ? undefined : exchange,
      }),
  })
}

export function useRecentTrades(limit = 10) {
  const { exchange } = useExchange()
  return useQuery({
    queryKey: ["trades", "recent", exchange, limit],
    queryFn: () =>
      api.get<PaginatedResponse<Trade>>("/api/trades", {
        limit,
        sortBy: "timestamp",
        sortOrder: "desc",
        exchange: exchange === "all" ? undefined : exchange,
      }),
  })
}
