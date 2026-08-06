type BadgeTone = "neutral" | "success" | "danger" | "warning" | "accent";

export function groupStatusTone(status: string): BadgeTone {
  switch (status) {
    case "active":
      return "success";
    case "completed":
      return "accent";
    case "terminated":
      return "danger";
    case "order_locked":
      return "warning";
    case "open_for_invites":
    default:
      return "neutral";
  }
}

export function groupStatusLabel(status: string): string {
  switch (status) {
    case "open_for_invites":
      return "Open for invites";
    case "order_locked":
      return "Order locked";
    case "active":
      return "Active";
    case "completed":
      return "Completed";
    case "terminated":
      return "Terminated";
    default:
      return status;
  }
}

export function inviteStatusTone(status: string): BadgeTone {
  switch (status) {
    case "accepted":
      return "success";
    case "declined":
      return "danger";
    case "pending":
    default:
      return "warning";
  }
}

export function payoutStatusTone(status: string): BadgeTone {
  return status === "collected" ? "success" : "neutral";
}

export function cycleStatusTone(status: string): BadgeTone {
  return status === "completed" ? "accent" : "warning";
}

export function transferStatusTone(status: string): BadgeTone {
  switch (status) {
    case "success":
      return "success";
    case "failed":
      return "danger";
    case "reversed":
      return "warning";
    case "pending":
    default:
      return "neutral";
  }
}

export function walletTxStatusTone(status: string): BadgeTone {
  switch (status) {
    case "success":
      return "success";
    case "failed":
      return "danger";
    case "pending":
    default:
      return "neutral";
  }
}

export function walletTxTypeLabel(type: string): string {
  switch (type) {
    case "funding":
      return "Funding";
    case "contribution_debit":
      return "Contribution debit";
    case "contribution_refund":
      return "Contribution refund";
    case "service_fee_debit":
      return "Service fee debit";
    default:
      return type;
  }
}

export function groupWalletTxTypeLabel(type: string): string {
  switch (type) {
    case "contribution_credit":
      return "Contribution credit";
    case "payout_debit":
      return "Payout debit";
    case "payout_reversal_credit":
      return "Payout reversal credit";
    case "service_fee_credit":
      return "Service fee credit";
    default:
      return type;
  }
}

export function groupWalletTxTone(type: string): BadgeTone {
  switch (type) {
    case "contribution_credit":
    case "payout_reversal_credit":
    case "service_fee_credit":
      return "success";
    case "payout_debit":
      return "neutral";
    default:
      return "neutral";
  }
}
