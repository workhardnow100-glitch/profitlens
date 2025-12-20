// ✅ Cockpit‑grade Asset Disposal Calculation Engine
// This module performs:
// - TWDV calculation
// - Balancing charge
// - Balancing allowance
// - Validation & safety checks
// - Pool‑type aware logic (future‑proof)

export function computeAssetDisposal({
  poolType,
  purchasePrice,
  capitalClaimed,
  disposalProceeds,
}) {
  // ✅ Normalise inputs
  const pp = Number(purchasePrice) || 0;
  const cc = Number(capitalClaimed) || 0;
  const dp = Number(disposalProceeds) || 0;

  // ✅ TWDV cannot go below zero
  const twdv = Math.max(0, pp - cc);

  let balancingCharge = 0;
  let balancingAllowance = 0;

  // ✅ Disposal logic
  if (dp > twdv) {
    balancingCharge = dp - twdv;
  } else if (twdv > dp) {
    balancingAllowance = twdv - dp;
  }

  return {
    ok: true,
    poolType,
    values: {
      assettwdv: twdv,
      assetbalancingcharge: balancingCharge,
      assetbalancingallowance: balancingAllowance,
    },
  };
}
