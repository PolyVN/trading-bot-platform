"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  Order,
  OrderListResponse,
  ManualOrderRequest,
} from "@shared/index"
import { api } from "@/lib/api-client"
import { useExchange } from "@/lib/exchange-context"

interface OrderListParams {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: "asc" | "desc"
  botId?: string
  status?: string
  isPaper?: boolean
}

export function useOrders(params: OrderListParams = {}) {
  const { exchange } = useExchange()
  return useQuery({
    queryKey: ["orders", exchange, params],
    queryFn: () =>
      api.get<OrderListResponse>("/api/orders", {
        ...params,
        exchange: exchange === "all" ? undefined : exchange,
      }),
  })
}

export function useOrder(orderId: string) {
  return useQuery({
    queryKey: ["orders", orderId],
    queryFn: () => api.get<Order>(`/api/orders/${orderId}`),
    enabled: !!orderId,
  })
}

export function usePlaceManualOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: ManualOrderRequest) =>
      api.post<Order>("/api/orders/manual", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] })
    },
  })
}

export function useCancelOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (orderId: string) =>
      api.post(`/api/orders/${orderId}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] })
    },
  })
}
