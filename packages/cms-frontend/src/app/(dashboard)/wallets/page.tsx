import { PageHeader } from "@/components/page-header"

export default function WalletsPage() {
  return (
    <>
      <PageHeader title="Wallets" />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="bg-muted/50 min-h-[400px] flex-1 rounded-xl p-6">
          <p className="text-muted-foreground text-sm">
            Wallet list and management (T12)
          </p>
        </div>
      </div>
    </>
  )
}
