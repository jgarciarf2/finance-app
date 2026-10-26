import type { Debt } from './db';

/**
 * Ciclo de pago: va de un día de cobro al siguiente (ej. del 26 al 25).
 * Lo que se marca como pagado se guarda por ciclo, así cada ciclo nuevo
 * arranca con todo pendiente.
 */

export interface CycleState {
  payDay: number;
  /** cycleKey -> ids marcados como pagados en ese ciclo */
  paid: Record<string, { debts: string[]; expenses: string[] }>;
}

export const DEFAULT_CYCLE_STATE: CycleState = { payDay: 1, paid: {} };

const storageKey = (spaceId: string) => `fp-cycle-${spaceId}`;

export function loadCycleState(spaceId: string): CycleState {
  try {
    const raw = localStorage.getItem(storageKey(spaceId));
    if (!raw) return DEFAULT_CYCLE_STATE;
    const parsed = JSON.parse(raw);
    return { payDay: Number(parsed.payDay) || 1, paid: parsed.paid || {} };
  } catch {
    return DEFAULT_CYCLE_STATE;
  }
}

export function saveCycleState(spaceId: string, state: CycleState) {
  try {
    localStorage.setItem(storageKey(spaceId), JSON.stringify(state));
  } catch { /* storage lleno o bloqueado */ }
}

/** Día `day` de un mes, recortado al último día si el mes es más corto (31 en febrero → 28). */
function clampedDate(year: number, month: number, day: number) {
  const last = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, last));
}

const pad = (n: number) => String(n).padStart(2, '0');
export const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function getCycle(payDay: number, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start = clampedDate(today.getFullYear(), today.getMonth(), payDay);
  if (start > today) start = clampedDate(today.getFullYear(), today.getMonth() - 1, payDay);
  const nextPay = clampedDate(start.getFullYear(), start.getMonth() + 1, payDay);
  const end = new Date(nextPay);
  end.setDate(end.getDate() - 1);
  const dayMs = 86400000;
  return {
    key: dateKey(start),
    start,
    end,
    nextPay,
    daysLeft: Math.round((nextPay.getTime() - today.getTime()) / dayMs),
    totalDays: Math.round((nextPay.getTime() - start.getTime()) / dayMs),
  };
}

/** Fecha de vencimiento (día del mes) que cae dentro del ciclo, o null si no hay. */
export function dueDateInCycle(dueDay: number | null | undefined, cycle: { start: Date; end: Date }) {
  if (!dueDay) return null;
  for (let offset = 0; offset < 2; offset++) {
    const d = clampedDate(cycle.start.getFullYear(), cycle.start.getMonth() + offset, dueDay);
    if (d >= cycle.start && d <= cycle.end) return d;
  }
  return null;
}

/** Cuota que corresponde a este ciclo (la ya pagada en el ciclo sigue contando con su valor original). */
export function cycleDebtQuota(debt: Debt, paidThisCycle: boolean) {
  const idx = debt.installments_paid - (paidThisCycle ? 1 : 0);
  if (idx < 0 || idx >= debt.total_installments) return null;
  const remainingBefore = debt.total_capital - idx * debt.fixed_capital_payment;
  const interest = debt.has_interest ? remainingBefore * (debt.monthly_interest_rate / 100) : 0;
  return {
    installment: idx + 1,
    capital: debt.fixed_capital_payment,
    interest,
    quota: debt.fixed_capital_payment + interest,
  };
}
