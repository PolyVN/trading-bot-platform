"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useBots, useBotAction, useDeleteBot } from "@/hooks/use-bots"
import { useRealtimeOrders } from "@/hooks/use-socket"
import {
  Plus,
  MoreHorizontal,
  Play,
  Square,
  Pause,
  RotateCcw,
  Trash2,
  ArrowUpDown,
  Eye,
} from "lucide-react"
import { toast } from "sonner"
import type { Bot } from "@shared/index"
import { botStatusColors } from "@/lib/status-colors"

export default function BotsPage() {
  const router = useRouter()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [sorting, setSorting] = useState<SortingState>([])
  const [deleteTarget, setDeleteTarget] = useState<Bot | null>(null)

  const { data, isLoading } = useBots({
    page,
    limit: 20,
    status: statusFilter === "all" ? undefined : statusFilter,
    sortBy: sorting[0]?.id,
    sortOrder: sorting[0]?.desc ? "desc" : "asc",
  })

  const botAction = useBotAction()
  const deleteBot = useDeleteBot()

  useRealtimeOrders()

  const handleAction = (botId: string, action: "start" | "stop" | "pause" | "resume") => {
    botAction.mutate(
      { botId, action },
      {
        onSuccess: () => toast.success(`Bot ${action} command sent`),
        onError: (err) => toast.error(`Failed to ${action} bot: ${err.message}`),
      }
    )
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    deleteBot.mutate(deleteTarget.botId, {
      onSuccess: () => {
        toast.success("Bot deleted")
        setDeleteTarget(null)
      },
      onError: (err) => toast.error(`Failed to delete: ${err.message}`),
    })
  }

  const columns: ColumnDef<Bot>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <Link
          href={`/bots/${row.original.botId}`}
          className="font-medium hover:underline"
        >
          {row.original.name}
        </Link>
      ),
    },
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
      accessorKey: "strategyName",
      header: "Strategy",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={botStatusColors[row.original.status] ?? ""}
        >
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "mode",
      header: "Mode",
      cell: ({ row }) => (
        <Badge variant={row.original.mode === "paper" ? "secondary" : "default"}>
          {row.original.mode}
        </Badge>
      ),
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Created
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) =>
        row.original.createdAt
          ? new Date(row.original.createdAt).toLocaleDateString()
          : "-",
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const bot = row.original
        const canStart = ["IDLE", "STOPPED", "ERROR", "RISK_STOPPED"].includes(bot.status)
        const canStop = ["RUNNING", "PAUSED"].includes(bot.status)
        const canPause = bot.status === "RUNNING"
        const canResume = bot.status === "PAUSED"

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(`/bots/${bot.botId}`)}>
                <Eye className="mr-2 h-4 w-4" />
                View
              </DropdownMenuItem>
              {canStart && (
                <DropdownMenuItem onClick={() => handleAction(bot.botId, "start")}>
                  <Play className="mr-2 h-4 w-4" />
                  Start
                </DropdownMenuItem>
              )}
              {canPause && (
                <DropdownMenuItem onClick={() => handleAction(bot.botId, "pause")}>
                  <Pause className="mr-2 h-4 w-4" />
                  Pause
                </DropdownMenuItem>
              )}
              {canResume && (
                <DropdownMenuItem onClick={() => handleAction(bot.botId, "resume")}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Resume
                </DropdownMenuItem>
              )}
              {canStop && (
                <DropdownMenuItem onClick={() => handleAction(bot.botId, "stop")}>
                  <Square className="mr-2 h-4 w-4" />
                  Stop
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="text-red-400"
                onClick={() => setDeleteTarget(bot)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
    manualPagination: true,
    pageCount: data?.totalPages ?? 0,
  })

  return (
    <>
      <PageHeader title="Bots" />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="RUNNING">Running</SelectItem>
                <SelectItem value="PAUSED">Paused</SelectItem>
                <SelectItem value="STOPPED">Stopped</SelectItem>
                <SelectItem value="IDLE">Idle</SelectItem>
                <SelectItem value="ERROR">Error</SelectItem>
                <SelectItem value="RISK_STOPPED">Risk Stopped</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => router.push("/bots/create")}>
            <Plus className="mr-2 h-4 w-4" />
            Create Bot
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
                    No bots found.
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Bot</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteBot.isPending}
            >
              {deleteBot.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
