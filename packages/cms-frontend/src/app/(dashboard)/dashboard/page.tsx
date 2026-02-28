"use client"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PageHeader } from "@/components/page-header"
import { useBots } from "@/hooks/use-bots"
import { useDashboardPnL } from "@/hooks/use-pnl"
import { useRecentTrades } from "@/hooks/use-trades"
import { useRealtimeTrades } from "@/hooks/use-socket"
import {
  DollarSign,
  TrendingUp,
  Bot as BotIcon,
  TrendingDown,
} from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { botStatusColors } from "@/lib/status-colors"
import { formatUsd, formatPercent } from "@/lib/formatters"

export default function DashboardPage() {
  const { data: botData, isLoading: botsLoading } = useBots({ limit: 100 })
  const { data: pnlData, isLoading: pnlLoading } = useDashboardPnL()
  const { data: tradesData, isLoading: tradesLoading } = useRecentTrades(10)

  useRealtimeTrades()

  const bots = botData?.data ?? []
  const runningBots = bots.filter((b) => b.status === "RUNNING").length

  const summary = pnlData?.summary
  const totalPnl = summary?.totalPnlUsd ?? 0
  const dailyPnl =
    pnlData?.data && pnlData.data.length > 0
      ? pnlData.data[pnlData.data.length - 1]?.totalPnlUsd ?? 0
      : 0
  const maxDrawdown = summary?.maxDrawdown ?? 0

  const chartData = (pnlData?.data ?? []).map((snapshot) => ({
    date: new Date(snapshot.timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    pnl: snapshot.totalPnlUsd ?? 0,
  }))

  const statusCounts: Record<string, number> = {}
  for (const bot of bots) {
    statusCounts[bot.status] = (statusCounts[bot.status] ?? 0) + 1
  }

  const trades = tradesData?.data ?? []

  return (
    <>
      <PageHeader title="Dashboard" />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total PnL</CardTitle>
              <DollarSign className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              {pnlLoading ? (
                <Skeleton className="h-7 w-24" />
              ) : (
                <div
                  className={`text-2xl font-bold ${totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}
                >
                  {formatUsd(totalPnl)}
                </div>
              )}
              <p className="text-muted-foreground text-xs">All exchanges</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Daily PnL</CardTitle>
              <TrendingUp className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              {pnlLoading ? (
                <Skeleton className="h-7 w-24" />
              ) : (
                <div
                  className={`text-2xl font-bold ${dailyPnl >= 0 ? "text-green-400" : "text-red-400"}`}
                >
                  {formatUsd(dailyPnl)}
                </div>
              )}
              <p className="text-muted-foreground text-xs">Today</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Bots</CardTitle>
              <BotIcon className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              {botsLoading ? (
                <Skeleton className="h-7 w-12" />
              ) : (
                <div className="text-2xl font-bold">{runningBots}</div>
              )}
              <p className="text-muted-foreground text-xs">
                {bots.length} total
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Max Drawdown
              </CardTitle>
              <TrendingDown className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              {pnlLoading ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                <div className="text-2xl font-bold text-red-400">
                  {formatPercent(maxDrawdown)}
                </div>
              )}
              <p className="text-muted-foreground text-xs">Peak to trough</p>
            </CardContent>
          </Card>
        </div>

        {/* PnL Chart + Bot Status */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>PnL (30 days)</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              {pnlLoading ? (
                <Skeleton className="h-full w-full" />
              ) : chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
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
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                      formatter={(value) => [formatUsd(value as number), "PnL"]}
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

          <Card>
            <CardHeader>
              <CardTitle>Bot Status</CardTitle>
            </CardHeader>
            <CardContent>
              {botsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : Object.keys(statusCounts).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(statusCounts).map(([status, count]) => (
                    <div
                      key={status}
                      className="flex items-center justify-between"
                    >
                      <Badge
                        variant="outline"
                        className={botStatusColors[status] ?? ""}
                      >
                        {status}
                      </Badge>
                      <span className="text-sm font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No bots yet</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Trades */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Trades</CardTitle>
          </CardHeader>
          <CardContent>
            {tradesLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : trades.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Exchange</TableHead>
                    <TableHead>Instrument</TableHead>
                    <TableHead>Side</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Size</TableHead>
                    <TableHead className="text-right">PnL</TableHead>
                    <TableHead className="text-right">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trades.map((trade) => (
                    <TableRow key={trade.tradeId}>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {trade.exchange}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {trade.instId}
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            trade.side === "BUY"
                              ? "text-green-400"
                              : "text-red-400"
                          }
                        >
                          {trade.side}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatUsd(trade.price)}
                      </TableCell>
                      <TableCell className="text-right">
                        {trade.size}
                      </TableCell>
                      <TableCell
                        className={`text-right ${
                          (trade.realizedPnlUsd ?? 0) >= 0
                            ? "text-green-400"
                            : "text-red-400"
                        }`}
                      >
                        {formatUsd(trade.realizedPnlUsd)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-right text-xs">
                        {new Date(trade.timestamp).toLocaleTimeString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-sm">
                No trades recorded yet
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
