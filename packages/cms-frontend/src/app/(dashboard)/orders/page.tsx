import { PageHeader } from "@/components/page-header"

export default function OrdersPage() {
  return (
    <>
      <PageHeader title="Orders" />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="bg-muted/50 min-h-[400px] flex-1 rounded-xl p-6">
          <p className="text-muted-foreground text-sm">
            Order list with filters (T12)
          </p>
        </div>
      </div>
    </>
  )
}
