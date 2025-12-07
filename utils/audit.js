export function logAudit(action, metadata = {}) {
  console.log(`[AUDIT] ${action}`, metadata);
}
