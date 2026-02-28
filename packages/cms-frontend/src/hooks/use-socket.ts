"use client"

import { useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { useQueryClient } from "@tanstack/react-query"
import { io, Socket } from "socket.io-client"
import type {
  BotStatusEvent,
  OrderUpdateEvent,
  TradeNewEvent,
  RiskAlertEvent,
} from "@shared/index"

const SOCKET_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"

let globalSocket: Socket | null = null
let globalSocketToken: string | null = null

export function useSocket() {
  const { data: session } = useSession()
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (!session?.accessToken) return

    // If socket exists with the same token, reuse it
    if (globalSocket?.connected && globalSocketToken === session.accessToken) {
      socketRef.current = globalSocket
      return
    }

    // Token changed or no socket — disconnect old and create new
    if (globalSocket) {
      globalSocket.disconnect()
      globalSocket = null
      globalSocketToken = null
    }

    const socket = io(SOCKET_URL, {
      auth: { token: session.accessToken },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    })

    globalSocket = socket
    globalSocketToken = session.accessToken
    socketRef.current = socket

    return () => {
      // Don't disconnect on unmount — shared singleton
    }
  }, [session?.accessToken])

  return socketRef.current
}

export function useBotStatus(botId?: string) {
  const socket = useSocket()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!socket || !botId) return

    socket.emit("subscribe:bot", botId)

    const anyHandler = (eventName: string, data: BotStatusEvent) => {
      if (eventName.startsWith("te:bot:status:") && data.botId === botId) {
        queryClient.setQueryData(["bots", botId], (old: unknown) => {
          if (!old || typeof old !== "object") return old
          return { ...old, status: data.status }
        })
        queryClient.invalidateQueries({ queryKey: ["bots"] })
      }
    }

    socket.onAny(anyHandler)

    return () => {
      socket.emit("unsubscribe:bot", botId)
      socket.offAny(anyHandler)
    }
  }, [socket, botId, queryClient])
}

export function useRealtimeOrders() {
  const socket = useSocket()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!socket) return

    const handler = (_eventName: string, data: OrderUpdateEvent) => {
      if (_eventName.startsWith("te:order:update:")) {
        queryClient.invalidateQueries({ queryKey: ["orders"] })
        queryClient.invalidateQueries({ queryKey: ["orders", data.orderId] })
      }
    }

    socket.onAny(handler)
    return () => {
      socket.offAny(handler)
    }
  }, [socket, queryClient])
}

export function useRealtimeTrades() {
  const socket = useSocket()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!socket) return

    const handler = (_eventName: string, _data: TradeNewEvent) => {
      if (_eventName.startsWith("te:trade:new:")) {
        queryClient.invalidateQueries({ queryKey: ["trades"] })
        queryClient.invalidateQueries({ queryKey: ["pnl"] })
      }
    }

    socket.onAny(handler)
    return () => {
      socket.offAny(handler)
    }
  }, [socket, queryClient])
}

export function useRealtimePnL() {
  const socket = useSocket()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!socket) return

    const handler = (_eventName: string) => {
      if (
        _eventName.startsWith("te:trade:new:") ||
        _eventName.startsWith("te:position:update:")
      ) {
        queryClient.invalidateQueries({ queryKey: ["pnl"] })
      }
    }

    socket.onAny(handler)
    return () => {
      socket.offAny(handler)
    }
  }, [socket, queryClient])
}

export function useRiskAlerts(onAlert: (alert: RiskAlertEvent) => void) {
  const socket = useSocket()
  const callbackRef = useRef(onAlert)
  callbackRef.current = onAlert

  useEffect(() => {
    if (!socket) return

    const handler = (_eventName: string, data: RiskAlertEvent) => {
      if (_eventName.startsWith("te:risk:alert:")) {
        callbackRef.current(data)
      }
    }

    socket.onAny(handler)
    return () => {
      socket.offAny(handler)
    }
  }, [socket])
}

export function useSubscribeBot(botId?: string) {
  const socket = useSocket()

  useEffect(() => {
    if (!socket || !botId) return
    socket.emit("subscribe:bot", botId)
    return () => {
      socket.emit("unsubscribe:bot", botId)
    }
  }, [socket, botId])
}
