import type { AppState } from "@/lib/store";

type RiskDerivedState = Pick<
  AppState,
  "riskEvents" | "stressResult" | "rebalancingPlans" | "selectedPlanId"
>;

/**
 * Remove a risk event and invalidate derived crisis state.
 *
 * Stress results, rebalancing plans, and the selected plan were computed from
 * the previous event set. Keeping them after a delete leaves monitoring, chat,
 * and the Rebalancing tab in ghost crisis mode (especially when the last event
 * is removed and Clear All is no longer reachable in the UI).
 */
export function removeRiskEventState(
  state: RiskDerivedState,
  eventId: string
): RiskDerivedState {
  const riskEvents = state.riskEvents.filter((event) => event.id !== eventId);
  if (riskEvents.length === state.riskEvents.length) {
    return {
      riskEvents: state.riskEvents,
      stressResult: state.stressResult,
      rebalancingPlans: state.rebalancingPlans,
      selectedPlanId: state.selectedPlanId,
    };
  }

  return {
    riskEvents,
    stressResult: null,
    rebalancingPlans: [],
    selectedPlanId: null,
  };
}
