export const botStatusColors: Record<string, string> = {
  RUNNING: "bg-green-500/15 text-green-400 border-green-500/20",
  PAUSED: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  RISK_STOPPED: "bg-red-500/15 text-red-400 border-red-500/20",
  ERROR: "bg-red-500/15 text-red-400 border-red-500/20",
  STOPPED: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
  IDLE: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
  STARTING: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  STOPPING: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  PAUSING: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
}

export const orderStatusColors: Record<string, string> = {
  PENDING: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  OPEN: "bg-green-500/15 text-green-400 border-green-500/20",
  PARTIALLY_FILLED: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  FILLED: "bg-green-500/15 text-green-400 border-green-500/20",
  CANCELLED: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
  REJECTED: "bg-red-500/15 text-red-400 border-red-500/20",
  EXPIRED: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
  FAILED: "bg-red-500/15 text-red-400 border-red-500/20",
  AMENDING: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  AMENDED: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  CANCELLING: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  AMBIGUOUS: "bg-purple-500/15 text-purple-400 border-purple-500/20",
}
