/** Server-side only — do not import from Client Components. */
export function getConfig() {
  const notifGwUrl = process.env.NOTIF_GW_URL ?? "http://localhost:4103";
  const intelUrl = process.env.INTEL_URL ?? "http://localhost:4102";
  return { notifGwUrl, intelUrl };
}
