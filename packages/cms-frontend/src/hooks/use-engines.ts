"use client"

import { useQuery } from "@tanstack/react-query"
import type { Engine, EngineListResponse } from "@shared/index"
import { api } from "@/lib/api-client"

export function useEngines() {
  return useQuery({
    queryKey: ["engines"],
    queryFn: () => api.get<EngineListResponse>("/api/engines"),
  })
}

export function useEngine(engineId: string) {
  return useQuery({
    queryKey: ["engines", engineId],
    queryFn: () => api.get<Engine>(`/api/engines/${engineId}`),
    enabled: !!engineId,
  })
}
