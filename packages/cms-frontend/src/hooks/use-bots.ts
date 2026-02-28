"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  Bot,
  BotListResponse,
  CreateBotRequest,
  UpdateBotRequest,
} from "@shared/index"
import { api } from "@/lib/api-client"
import { useExchange } from "@/lib/exchange-context"

interface BotListParams {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: "asc" | "desc"
  status?: string
  strategyName?: string
  mode?: string
}

export function useBots(params: BotListParams = {}) {
  const { exchange } = useExchange()
  return useQuery({
    queryKey: ["bots", exchange, params],
    queryFn: () =>
      api.get<BotListResponse>("/api/bots", {
        ...params,
        exchange: exchange === "all" ? undefined : exchange,
      }),
  })
}

export function useBot(botId: string) {
  return useQuery({
    queryKey: ["bots", botId],
    queryFn: () => api.get<Bot>(`/api/bots/${botId}`),
    enabled: !!botId,
  })
}

export function useCreateBot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateBotRequest) =>
      api.post<Bot>("/api/bots", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bots"] })
    },
  })
}

export function useUpdateBot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ botId, data }: { botId: string; data: UpdateBotRequest }) =>
      api.patch<Bot>(`/api/bots/${botId}`, data),
    onSuccess: (_data, { botId }) => {
      queryClient.invalidateQueries({ queryKey: ["bots"] })
      queryClient.invalidateQueries({ queryKey: ["bots", botId] })
    },
  })
}

export function useDeleteBot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (botId: string) =>
      api.delete(`/api/bots/${botId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bots"] })
    },
  })
}

export function useBotAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      botId,
      action,
    }: {
      botId: string
      action: "start" | "stop" | "pause" | "resume"
    }) => api.post(`/api/bots/${botId}/${action}`),
    onSuccess: (_data, { botId }) => {
      queryClient.invalidateQueries({ queryKey: ["bots"] })
      queryClient.invalidateQueries({ queryKey: ["bots", botId] })
    },
  })
}
