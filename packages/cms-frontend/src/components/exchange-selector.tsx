"use client"

import { ChevronsUpDown, Globe, Layers } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { type ExchangeFilter, useExchange } from "@/lib/exchange-context"

const exchanges: { value: ExchangeFilter; label: string; description: string }[] = [
  { value: "all", label: "All Exchanges", description: "Show all" },
  { value: "polymarket", label: "Polymarket", description: "Prediction markets" },
  { value: "okx", label: "OKX", description: "Spot / Futures / Perp" },
]

export function ExchangeSelector() {
  const { isMobile } = useSidebar()
  const { exchange, setExchange } = useExchange()

  const current = exchanges.find((e) => e.value === exchange) ?? exchanges[0]

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                {current.value === "all" ? (
                  <Layers className="size-4" />
                ) : (
                  <Globe className="size-4" />
                )}
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{current.label}</span>
                <span className="truncate text-xs">{current.description}</span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Exchange Filter
            </DropdownMenuLabel>
            {exchanges.map((ex) => (
              <DropdownMenuItem
                key={ex.value}
                onClick={() => setExchange(ex.value)}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-md border">
                  {ex.value === "all" ? (
                    <Layers className="size-3.5 shrink-0" />
                  ) : (
                    <Globe className="size-3.5 shrink-0" />
                  )}
                </div>
                {ex.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
