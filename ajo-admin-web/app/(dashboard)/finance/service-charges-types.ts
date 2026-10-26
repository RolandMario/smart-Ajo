import type { ServiceCharges } from "@/lib/data/finance";

export interface UpdateServiceChargesState {
  error?: string;
  successMessage?: string;
  charges?: ServiceCharges;
}
