import type { Cycle, Group } from "../types/api";

/**
 * Whether a cycle is the group's live cycle.
 *
 * ajo-server restarts `cycleNumber` at 1 for each round and only advances
 * `group.currentCycleNumber` when the previous cycle's payout finalises, so a
 * cycle is "current" exactly when its (round, cycleNumber) pair matches the
 * group's current round and cycle — and the group is still active (a
 * completed group still points at its final cycle).
 */
export function cycleIsCurrent(
  cycle: Cycle,
  group:
    | Pick<Group, "status" | "currentRound" | "currentCycleNumber">
    | null
    | undefined,
): boolean {
  if (!group) return false;
  if (group.status !== "active") return false;
  return (
    cycle.round === group.currentRound &&
    cycle.cycleNumber === group.currentCycleNumber
  );
}

/**
 * A cycle's total pot: every member's contribution for one rotation slot.
 * Mirrors how the design mock's ring centre shows cycle pot size.
 */
export function cyclePot(cycle: Pick<Cycle, "contributionAmount" | "totalSlots">): number {
  return cycle.contributionAmount * cycle.totalSlots;
}