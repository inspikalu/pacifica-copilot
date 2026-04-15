import type { PositionRow } from "@/types/domain";

/**
 * Computes a composite risk score (0-100) based on current positions.
 * 
 * Score Bands:
 *   - 0-30:  Safe. Well diversified, low leverage.
 *   - 31-60: Caution. Approaching higher leverage or taking on some concentration risk.
 *   - 61-80: Warning. Elevated risk through high leverage, high concentration, or tight liquidation buffers.
 *   - 81+:   Critical. Dangerous account state requiring immediate protective action.
 * 
 * The formula is a weighted sum:
 * - Average Leverage: Weighted at 3x. E.g. average 10x leverage adds 30 points.
 * - Max Concentration: Weighted at 0.7x. E.g. 50% concentration in one asset adds 35 points.
 * - Liquidation Pressure: Adds a flat 18 points if ANY position has a liquidation buffer < 10%.
 */
export function scoreFromPositions(positions: PositionRow[]): number {
  if (positions.length === 0) {
    return 0;
  }

  // Calculate the average leverage across all positions
  const leveragePressure = positions.reduce((acc, position) => acc + position.leverage, 0) / positions.length;
  
  // Calculate the maximum concentration percentage in a single symbol
  const concentrationPressure = Math.max(...positions.map((position) => position.concentrationPct));
  
  // Apply a penalty if any position is within 10% of liquidation
  const liqPressure = positions.some((position) => {
    if (!position.liquidationPrice || position.markPrice === 0) return false;
    const distance = Math.abs(position.markPrice - position.liquidationPrice) / position.markPrice;
    return distance < 0.1;
  })
    ? 18
    : 0;

  // Final score is capped at 100
  return Math.min(100, Math.round(leveragePressure * 3 + concentrationPressure * 0.7 + liqPressure));
}
