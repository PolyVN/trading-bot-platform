"use client"

import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { usePnL } from "@/hooks/use-pnl"
import { useBots } from "@/hooks/use-bots"
import { botStatusColors } from "@/lib/status-colors"
import { useRealtimePnL } from "@/hooks/use-socket"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { formatUsd, formatPercent } from "@/lib/formatters"

export default function StatsPage() {
  const [period, setPeriod] = useState<"1h" | "4h" | "1d" | "1w">("1d")

  const { data: pnlData, isLoading: pnlLoading } = usePnL({
    entityType: "total",
    period,
    limit: 60,
  })

  const { data: botData, isLoading: botsLoading } = useBots({ limit: 100 })

  useRealtimePnL()

  const summary = pnlData?.summary
  const snapshots = pnlData?.data ?? []

  const cumulativeChart = snapshots.map((s) => ({
    date: new Date(s.timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    pnl: s.totalPnlUsd ?? 0,
  }))

  const dailyChart = snapshots.map((s) => ({
    date: new Date(s.timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    realized: s.realizedPnlUsd ?? 0,
    unrealized: s.unrealizedPnlUsd ?? 0,
  }))

  // Bot leaderboard: sort bots by name (since we don't have per-bot PnL in list)
  const bots = (botData?.data ?? []).filter((b) => b.status === "RUNNING" || b.status === "PAUSED")

  return (
    <>
      <PageHeader title="Stats" />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        {/* Controls */}
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">1 Hour</SelectItem>
              <SelectItem value="4h">4 Hours</SelectItem>
              <SelectItem value="1d">1 Day</SelectItem>
              <SelectItem value="1w">1 Week</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* KPI Summary */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
            </CardHeader>
            <CardContent>
              {pnlLoading ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                <div className="text-2xl font-bold">
                  {formatPercent(summary?.winRate)}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Sharpe Ratio</CardTitle>
            </CardHeader>
            <CardContent>
              {pnlLoading ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                <div className="text-2xl font-bold">
                  {summary?.sharpeRatio?.toFixed(2) ?? "0.00"}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Max Drawdown</CardTitle>
            </CardHeader>
            <CardContent>
              {pnlLoading ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                <div className="text-2xl font-bold text-red-400">
                  {formatPercent(summary?.maxDrawdown)}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Trades</CardTitle>
            </CardHeader>
            <CardContent>
              {pnlLoading ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                <div className="text-2xl font-bold">
                  {summary?.tradeCount ?? 0}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Cumulative PnL</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              {pnlLoading ? (
                <Skeleton className="h-full w-full" />
              ) : cumulativeChart.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={cumulativeChart}>
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
                  No data available
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Daily PnL Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              {pnlLoading ? (
                <Skeleton className="h-full w-full" />
              ) : dailyChart.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyChart}>
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
                    />
                    <Bar
                      dataKey="realized"
                      fill="hsl(var(--chart-1))"
                      name="Realized"
                      radius={[2, 2, 0, 0]}
                    />
                    <Bar
                      dataKey="unrealized"
                      fill="hsl(var(--chart-2))"
                      name="Unrealized"
                      radius={[2, 2, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                  No data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Bot Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle>Active Bots</CardTitle>
          </CardHeader>
          <CardContent>
            {botsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : bots.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bot</TableHead>
                    <TableHead>Exchange</TableHead>
                    <TableHead>Strategy</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Mode</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bots.map((bot) => (
                    <TableRow key={bot.botId}>
                      <TableCell className="font-medium">{bot.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {bot.exchange}
                        </Badge>
                      </TableCell>
                      <TableCell>{bot.strategyName}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={botStatusColors[bot.status] ?? ""}
                        >
                          {bot.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            bot.mode === "paper" ? "secondary" : "default"
                          }
                        >
                          {bot.mode}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground py-8 text-center text-sm">
                No active bots
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
