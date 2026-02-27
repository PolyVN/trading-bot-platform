import { PageHeader } from "@/components/page-header"

export default function StatsPage() {
  return (
    <>
      <PageHeader title="Stats" />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="bg-muted/50 min-h-[400px] flex-1 rounded-xl p-6">
          <p className="text-muted-foreground text-sm">
            PnL charts and statistics (T12)
          </p>
        </div>
      </div>
    </>
  )
}
