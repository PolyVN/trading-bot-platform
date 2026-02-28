"use client"

import { use } from "react"
import { useRouter } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useBot, useBotAction } from "@/hooks/use-bots"
import { useOrders } from "@/hooks/use-orders"
import { usePnL } from "@/hooks/use-pnl"
import { useBotStatus, useSubscribeBot } from "@/hooks/use-socket"
import {
  Play,
  Square,
  Pause,
  RotateCcw,
  ArrowLeft,
} from "lucide-react"
import { toast } from "sonner"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { botStatusColors, orderStatusColors } from "@/lib/status-colors"
import { formatUsd } from "@/lib/formatters"

export default function BotDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const { data: bot, isLoading } = useBot(id)
  const botAction = useBotAction()

  useSubscribeBot(id)
  useBotStatus(id)

  const { data: ordersData } = useOrders({ botId: id, limit: 20 })
  const { data: pnlData } = usePnL({
    entityType: "bot",
    entityId: id,
    period: "1d",
  })

  const handleAction = (action: "start" | "stop" | "pause" | "resume") => {
    botAction.mutate(
      { botId: id, action },
      {
        onSuccess: () => toast.success(`Bot ${action} command sent`),
        onError: (err) => toast.error(`Failed: ${err.message}`),
      }
    )
  }

  if (isLoading) {
    return (
      <>
        <PageHeader title="Bot Details" />
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </>
    )
  }

  if (!bot) {
    return (
      <>
        <PageHeader title="Bot Details" />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
          <p className="text-muted-foreground">Bot not found</p>
          <Button variant="outline" onClick={() => router.push("/bots")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Bots
          </Button>
        </div>
      </>
    )
  }

  const canStart = ["IDLE", "STOPPED", "ERROR", "RISK_STOPPED"].includes(bot.status)
  const canStop = ["RUNNING", "PAUSED"].includes(bot.status)
  const canPause = bot.status === "RUNNING"
  const canResume = bot.status === "PAUSED"

  const orders = ordersData?.data ?? []
  const chartData = (pnlData?.data ?? []).map((s) => ({
    date: new Date(s.timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    pnl: s.totalPnlUsd ?? 0,
  }))

  return (
    <>
      <PageHeader title={bot.name} />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/bots")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h2 className="text-xl font-bold">{bot.name}</h2>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="capitalize">
                  {bot.exchange}
                </Badge>
                <Badge
                  variant="outline"
                  className={botStatusColors[bot.status] ?? ""}
                >
                  {bot.status}
                </Badge>
                <Badge
                  variant={bot.mode === "paper" ? "secondary" : "default"}
                >
                  {bot.mode}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {canStart && (
              <Button size="sm" onClick={() => handleAction("start")}>
                <Play className="mr-1 h-4 w-4" />
                Start
              </Button>
            )}
            {canPause && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAction("pause")}
              >
                <Pause className="mr-1 h-4 w-4" />
                Pause
              </Button>
            )}
            {canResume && (
              <Button size="sm" onClick={() => handleAction("resume")}>
                <RotateCcw className="mr-1 h-4 w-4" />
                Resume
              </Button>
            )}
            {canStop && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleAction("stop")}
              >
                <Square className="mr-1 h-4 w-4" />
                Stop
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="pnl">PnL</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Strategy</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-medium">{bot.strategyName}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Instruments</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1">
                    {bot.instIds.map((id) => (
                      <Badge key={id} variant="outline" className="font-mono text-xs">
                        {id}
                      </Badge>
                    ))}
                    {bot.instIds.length === 0 && (
                      <span className="text-muted-foreground text-sm">None</span>
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Engine</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-mono text-sm">{bot.assignedEngineId}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Tick Interval</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-medium">{bot.tickInterval}ms</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Wallet</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-mono text-sm">{bot.walletId}</p>
                </CardContent>
              </Card>
              {bot.lastError && (
                <Card className="border-red-500/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-red-400">
                      Last Error
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-red-400">
                      {bot.lastError.message}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {new Date(bot.lastError.timestamp).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders">
            <Card>
              <CardContent className="pt-6">
                {orders.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Instrument</TableHead>
                        <TableHead>Side</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Size</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order) => (
                        <TableRow key={order.orderId}>
                          <TableCell className="font-medium">
                            {order.instId}
                          </TableCell>
                          <TableCell>
                            <span
                              className={
                                order.side === "BUY"
                                  ? "text-green-400"
                                  : "text-red-400"
                              }
                            >
                              {order.side}
                            </span>
                          </TableCell>
                          <TableCell>{order.type}</TableCell>
                          <TableCell className="text-right">
                            {order.size}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatUsd(order.price)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                orderStatusColors[order.status] ?? ""
                              }
                            >
                              {order.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {order.createdAt
                              ? new Date(order.createdAt).toLocaleString(
                                  undefined,
                                  {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )
                              : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground py-8 text-center text-sm">
                    No orders for this bot yet
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* PnL Tab */}
          <TabsContent value="pnl">
            <Card>
              <CardHeader>
                <CardTitle>Profit & Loss</CardTitle>
              </CardHeader>
              <CardContent className="h-[400px]">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                      />
                      <XAxis
                        dataKey="date"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickFormatter={(v) => `$${v}`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "6px",
                        }}
                        formatter={(value) => [
                          formatUsd(value as number),
                          "PnL",
                        ]}
                      />
                      <Line
                        type="monotone"
                        dataKey="pnl"
                        stroke="hsl(var(--chart-1))"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                    No PnL data available yet
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Risk Limits</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-muted-foreground text-sm">
                      Max Position Size
                    </p>
                    <p className="font-medium">
                      {formatUsd(bot.riskLimits.maxPositionSize)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">
                      Max Orders/Min
                    </p>
                    <p className="font-medium">
                      {bot.riskLimits.maxOrdersPerMinute}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">
                      Max Daily Loss
                    </p>
                    <p className="font-medium">
                      {formatUsd(bot.riskLimits.maxDailyLoss)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">
                      Max Drawdown
                    </p>
                    <p className="font-medium">
                      {bot.riskLimits.maxDrawdown}%
                    </p>
                  </div>
                  {bot.riskLimits.maxLeverage != null && (
                    <div>
                      <p className="text-muted-foreground text-sm">
                        Max Leverage
                      </p>
                      <p className="font-medium">
                        {bot.riskLimits.maxLeverage}x
                      </p>
                    </div>
                  )}
                  {bot.riskLimits.maxPositionNotional != null && (
                    <div>
                      <p className="text-muted-foreground text-sm">
                        Max Position Notional
                      </p>
                      <p className="font-medium">
                        {formatUsd(bot.riskLimits.maxPositionNotional)}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted overflow-auto rounded-lg p-4 text-sm">
                  {JSON.stringify(
                    {
                      strategyConfig: bot.strategyConfig,
                      exchangeConfig: bot.exchangeConfig,
                    },
                    null,
                    2
                  )}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
