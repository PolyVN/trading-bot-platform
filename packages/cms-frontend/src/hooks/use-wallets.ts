"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  Wallet,
  WalletListResponse,
  CreateWalletRequest,
} from "@shared/index"
import { api } from "@/lib/api-client"
import { useExchange } from "@/lib/exchange-context"

interface WalletListParams {
  page?: number
  limit?: number
  sort?: string
  order?: "asc" | "desc"
  isActive?: boolean
}

export function useWallets(params: WalletListParams = {}) {
  const { exchange } = useExchange()
  return useQuery({
    queryKey: ["wallets", exchange, params],
    queryFn: () =>
      api.get<WalletListResponse>("/api/wallets", {
        ...params,
        exchange: exchange === "all" ? undefined : exchange,
      }),
  })
}

export function useWallet(walletId: string) {
  return useQuery({
    queryKey: ["wallets", walletId],
    queryFn: () => api.get<Wallet>(`/api/wallets/${walletId}`),
    enabled: !!walletId,
  })
}

export function useCreateWallet() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateWalletRequest) =>
      api.post<Wallet>("/api/wallets", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallets"] })
    },
  })
}

export function useDeleteWallet() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (walletId: string) =>
      api.delete(`/api/wallets/${walletId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallets"] })
    },
  })
}
