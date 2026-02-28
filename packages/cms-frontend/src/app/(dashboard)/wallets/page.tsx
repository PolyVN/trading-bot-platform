"use client"

import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useWallets, useCreateWallet, useDeleteWallet } from "@/hooks/use-wallets"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import type { Wallet, Exchange } from "@shared/index"

export default function WalletsPage() {
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Wallet | null>(null)

  // Create form state
  const [createExchange, setCreateExchange] = useState<Exchange>("polymarket")
  const [createName, setCreateName] = useState("")
  const [credFields, setCredFields] = useState<Record<string, string>>({})

  const { data, isLoading } = useWallets({ page, limit: 20 })
  const createWallet = useCreateWallet()
  const deleteWallet = useDeleteWallet()

  const handleCreate = () => {
    if (!createName) {
      toast.error("Name is required")
      return
    }
    createWallet.mutate(
      {
        name: createName,
        exchange: createExchange,
        credentials: credFields,
        walletMode: "exclusive",
      },
      {
        onSuccess: () => {
          toast.success("Wallet created")
          setShowCreate(false)
          setCreateName("")
          setCredFields({})
        },
        onError: (err) => toast.error(`Failed: ${err.message}`),
      }
    )
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    deleteWallet.mutate(deleteTarget.walletId, {
      onSuccess: () => {
        toast.success("Wallet deleted")
        setDeleteTarget(null)
      },
      onError: (err) => toast.error(`Failed: ${err.message}`),
    })
  }

  const wallets = data?.data ?? []

  const polymarketFields = [
    { key: "proxyAddress", label: "Proxy Address" },
    { key: "privateKey", label: "Private Key" },
    { key: "publicAddress", label: "Public Address" },
  ]

  const okxFields = [
    { key: "apiKey", label: "API Key" },
    { key: "secret", label: "API Secret" },
    { key: "passphrase", label: "Passphrase" },
  ]

  const currentFields =
    createExchange === "polymarket" ? polymarketFields : okxFields

  return (
    <>
      <PageHeader title="Wallets" />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        {/* Toolbar */}
        <div className="flex items-center justify-end">
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Wallet
          </Button>
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Exchange</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[60px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : wallets.length > 0 ? (
                wallets.map((wallet) => (
                  <TableRow key={wallet.walletId}>
                    <TableCell className="font-medium">{wallet.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {wallet.exchange}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{wallet.walletMode}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={wallet.isActive ? "default" : "secondary"}
                      >
                        {wallet.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {wallet.createdAt
                        ? new Date(wallet.createdAt).toLocaleDateString()
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(wallet)}
                      >
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    No wallets found. Add one to get started.
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
              Page {data.page} of {data.totalPages}
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

      {/* Create Wallet Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Wallet</DialogTitle>
            <DialogDescription>
              Connect an exchange wallet. Credentials are encrypted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Exchange</Label>
              <Select
                value={createExchange}
                onValueChange={(v) => {
                  setCreateExchange(v as Exchange)
                  setCredFields({})
                }}
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
              <Label>Wallet Name</Label>
              <Input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="My Wallet"
              />
            </div>

            {currentFields.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label>{field.label}</Label>
                <Input
                  type="password"
                  value={credFields[field.key] ?? ""}
                  onChange={(e) =>
                    setCredFields((prev) => ({
                      ...prev,
                      [field.key]: e.target.value,
                    }))
                  }
                  placeholder={`Enter ${field.label.toLowerCase()}`}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createWallet.isPending}
            >
              {createWallet.isPending ? "Creating..." : "Add Wallet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Wallet</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;?
              This will not affect bots using this wallet.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteWallet.isPending}
            >
              {deleteWallet.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
