/**
 * Canonical user-ID resolution for cross-browser message routing.
 * Maps known aliases / legacy IDs to their real Firebase Auth UID.
 */
export function resolveCanonicalId(rawId: string, name?: string): string {
  if (!rawId) return rawId;
  const lower = rawId.toLowerCase().trim();
  const lowerName = (name || "").toLowerCase().trim();

  if (
    lower === "u_mary_wanjiku" ||
    lower === "test_mary_uid_123" ||
    lowerName === "mary wanjiku" ||
    lower.includes("omwengajane")
  ) {
    return "eqOJbQs272VjoIQ53FWJGHyZkeq1";
  }
  if (lower === "u1" || lowerName === "james mutua" || lowerName === "james mutua (seller)") {
    return "demo_seller_456";
  }
  if (
    lower === "system_admin" ||
    lowerName.includes("support desk") ||
    lowerName.includes("must admin") ||
    lower === "demo_admin_789"
  ) {
    return "demo_admin_789";
  }
  return rawId;
}

export function getCanonicalConversationId(u1: string, u2: string): string {
  const c1 = resolveCanonicalId(u1);
  const c2 = resolveCanonicalId(u2);
  return c1 < c2 ? `${c1}_${c2}` : `${c2}_${c1}`;
}
