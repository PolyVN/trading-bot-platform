"use client"

import { useState, useEffect, useCallback } from "react"
import { useSocket, useRiskAlerts } from "@/hooks/use-socket"
import { toast } from "sonner"
import type { Notification } from "@shared/index"

interface LocalNotification {
  id: string
  type: Notification["type"]
  severity: Notification["severity"]
  title: string
  message: string
  exchange?: string
  botId?: string
  isRead: boolean
  createdAt: string
}

let notifCounter = 0

export function useNotifications() {
  const [notifications, setNotifications] = useState<LocalNotification[]>([])
  const socket = useSocket()

  const addNotification = useCallback(
    (notif: Omit<LocalNotification, "id" | "isRead" | "createdAt">) => {
      const newNotif: LocalNotification = {
        ...notif,
        id: `local-${++notifCounter}`,
        isRead: false,
        createdAt: new Date().toISOString(),
      }
      setNotifications((prev) => [newNotif, ...prev].slice(0, 100))

      if (notif.severity === "critical") {
        toast.error(notif.title, { description: notif.message })
      } else if (notif.severity === "warning") {
        toast.warning(notif.title, { description: notif.message })
      }
    },
    []
  )

  // Listen for risk alerts
  useRiskAlerts(
    useCallback(
      (alert) => {
        addNotification({
          type: "risk_stop",
          severity: alert.severity === "breach" ? "critical" : "warning",
          title: `Risk Alert: ${alert.riskType.replace(/_/g, " ")}`,
          message: `Bot ${alert.botId}: ${alert.riskType} limit ${alert.limit}, current ${alert.current}`,
          exchange: alert.exchange,
          botId: alert.botId,
        })
      },
      [addNotification]
    )
  )

  // Listen for bot errors
  useEffect(() => {
    if (!socket) return

    // Only handle ERROR here — RISK_STOPPED is handled by useRiskAlerts
    // to avoid duplicate notifications for the same incident
    const handler = (eventName: string, data: { botId?: string; status?: string; reason?: string; exchange?: string }) => {
      if (
        eventName.startsWith("te:bot:status:") &&
        data.status === "ERROR"
      ) {
        addNotification({
          type: "bot_error",
          severity: "critical",
          title: "Bot Error",
          message: `Bot ${data.botId}: ${data.reason ?? data.status}`,
          exchange: data.exchange,
          botId: data.botId,
        })
      }
    }

    socket.onAny(handler)
    return () => {
      socket.offAny(handler)
    }
  }, [socket, addNotification])

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    )
  }, [])

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
  }, [])

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const unreadCount = notifications.filter((n) => !n.isRead).length

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllRead,
    removeNotification,
  }
}
