/**
 * Canonical user-ID resolution for cross-browser message routing.
 * Maps known aliases / legacy IDs to their real Firebase Auth UID.
 */
export function resolveCanonicalId(rawId: string, _name?: string): string {
  if (!rawId) return rawId;
  const lower = rawId.toLowerCase().trim();

  // Strictly map only exact legacy mock IDs — never alias real user accounts, names, or emails
  if (lower === "u_mary_wanjiku" || lower === "test_mary_uid_123") {
    return "eqOJbQs272VjoIQ53FWJGHyZkeq1";
  }
  if (lower === "u1") {
    return "demo_seller_456";
  }
  if (lower === "system_admin") {
    return "demo_admin_789";
  }
  return rawId;
}

export function getCanonicalConversationId(u1: string, u2: string): string {
  const c1 = resolveCanonicalId(u1);
  const c2 = resolveCanonicalId(u2);
  return c1 < c2 ? `${c1}_${c2}` : `${c2}_${c1}`;
}
