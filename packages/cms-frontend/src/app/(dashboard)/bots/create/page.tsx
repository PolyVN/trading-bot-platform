"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useCreateBot } from "@/hooks/use-bots"
import { useWallets } from "@/hooks/use-wallets"
import { useEngines } from "@/hooks/use-engines"
import { toast } from "sonner"
import { ArrowLeft, ArrowRight, Check, Globe, Layers } from "lucide-react"
import type { CreateBotRequest, Exchange } from "@shared/index"

const STEPS = [
  "Exchange",
  "Config",
  "Strategy",
  "Risk Limits",
  "Wallet",
  "Review",
] as const

const STRATEGIES: Record<string, { name: string; exchanges: Exchange[] }> = {
  market_making: { name: "Market Making", exchanges: ["polymarket", "okx"] },
  signal_based: { name: "Signal Based", exchanges: ["polymarket", "okx"] },
  arbitrage: { name: "Cross-Exchange Arbitrage", exchanges: ["polymarket", "okx"] },
  grid_trading: { name: "Grid Trading", exchanges: ["okx"] },
  funding_rate_arb: { name: "Funding Rate Arb", exchanges: ["okx"] },
  dca: { name: "DCA", exchanges: ["okx"] },
}

export default function BotCreatePage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const createBot = useCreateBot()

  const form = useForm<CreateBotRequest>({
    defaultValues: {
      name: "",
      exchange: "polymarket",
      strategyName: "",
      walletId: "",
      mode: "paper",
      strategyConfig: {},
      exchangeConfig: {},
      instIds: [],
      tickInterval: 1000,
      riskLimits: {
        maxPositionSize: 1000,
        maxOrdersPerMinute: 10,
        maxDailyLoss: 100,
        maxDrawdown: 10,
      },
      tags: [],
      description: "",
    },
  })

  const exchange = form.watch("exchange")
  const strategyName = form.watch("strategyName")

  const { data: walletsData } = useWallets()
  const { data: enginesData } = useEngines()

  const filteredWallets = (walletsData?.data ?? []).filter(
    (w) => w.exchange === exchange
  )

  const filteredStrategies = Object.entries(STRATEGIES).filter(([, s]) =>
    s.exchanges.includes(exchange)
  )

  const engines = enginesData?.data ?? []

  const handleSubmit = form.handleSubmit((data) => {
    const engineId = engines[0]?.engineId
    if (!engineId) {
      toast.error("No engine available. Please start a trading engine first.")
      return
    }

    createBot.mutate(
      { ...data, assignedEngineId: engineId } as CreateBotRequest & { assignedEngineId: string },
      {
        onSuccess: () => {
          toast.success("Bot created successfully")
          router.push("/bots")
        },
        onError: (err) => toast.error(`Failed to create bot: ${err.message}`),
      }
    )
  })

  const canNext = () => {
    switch (step) {
      case 0:
        return !!exchange
      case 1:
        return !!form.getValues("name") && form.getValues("instIds").length > 0
      case 2:
        return !!strategyName
      case 3:
        return form.getValues("riskLimits.maxPositionSize") > 0
      case 4:
        return !!form.getValues("walletId")
      default:
        return true
    }
  }

  return (
    <>
      <PageHeader title="Create Bot" />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        {/* Step Indicators */}
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <button
                onClick={() => i < step && setStep(i)}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium ${
                  i === step
                    ? "bg-primary text-primary-foreground"
                    : i < step
                      ? "bg-primary/20 text-primary cursor-pointer"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </button>
              <span
                className={`text-sm ${i === step ? "font-medium" : "text-muted-foreground"}`}
              >
                {s}
              </span>
              {i < STEPS.length - 1 && (
                <div className="bg-border h-px w-8" />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <Card className="flex-1">
          <CardContent className="pt-6">
            {/* Step 0: Select Exchange */}
            {step === 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Select Exchange</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => form.setValue("exchange", "polymarket")}
                    className={`rounded-lg border-2 p-6 text-left transition ${
                      exchange === "polymarket"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <Globe className="mb-2 h-8 w-8" />
                    <h4 className="font-medium">Polymarket</h4>
                    <p className="text-muted-foreground text-sm">
                      Prediction markets. Binary outcomes, USDC only.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => form.setValue("exchange", "okx")}
                    className={`rounded-lg border-2 p-6 text-left transition ${
                      exchange === "okx"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <Layers className="mb-2 h-8 w-8" />
                    <h4 className="font-medium">OKX</h4>
                    <p className="text-muted-foreground text-sm">
                      Spot, futures, perpetuals. Multi-currency, leverage.
                    </p>
                  </button>
                </div>

                <div className="flex items-center gap-4">
                  <Label>Mode</Label>
                  <Select
                    value={form.watch("mode")}
                    onValueChange={(v) => form.setValue("mode", v as "live" | "paper")}
                  >
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paper">Paper</SelectItem>
                      <SelectItem value="live">Live</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Step 1: Exchange-specific config */}
            {step === 1 && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Bot Configuration</h3>

                <div className="space-y-2">
                  <Label>Bot Name</Label>
                  <Input
                    {...form.register("name", { required: true })}
                    placeholder="My Trading Bot"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    {...form.register("description")}
                    placeholder="Optional description..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>
                    {exchange === "polymarket"
                      ? "Condition IDs"
                      : "Instrument IDs"}
                  </Label>
                  <Input
                    placeholder={
                      exchange === "polymarket"
                        ? "0x1234...,0x5678..."
                        : "BTC-USDT,ETH-USDT"
                    }
                    onChange={(e) =>
                      form.setValue(
                        "instIds",
                        e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                      )
                    }
                  />
                  <p className="text-muted-foreground text-xs">
                    Comma-separated list
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Tick Interval (ms)</Label>
                  <Input
                    type="number"
                    {...form.register("tickInterval", { valueAsNumber: true })}
                  />
                </div>

                {exchange === "okx" && (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Instrument Type</Label>
                        <Select
                          onValueChange={(v) =>
                            form.setValue("exchangeConfig", {
                              ...form.getValues("exchangeConfig"),
                              instType: v,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SPOT">Spot</SelectItem>
                            <SelectItem value="MARGIN">Margin</SelectItem>
                            <SelectItem value="SWAP">Perpetual Swap</SelectItem>
                            <SelectItem value="FUTURES">Futures</SelectItem>
                            <SelectItem value="OPTION">Option</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Margin Mode</Label>
                        <Select
                          onValueChange={(v) =>
                            form.setValue("exchangeConfig", {
                              ...form.getValues("exchangeConfig"),
                              marginMode: v,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select mode" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cross">Cross</SelectItem>
                            <SelectItem value="isolated">Isolated</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Leverage</Label>
                      <Input
                        type="number"
                        min={1}
                        max={125}
                        placeholder="1"
                        onChange={(e) =>
                          form.setValue("exchangeConfig", {
                            ...form.getValues("exchangeConfig"),
                            leverage: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Step 2: Strategy */}
            {step === 2 && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Select Strategy</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  {filteredStrategies.map(([key, strategy]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => form.setValue("strategyName", key)}
                      className={`rounded-lg border-2 p-4 text-left transition ${
                        strategyName === key
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <h4 className="font-medium">{strategy.name}</h4>
                      <div className="mt-1 flex gap-1">
                        {strategy.exchanges.map((ex) => (
                          <Badge key={ex} variant="outline" className="text-xs capitalize">
                            {ex}
                          </Badge>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Risk Limits */}
            {step === 3 && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Risk Limits</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Max Position Size (USDC)</Label>
                    <Input
                      type="number"
                      {...form.register("riskLimits.maxPositionSize", {
                        valueAsNumber: true,
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Orders/Minute</Label>
                    <Input
                      type="number"
                      {...form.register("riskLimits.maxOrdersPerMinute", {
                        valueAsNumber: true,
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Daily Loss (USDC)</Label>
                    <Input
                      type="number"
                      {...form.register("riskLimits.maxDailyLoss", {
                        valueAsNumber: true,
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Drawdown (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      {...form.register("riskLimits.maxDrawdown", {
                        valueAsNumber: true,
                      })}
                    />
                  </div>
                </div>

                {exchange === "okx" && (
                  <>
                    <h4 className="text-muted-foreground text-sm font-medium">
                      OKX-specific Limits
                    </h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Max Leverage</Label>
                        <Input
                          type="number"
                          min={1}
                          max={125}
                          {...form.register("riskLimits.maxLeverage", {
                            valueAsNumber: true,
                          })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Max Position Notional (USDT)</Label>
                        <Input
                          type="number"
                          {...form.register("riskLimits.maxPositionNotional", {
                            valueAsNumber: true,
                          })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Liquidation Buffer (%)</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          {...form.register("riskLimits.liquidationBuffer", {
                            valueAsNumber: true,
                          })}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Step 4: Wallet */}
            {step === 4 && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Select Wallet</h3>
                {filteredWallets.length > 0 ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {filteredWallets.map((wallet) => (
                      <button
                        key={wallet.walletId}
                        type="button"
                        onClick={() => form.setValue("walletId", wallet.walletId)}
                        className={`rounded-lg border-2 p-4 text-left transition ${
                          form.watch("walletId") === wallet.walletId
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <h4 className="font-medium">{wallet.name}</h4>
                        <p className="text-muted-foreground text-sm capitalize">
                          {wallet.exchange}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    No wallets found for {exchange}. Please add a wallet first.
                  </p>
                )}
              </div>
            )}

            {/* Step 5: Review */}
            {step === 5 && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Review & Create</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-muted-foreground text-sm">Name</p>
                    <p className="font-medium">{form.getValues("name")}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">Exchange</p>
                    <Badge variant="outline" className="capitalize">
                      {form.getValues("exchange")}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">Strategy</p>
                    <p className="font-medium">
                      {STRATEGIES[form.getValues("strategyName")]?.name ??
                        form.getValues("strategyName")}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">Mode</p>
                    <Badge
                      variant={
                        form.getValues("mode") === "paper" ? "secondary" : "default"
                      }
                    >
                      {form.getValues("mode")}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">Instruments</p>
                    <p className="font-mono text-sm">
                      {form.getValues("instIds").join(", ") || "None"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">
                      Max Position Size
                    </p>
                    <p className="font-medium">
                      ${form.getValues("riskLimits.maxPositionSize")}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">
                      Max Daily Loss
                    </p>
                    <p className="font-medium">
                      ${form.getValues("riskLimits.maxDailyLoss")}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">
                      Max Drawdown
                    </p>
                    <p className="font-medium">
                      {form.getValues("riskLimits.maxDrawdown")}%
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => (step === 0 ? router.push("/bots") : setStep(step - 1))}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {step === 0 ? "Cancel" : "Back"}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canNext()}>
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={() => handleSubmit()}
              disabled={createBot.isPending}
            >
              {createBot.isPending ? "Creating..." : "Create Bot"}
            </Button>
          )}
        </div>
      </div>
    </>
  )
}
