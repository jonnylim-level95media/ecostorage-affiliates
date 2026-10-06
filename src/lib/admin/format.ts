const SG = "Asia/Singapore";

const dateFmt = new Intl.DateTimeFormat("en-SG", { dateStyle: "medium", timeZone: SG });
const isoDayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: SG });
const sgdFmt = new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" });

export function fmtDate(iso: string | null | undefined) {
  return iso ? dateFmt.format(new Date(iso)) : "—";
}

/** timestamptz → YYYY-MM-DD in Singapore time, for `<input type="date">`. */
export function toDateInput(iso: string | null | undefined) {
  return iso ? isoDayFmt.format(new Date(iso)) : "";
}

export function fmtSgd(amount: number | null | undefined) {
  return amount == null ? "—" : sgdFmt.format(amount);
}

export function fmtRate(rate: number | null | undefined) {
  return rate == null ? "—" : `${Math.round(rate * 100)}%`;
}

export function label(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ") : "—";
}

/** True if the timestamp is at or before the current moment (server time). */
export function isPast(iso: string | null | undefined) {
  return iso != null && new Date(iso).getTime() <= Date.now();
}

export function addDays(iso: string, days: number) {
  return new Date(new Date(iso).getTime() + days * 86_400_000).toISOString();
}
