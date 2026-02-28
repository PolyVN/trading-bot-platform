export function formatUsd(value: number | undefined | null): string {
  if (value == null) return "$0.00"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatUsdPrecise(value: number | undefined | null): string {
  if (value == null) return "-"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(value)
}

export function formatPercent(value: number | undefined | null): string {
  if (value == null) return "0.00%"
  return `${value.toFixed(2)}%`
}
