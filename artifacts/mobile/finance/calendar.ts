import { localDate, validLocalDate } from "./ledger";
export function parseLocal(value: string): Date {
  if (!validLocalDate(value)) throw new Error("Enter a valid local calendar date (YYYY-MM-DD).");
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}
export function validMonth(month: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && Number(month.slice(0, 4)) >= 1900;
}
export function shiftMonth(month: string, offset: number): string {
  if (!validMonth(month)) throw new Error("Invalid budget month.");
  const [y, m] = month.split("-").map(Number);
  return localDate(new Date(y, m - 1 + offset, 1, 12)).slice(0, 7);
}
export function monthBounds(month: string): { from: string; to: string; days: number } {
  const next = shiftMonth(month, 1);
  const end = parseLocal(`${next}-01`); end.setDate(0);
  return { from: `${month}-01`, to: localDate(end), days: end.getDate() };
}
export function addDays(date: string, days: number): string {
  const d = parseLocal(date); d.setDate(d.getDate() + days); return localDate(d);
}
/** Anchor the original day each time: Jan 31 -> Feb 28/29 -> Mar 31. */
export function addMonths(date: string, months: number, anchorDay?: number): string {
  const d = parseLocal(date);
  const result = new Date(d.getFullYear(), d.getMonth() + months, 1, 12);
  const last = new Date(result.getFullYear(), result.getMonth() + 1, 0, 12).getDate();
  result.setDate(Math.min(anchorDay ?? d.getDate(), last));
  return localDate(result);
}
