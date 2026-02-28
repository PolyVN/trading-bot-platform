"use client"

import { useState } from "react"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useOrders, useCancelOrder, usePlaceManualOrder } from "@/hooks/use-orders"
import { useBots } from "@/hooks/use-bots"
import { useExchange } from "@/lib/exchange-context"
import { useRealtimeOrders } from "@/hooks/use-socket"
import { X, Plus } from "lucide-react"
import { toast } from "sonner"
import type { Order, Exchange } from "@shared/index"
import { orderStatusColors } from "@/lib/status-colors"
import { formatUsdPrecise as formatUsd } from "@/lib/formatters"

export default function OrdersPage() {
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [showManualOrder, setShowManualOrder] = useState(false)

  // Manual order form state
  const [moExchange, setMoExchange] = useState<Exchange>("polymarket")
  const [moBotId, setMoBotId] = useState("")
  const [moInstId, setMoInstId] = useState("")
  const [moSide, setMoSide] = useState<"BUY" | "SELL">("BUY")
  const [moType, setMoType] = useState<"LIMIT" | "MARKET">("LIMIT")
  const [moPrice, setMoPrice] = useState("")
  const [moSize, setMoSize] = useState("")

  const { exchange: currentExchange } = useExchange()

  const { data, isLoading } = useOrders({
    page,
    limit: 20,
    status: statusFilter === "all" ? undefined : statusFilter,
    sortBy: "createdAt",
    sortOrder: "desc",
  })

  const cancelOrder = useCancelOrder()
  const placeOrder = usePlaceManualOrder()
  const { data: botsData } = useBots({ limit: 100 })

  useRealtimeOrders()

  const handleCancel = (orderId: string) => {
    cancelOrder.mutate(orderId, {
      onSuccess: () => toast.success("Cancel request sent"),
      onError: (err) => toast.error(`Cancel failed: ${err.message}`),
    })
  }

  const columns: ColumnDef<Order>[] = [
    {
      accessorKey: "exchange",
      header: "Exchange",
      cell: ({ row }) => (
        <Badge variant="outline" className="capitalize">
          {row.original.exchange}
        </Badge>
      ),
    },
    {
      accessorKey: "instId",
      header: "Instrument",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.instId}</span>
      ),
    },
    {
      accessorKey: "side",
      header: "Side",
      cell: ({ row }) => (
        <span
          className={
            row.original.side === "BUY" ? "text-green-400" : "text-red-400"
          }
        >
          {row.original.side}
        </span>
      ),
    },
    {
      accessorKey: "type",
      header: "Type",
    },
    {
      accessorKey: "size",
      header: () => <span className="text-right">Size</span>,
      cell: ({ row }) => (
        <span className="text-right">{row.original.size}</span>
      ),
    },
    {
      accessorKey: "price",
      header: () => <span className="text-right">Price</span>,
      cell: ({ row }) => (
        <span className="text-right">{formatUsd(row.original.price)}</span>
      ),
    },
    {
      accessorKey: "filledSize",
      header: () => <span className="text-right">Filled</span>,
      cell: ({ row }) => (
        <span className="text-right">
          {row.original.filledSize ?? 0} / {row.original.size}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={orderStatusColors[row.original.status] ?? ""}
        >
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Time",
      cell: ({ row }) =>
        row.original.createdAt
          ? new Date(row.original.createdAt).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "-",
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const canCancel = ["PENDING", "OPEN", "PARTIALLY_FILLED"].includes(
          row.original.status
        )
        if (!canCancel) return null
        return (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleCancel(row.original.orderId)}
            disabled={cancelOrder.isPending}
          >
            <X className="h-4 w-4" />
          </Button>
        )
      },
    },
  ]

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: data?.totalPages ?? 0,
  })

  return (
    <>
      <PageHeader title="Orders" />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="OPEN">Open</SelectItem>
              <SelectItem value="PARTIALLY_FILLED">Partially Filled</SelectItem>
              <SelectItem value="FILLED">Filled</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setShowManualOrder(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Manual Order
          </Button>
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {columns.map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No orders found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-sm">
              Page {data.page} of {data.totalPages} ({data.total} total)
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Manual Order Dialog */}
      <Dialog open={showManualOrder} onOpenChange={setShowManualOrder}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Place Manual Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Exchange</Label>
                <Select
                  value={moExchange}
                  onValueChange={(v) => setMoExchange(v as Exchange)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="polymarket">Polymarket</SelectItem>
                    <SelectItem value="okx">OKX</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Bot</Label>
                <Select value={moBotId} onValueChange={setMoBotId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select bot" />
                  </SelectTrigger>
                  <SelectContent>
                    {(botsData?.data ?? [])
                      .filter((b) => b.exchange === moExchange)
                      .map((b) => (
                        <SelectItem key={b.botId} value={b.botId}>
                          {b.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Instrument ID</Label>
              <Input
                value={moInstId}
                onChange={(e) => setMoInstId(e.target.value)}
                placeholder={
                  moExchange === "polymarket"
                    ? "0x1234..."
                    : "BTC-USDT"
                }
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Side</Label>
                <Select
                  value={moSide}
                  onValueChange={(v) => setMoSide(v as "BUY" | "SELL")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BUY">Buy</SelectItem>
                    <SelectItem value="SELL">Sell</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={moType}
                  onValueChange={(v) => setMoType(v as "LIMIT" | "MARKET")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LIMIT">Limit</SelectItem>
                    <SelectItem value="MARKET">Market</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {moType === "LIMIT" && (
                <div className="space-y-2">
                  <Label>Price</Label>
                  <Input
                    type="number"
                    step="any"
                    value={moPrice}
                    onChange={(e) => setMoPrice(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Size</Label>
                <Input
                  type="number"
                  step="any"
                  value={moSize}
                  onChange={(e) => setMoSize(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManualOrder(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!moBotId || !moInstId || !moSize) {
                  toast.error("Please fill all required fields")
                  return
                }
                placeOrder.mutate(
                  {
                    botId: moBotId,
                    exchange: moExchange,
                    instId: moInstId,
                    side: moSide,
                    type: moType,
                    price: moType === "LIMIT" ? Number(moPrice) : 0,
                    size: Number(moSize),
                  },
                  {
                    onSuccess: () => {
                      toast.success("Order placed")
                      setShowManualOrder(false)
                      setMoBotId("")
                      setMoInstId("")
                      setMoPrice("")
                      setMoSize("")
                    },
                    onError: (err) =>
                      toast.error(`Order failed: ${err.message}`),
                  }
                )
              }}
              disabled={placeOrder.isPending}
            >
              {placeOrder.isPending ? "Placing..." : "Place Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
