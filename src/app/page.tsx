'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { getCycle, dueDateInCycle, cycleDebtQuota, loadCycleState, saveCycleState, DEFAULT_CYCLE_STATE, CycleState } from '@/lib/cycle';
import { db, Income, FixedExpense, Debt, Card, Family, FamilyMember, MemberSummary, SavingsGoal } from '@/lib/db';
import {
  Wallet, Receipt, CreditCard, Landmark, TrendingUp, TrendingDown,
  Trash2, Plus, LogOut, RefreshCw, Sun, Moon, CheckCircle2, Eye,
  Edit2, X, Scissors, Calendar, Banknote, Clock, Sparkles, PieChart,
  BarChart2, Activity, ArrowUpRight, AlertTriangle, Target,
  Users, UserPlus, Copy, Check, Hash, CreditCard as CardIcon,
  Shield, ChevronRight, Info, Circle,
} from 'lucide-react';

/* ── helpers ─────────────────────────────────────────────── */
const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CO');
const monthShort = (d: Date) => d.toLocaleString('es-ES', { month: 'short' });
const monthLong  = (d: Date) => d.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
const dateLabel  = (d: Date) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });

function getBillingInfo(cutoff_day: number) {
  const now     = new Date();
  const today   = now.getDate();
  const month   = now.getMonth();
  const year    = now.getFullYear();
  const cutoffDate = today <= cutoff_day
    ? new Date(year, month, cutoff_day)
    : new Date(year, month + 1, cutoff_day);
  const payDeadline = new Date(cutoffDate);
  payDeadline.setDate(payDeadline.getDate() + 15);
  const daysUntilCutoff = Math.ceil((cutoffDate.getTime() - now.getTime()) / 86400000);
  const daysUntilPay    = Math.ceil((payDeadline.getTime() - now.getTime()) / 86400000);
  return { cutoffDate, payDeadline, daysUntilCutoff, daysUntilPay };
}

/* ── SVG: Donut Chart ────────────────────────────────────── */
function DonutChart({ segments, size = 160, thickness = 26 }: {
  segments: { label: string; value: number; color: string }[];
  size?: number; thickness?: number;
}) {
  const total = segments.reduce((a, c) => a + c.value, 0);
  if (total === 0) return <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--surface-inset)', flexShrink: 0 }} />;
  const r = (size - thickness) / 2, cx = size / 2, cy = size / 2, C = 2 * Math.PI * r;
  let cum = 0;
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface-inset)" strokeWidth={thickness} />
      {segments.filter(s => s.value > 0).map((seg, i) => {
        const dash = (seg.value / total) * C, offset = -(cum / total) * C;
        cum += seg.value;
        return <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth={thickness - 3}
          strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={offset} transform={`rotate(-90 ${cx} ${cy})`} />;
      })}
    </svg>
  );
}

function BarChart({ groups, height = 160 }: { groups: { label: string; bars: { value: number; color: string }[] }[]; height?: number }) {
  const maxVal = Math.max(...groups.flatMap(g => g.bars.map(b => b.value)), 1);
  const barW = 16, gap = 6, groupW = (groups[0]?.bars.length ?? 1) * (barW + gap) - gap + 10;
  const totalW = groups.length * (groupW + 14) + 10;
  return (
    <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
      <svg width={totalW} height={height + 28}>
        {groups.map((group, gi) => {
          const groupX = 5 + gi * (groupW + 14);
          return (
            <g key={gi}>
              {group.bars.map((bar, bi) => {
                const bh = Math.max((bar.value / maxVal) * height, bar.value > 0 ? 3 : 0);
                return <rect key={bi} x={groupX + bi * (barW + gap)} y={height - bh} width={barW} height={bh} fill={bar.color} rx={4} />;
              })}
              <text x={groupX + groupW / 2 - 8} y={height + 18} textAnchor="middle" fontSize={9} fill="var(--text-muted)">{group.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function LineAreaChart({ data, height = 160 }: { data: { label: string; value: number }[]; height?: number }) {
  if (data.length < 2) return null;
  const padL = 56, padR = 16, padT = 14, padB = 26;
  const W = Math.max(data.length * 52 + padL + padR, 400);
  const vals = data.map(d => d.value), minV = Math.min(...vals), maxV = Math.max(...vals), range = maxV - minV || 1;
  const getX = (i: number) => padL + (i / (data.length - 1)) * (W - padL - padR);
  const getY = (v: number) => padT + ((maxV - v) / range) * (height - padT - padB);
  const zero = getY(0);
  const linePts = data.map((d, i) => `${getX(i)},${getY(d.value)}`).join(' ');
  const areaPts = [`${getX(0)},${Math.min(zero, height - padB)}`, ...data.map((d, i) => `${getX(i)},${getY(d.value)}`), `${getX(data.length - 1)},${Math.min(zero, height - padB)}`].join(' ');
  const yLabels = [maxV, (maxV + minV) / 2, minV].map(v => ({ v, y: getY(v), label: fmt(v).replace('.000.000', 'M').replace('.000', 'k') }));
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={W} height={height} style={{ display: 'block' }}>
        <defs>
          <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--green)" stopOpacity={0.25} /><stop offset="100%" stopColor="var(--green)" stopOpacity={0.02} /></linearGradient>
        </defs>
        {yLabels.map((yl, i) => <line key={i} x1={padL} y1={yl.y} x2={W - padR} y2={yl.y} stroke="var(--border)" strokeWidth={1} strokeDasharray="4 4" />)}
        {minV < 0 && maxV > 0 && <line x1={padL} y1={zero} x2={W - padR} y2={zero} stroke="var(--border)" strokeWidth={1.5} />}
        <polygon points={areaPts} fill={minV >= 0 ? 'url(#ag)' : 'rgba(255,69,58,0.06)'} />
        <polyline points={linePts} fill="none" stroke={minV >= 0 ? 'var(--green)' : 'var(--blue)'} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => <circle key={i} cx={getX(i)} cy={getY(d.value)} r={3.5} fill={d.value >= 0 ? 'var(--green)' : 'var(--red)'} stroke="var(--surface)" strokeWidth={2} />)}
        {data.map((d, i) => i % 2 === 0 && <text key={i} x={getX(i)} y={height - 6} textAnchor="middle" fontSize={8.5} fill="var(--text-muted)">{d.label}</text>)}
        {yLabels.map((yl, i) => <text key={i} x={padL - 6} y={yl.y + 4} textAnchor="end" fontSize={8} fill="var(--text-muted)">{yl.label}</text>)}
      </svg>
    </div>
  );
}

function HBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, Math.max(0, (value / (max || 1)) * 100));
  return <div className="progress-bar" style={{ height: 6 }}><div className="progress-fill" style={{ width: `${pct}%`, background: color }} /></div>;
}

/* ── Debt form card selector helper ─────────────────────── */
const DebtFormFields = ({ form, setForm, cards }: {
  form: any;
  setForm: (f: any) => void;
  cards: Card[];
}) => {
  const selectedCard = cards.find(c => c.id === form.card_id);
  return (
    <>
      <div className="form-group"><label>Nombre de la deuda</label><input type="text" className="form-control" placeholder="Ej. Tarjeta Visa — Computador" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
      <div className="form-row">
        <div className="form-group"><label>Monto financiado ($)</label><input type="number" className="form-control" placeholder="Ej. 1200000" value={form.total_capital} onChange={e => setForm({ ...form, total_capital: e.target.value })} required /></div>
        <div className="form-group"><label>Cuotas totales</label><input type="number" className="form-control" placeholder="Ej. 12" value={form.total_installments} onChange={e => setForm({ ...form, total_installments: e.target.value })} required /></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Cuotas ya pagadas</label><input type="number" className="form-control" placeholder="0" value={form.installments_paid} onChange={e => setForm({ ...form, installments_paid: e.target.value })} required /></div>
        <div className="form-group"><label>Fecha de compra</label><input type="date" className="form-control" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} required /></div>
      </div>
      <div className="form-group">
        <div className="switch-group" onClick={() => setForm({ ...form, has_interest: !form.has_interest })}>
          <span className="switch"><input type="checkbox" checked={form.has_interest} onChange={() => {}} /><span className="slider" /></span>
          <span>¿Tiene intereses mensuales?</span>
        </div>
      </div>
      {form.has_interest && <div className="form-group"><label>Tasa mensual (%)</label><input type="number" step="0.01" className="form-control" placeholder="Ej. 1.8" value={form.monthly_interest_rate} onChange={e => setForm({ ...form, monthly_interest_rate: e.target.value })} /></div>}

      <div style={{ borderTop: '1px solid var(--divider)', paddingTop: 16, marginTop: 4 }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <CardIcon size={13} /> <strong>Tarjeta de crédito</strong> — Opcional
        </div>
        {cards.length > 0 ? (
          <div className="form-group">
            <label>Tarjeta</label>
            <select className="form-control" value={form.card_id} onChange={e => setForm({ ...form, card_id: e.target.value, cutoff_day: '' })}>
              <option value="">Sin tarjeta / manual</option>
              {cards.map(c => <option key={c.id} value={c.id}>{c.name} (corte día {c.cutoff_day})</option>)}
            </select>
          </div>
        ) : (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '10px 14px', background: 'var(--surface-inset)', borderRadius: 'var(--radius-sm)', marginBottom: 12 }}>
            <Info size={13} style={{ display: 'inline', marginRight: 5 }} />
            No tienes tarjetas registradas. Agrégalas en el tab "Tarjetas".
          </div>
        )}
        {!form.card_id && (
          <div className="form-row">
            <div className="form-group"><label>Día de corte (manual)</label><input type="number" min="1" max="31" className="form-control" placeholder="Ej. 25" value={form.cutoff_day} onChange={e => setForm({ ...form, cutoff_day: e.target.value })} /><div className="form-hint">Día en que cierra el ciclo</div></div>
            <div className="form-group"><label>Día límite de pago</label><input type="number" min="1" max="31" className="form-control" placeholder="Auto: corte+15" value={form.cutoff_day ? String(parseInt(form.cutoff_day) + 15) : ''} disabled /><div className="form-hint">Corte + 15 días</div></div>
          </div>
        )}
        {selectedCard && (
          <div style={{ padding: '10px 14px', background: 'var(--blue-bg)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'var(--blue)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={14} />
            Corte: día {selectedCard.cutoff_day} · Pago límite: día {selectedCard.cutoff_day + 15}
          </div>
        )}
      </div>
    </>
  );
};

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */
type Tab = 'cycle' | 'dashboard' | 'projections' | 'savings' | 'cards' | 'family';

export default function Home() {
  /* auth */
  const [user, setUser]               = useState<any>(null);
  const [spaceId, setSpaceId]         = useState('');
  const [isLogin, setIsLogin]         = useState(true);
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [authError, setAuthError]     = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [forgotMode, setForgotMode]     = useState(false);   // pedir enlace de recuperación
  const [recoveryMode, setRecoveryMode] = useState(false);   // elegir nueva contraseña
  const [newPassword, setNewPassword]   = useState('');
  const [authInfo, setAuthInfo]         = useState('');

  /* app */
  const [loading, setLoading]         = useState(true);
  const [currentTab, setCurrentTab]   = useState<Tab>('cycle');
  const [theme, setTheme]             = useState<'dark' | 'light'>('dark');
  const [copied, setCopied]           = useState(false);
  const [showBillingSummary, setShowBillingSummary] = useState(false);
  const [expandedMonth, setExpandedMonth] = useState<number | null>(0);


  /* data */
  const [incomes, setIncomes]             = useState<Income[]>([]);
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [debts, setDebts]                 = useState<Debt[]>([]);
  const [cards, setCards]                 = useState<Card[]>([]);
  const [savingsGoals, setSavingsGoals]   = useState<SavingsGoal[]>([]);

  /* ciclo de pago */
  const [cycleState, setCycleState] = useState<CycleState>(DEFAULT_CYCLE_STATE);

  /* family */
  const [family, setFamily]               = useState<Family | null>(null);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [memberSummaries, setMemberSummaries] = useState<(MemberSummary & { loading: boolean })[]>([]);
  const [familyLoading, setFamilyLoading] = useState(false);
  const [familyError, setFamilyError]     = useState('');
  const [showCreateFamily, setShowCreateFamily] = useState(false);
  const [showJoinFamily, setShowJoinFamily]     = useState(false);
  const [familyName, setFamilyName]       = useState('Mi Familia');
  const [inviteInput, setInviteInput]     = useState('');

  /* modals */
  const [showIncomeModal,  setShowIncomeModal]  = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showDebtModal,    setShowDebtModal]    = useState(false);
  const [showCardModal,    setShowCardModal]    = useState(false);
  const [showSavingsModal, setShowSavingsModal] = useState(false);
  const [showManageDebtsModal, setShowManageDebtsModal] = useState(false);
  const [showAddFundsModal, setShowAddFundsModal] = useState<SavingsGoal | null>(null);
  const [amortDebt,    setAmortDebt]   = useState<Debt | null>(null);
  const [editingDebt,  setEditingDebt] = useState<Debt | null>(null);
  const [editingCard,  setEditingCard] = useState<Card | null>(null);
  const [editingGoal,  setEditingGoal] = useState<SavingsGoal | null>(null);

  /* forms */
  const [incomeForm,  setIncomeForm]  = useState({ name: '', amount: '', month: new Date().getMonth() + 1, year: new Date().getFullYear() });
  const [expenseForm, setExpenseForm] = useState({ name: '', amount: '', category: 'Vivienda' });
  const [cardForm,    setCardForm]    = useState({ name: '', cutoff_day: '' });
  
  const blankSavings = { name: '', target_amount: '', current_amount: '0', deadline: '', category: 'Fondo' };
  const [savingsForm, setSavingsForm] = useState(blankSavings);
  const [addFundsAmount, setAddFundsAmount] = useState('');

  const blankDebt = { name: '', total_capital: '', monthly_interest_rate: '0', total_installments: '12', installments_paid: '0', has_interest: false, start_date: new Date().toISOString().split('T')[0], card_id: '', cutoff_day: '' };
  const [debtForm,     setDebtForm]     = useState(blankDebt);
  const [editDebtForm, setEditDebtForm] = useState(blankDebt);

  /* ── theme ─────────────────────────────────────────────── */
  useEffect(() => { const s = typeof window !== 'undefined' && localStorage.getItem('fp-theme'); if (s === 'light' || s === 'dark') setTheme(s); }, []);
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); if (typeof window !== 'undefined') localStorage.setItem('fp-theme', theme); }, [theme]);

  /* ── recuperación de contraseña ─────────────────────────── */
  useEffect(() => {
    if (window.location.hash.includes('type=recovery')) setRecoveryMode(true);
    return db.auth.onPasswordRecovery(() => setRecoveryMode(true));
  }, []);

  /* ── session ────────────────────────────────────────────── */
  useEffect(() => { checkSession(); }, []);

  const checkSession = async () => {
    try {
      const u = await db.auth.getCurrentUser();
      if (u) { setUser(u); setSpaceId(u.space_id || ''); await fetchAll(u.space_id || '', u.id); }
      else setLoading(false);
    } catch { setLoading(false); }
  };

  const fetchAll = async (sId: string, userId?: string) => {
    setLoading(true);
    try {
      const [inc, exp, dbt, crd, svg] = await Promise.all([
        db.incomes.list(sId),
        db.fixedExpenses.list(sId),
        db.debts.list(sId),
        db.cards.list(sId),
        db.savingsGoals.list(sId)
      ]);
      setIncomes(inc); setFixedExpenses(exp); setDebts(dbt); setCards(crd); setSavingsGoals(svg);
      if (userId) fetchFamily(userId);
    } finally { setLoading(false); }
  };

  useEffect(() => { if (spaceId) setCycleState(loadCycleState(spaceId)); }, [spaceId]);
  const updateCycleState = (next: CycleState) => { setCycleState(next); saveCycleState(spaceId, next); };

  const fetchFamily = useCallback(async (userId: string) => {
    try {
      const result = await db.families.getMyFamily(userId);
      if (result) {
        setFamily(result.family);
        setFamilyMembers(result.members);
        // Load summaries for each member
        const summaries = result.members.map(m => ({ member: m, totalIncome: 0, totalExpenses: 0, totalDebtQuota: 0, freeCashFlow: 0, loading: true }));
        setMemberSummaries(summaries);
        summaries.forEach(async (s, i) => {
          const data = await db.families.getMemberSummary(s.member.space_id);
          setMemberSummaries(prev => {
            const next = [...prev];
            next[i] = { ...next[i], ...data, freeCashFlow: data.totalIncome - data.totalExpenses - data.totalDebtQuota, loading: false };
            return next;
          });
        });
      } else {
        setFamily(null); setFamilyMembers([]); setMemberSummaries([]);
      }
    } catch { /* family not in Supabase */ }
  }, []);

  /* ── auth ───────────────────────────────────────────────── */
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault(); setAuthError(''); setAuthLoading(true);
    try {
      const u: any = isLogin ? await db.auth.signIn(email, password) : await db.auth.signUp(email, password);
      setUser(u); setSpaceId(u.space_id || ''); await fetchAll(u.space_id || '', u.id);
    } catch (err: any) { setAuthError(err.message || 'Error de autenticación'); }
    finally { setAuthLoading(false); }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault(); setAuthError(''); setAuthInfo(''); setAuthLoading(true);
    try {
      await db.auth.requestPasswordReset(email);
      if (db.isDemo) { setForgotMode(false); setRecoveryMode(true); }
      else setAuthInfo('Te enviamos un correo con el enlace para crear una nueva contraseña. Revisa también spam.');
    } catch (err: any) { setAuthError(err.message || 'No se pudo enviar el correo'); }
    finally { setAuthLoading(false); }
  };

  const handleNewPassword = async (e: React.FormEvent) => {
    e.preventDefault(); setAuthError('');
    if (newPassword.length < 6) { setAuthError('La contraseña debe tener al menos 6 caracteres.'); return; }
    setAuthLoading(true);
    try {
      await db.auth.updatePassword(newPassword, email);
      setNewPassword(''); setRecoveryMode(false); setForgotMode(false);
      if (window.location.hash) history.replaceState(null, '', window.location.pathname);
      if (db.isDemo) { setPassword(''); setAuthInfo('Contraseña actualizada. Ya puedes iniciar sesión.'); }
      else await checkSession();
    } catch (err: any) { setAuthError(err.message || 'No se pudo actualizar la contraseña'); }
    finally { setAuthLoading(false); }
  };

  const handleSignOut = async () => {
    await db.auth.signOut();
    setUser(null); setSpaceId(''); setIncomes([]); setFixedExpenses([]); setDebts([]); setCards([]); setFamily(null);
  };

  /* ── CRUD ───────────────────────────────────────────────── */
  const addIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    await db.incomes.create({ space_id: spaceId, name: incomeForm.name, amount: parseFloat(incomeForm.amount), month: incomeForm.month, year: incomeForm.year });
    setShowIncomeModal(false); setIncomeForm({ name: '', amount: '', month: new Date().getMonth() + 1, year: new Date().getFullYear() }); fetchAll(spaceId, user?.id);
  };

  const addExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    await db.fixedExpenses.create({ space_id: spaceId, name: expenseForm.name, amount: parseFloat(expenseForm.amount), category: expenseForm.category });
    setShowExpenseModal(false); setExpenseForm({ name: '', amount: '', category: 'Vivienda' }); fetchAll(spaceId, user?.id);
  };

  const addCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCard) {
      await db.cards.update(editingCard.id, { name: cardForm.name, cutoff_day: parseInt(cardForm.cutoff_day) });
      setEditingCard(null);
    } else {
      await db.cards.create({ space_id: spaceId, name: cardForm.name, cutoff_day: parseInt(cardForm.cutoff_day) });
    }
    setShowCardModal(false); setCardForm({ name: '', cutoff_day: '' }); fetchAll(spaceId, user?.id);
  };

  const openEditCard = (card: Card) => {
    setCardForm({ name: card.name, cutoff_day: String(card.cutoff_day) });
    setEditingCard(card); setShowCardModal(true);
  };

  const addDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    const capital = parseFloat(debtForm.total_capital);
    const installments = parseInt(debtForm.total_installments);
    const selectedCard = cards.find(c => c.id === debtForm.card_id);
    const cutoffDay = selectedCard ? selectedCard.cutoff_day : (debtForm.cutoff_day ? parseInt(debtForm.cutoff_day) : null);
    const paymentDay = cutoffDay ? cutoffDay + 15 : null;
    try {
      await db.debts.create({ space_id: spaceId, name: debtForm.name, total_capital: capital, monthly_interest_rate: debtForm.has_interest ? parseFloat(debtForm.monthly_interest_rate) : 0, total_installments: installments, installments_paid: parseInt(debtForm.installments_paid), fixed_capital_payment: capital / installments, start_date: debtForm.start_date, has_interest: debtForm.has_interest, card_id: debtForm.card_id || null, cutoff_day: cutoffDay, payment_day: paymentDay });
      setShowDebtModal(false); setDebtForm(blankDebt); fetchAll(spaceId, user?.id);
    } catch (err: any) { alert('Error al agregar deuda: ' + err.message); }
  };

  const markInstallmentPaid = async (debt: Debt) => {
    if (debt.installments_paid >= debt.total_installments) return;
    if (!confirm(`¿Marcar cuota #${debt.installments_paid + 1} de "${debt.name}" como pagada?`)) return;
    await db.debts.updateInstallments(debt.id, debt.installments_paid + 1); fetchAll(spaceId, user?.id);
  };

  /* ── ciclo: marcar / desmarcar pagos ─────────────────────── */
  const cycle = useMemo(() => getCycle(cycleState.payDay), [cycleState.payDay]);
  const cyclePaid = cycleState.paid[cycle.key] || { debts: [], expenses: [] };

  const setCyclePaid = (next: { debts: string[]; expenses: string[] }) =>
    updateCycleState({ ...cycleState, paid: { ...cycleState.paid, [cycle.key]: next } });

  const toggleCycleDebt = async (debt: Debt) => {
    const isPaid = cyclePaid.debts.includes(debt.id);
    try {
      await db.debts.updateInstallments(debt.id, debt.installments_paid + (isPaid ? -1 : 1));
      setCyclePaid({ ...cyclePaid, debts: isPaid ? cyclePaid.debts.filter(id => id !== debt.id) : [...cyclePaid.debts, debt.id] });
      fetchAll(spaceId, user?.id);
    } catch (err: any) { alert('No se pudo actualizar el pago: ' + err.message); }
  };

  const toggleCycleExpense = (id: string) =>
    setCyclePaid({ ...cyclePaid, expenses: cyclePaid.expenses.includes(id) ? cyclePaid.expenses.filter(e => e !== id) : [...cyclePaid.expenses, id] });

  const openEditDebt = (debt: Debt) => {
    setEditDebtForm({ name: debt.name, total_capital: String(debt.total_capital), monthly_interest_rate: String(debt.monthly_interest_rate), total_installments: String(debt.total_installments), installments_paid: String(debt.installments_paid), has_interest: debt.has_interest, start_date: debt.start_date, card_id: debt.card_id || '', cutoff_day: debt.cutoff_day ? String(debt.cutoff_day) : '' });
    setEditingDebt(debt);
  };

  const saveEditDebt = async (e: React.FormEvent) => {
    e.preventDefault(); if (!editingDebt) return;
    const capital = parseFloat(editDebtForm.total_capital);
    const installments = parseInt(editDebtForm.total_installments);
    const selectedCard = cards.find(c => c.id === editDebtForm.card_id);
    const cutoffDay = selectedCard ? selectedCard.cutoff_day : (editDebtForm.cutoff_day ? parseInt(editDebtForm.cutoff_day) : null);
    const paymentDay = cutoffDay ? cutoffDay + 15 : null;
    try {
      await db.debts.update(editingDebt.id, { name: editDebtForm.name, total_capital: capital, monthly_interest_rate: editDebtForm.has_interest ? parseFloat(editDebtForm.monthly_interest_rate) : 0, total_installments: installments, installments_paid: parseInt(editDebtForm.installments_paid), fixed_capital_payment: capital / installments, start_date: editDebtForm.start_date, has_interest: editDebtForm.has_interest, card_id: editDebtForm.card_id || null, cutoff_day: cutoffDay, payment_day: paymentDay });
      setEditingDebt(null); fetchAll(spaceId, user?.id);
    } catch (err: any) { alert('Error al editar: ' + err.message); }
  };

  const deleteIncome  = async (id: string) => { if (confirm('¿Eliminar?')) { await db.incomes.delete(id); fetchAll(spaceId, user?.id); } };
  const deleteExpense = async (id: string) => { if (confirm('¿Eliminar?')) { await db.fixedExpenses.delete(id); fetchAll(spaceId, user?.id); } };
  const deleteDebt    = async (id: string) => { if (confirm('¿Eliminar esta deuda?')) { await db.debts.delete(id); fetchAll(spaceId, user?.id); } };
  const deleteCard    = async (id: string) => { if (confirm('¿Eliminar esta tarjeta?')) { await db.cards.delete(id); fetchAll(spaceId, user?.id); } };

  /* savings goals actions */
  const addSavingsGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseFloat(savingsForm.target_amount);
    const current = parseFloat(savingsForm.current_amount || '0');
    if (editingGoal) {
      await db.savingsGoals.update(editingGoal.id, { name: savingsForm.name, target_amount: target, current_amount: current, deadline: savingsForm.deadline || undefined, category: savingsForm.category });
      setEditingGoal(null);
    } else {
      await db.savingsGoals.create({ space_id: spaceId, name: savingsForm.name, target_amount: target, current_amount: current, deadline: savingsForm.deadline || undefined, category: savingsForm.category });
    }
    setShowSavingsModal(false); setSavingsForm(blankSavings); fetchAll(spaceId, user?.id);
  };

  const deleteSavingsGoal = async (id: string) => {
    if (confirm('¿Eliminar esta meta de ahorro?')) {
      await db.savingsGoals.delete(id);
      fetchAll(spaceId, user?.id);
    }
  };

  const addSavingsFunds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAddFundsModal) return;
    const amount = parseFloat(addFundsAmount);
    if (isNaN(amount) || amount <= 0) return;
    await db.savingsGoals.addFunds(showAddFundsModal.id, amount);
    setShowAddFundsModal(null); setAddFundsAmount(''); fetchAll(spaceId, user?.id);
  };

  const openEditGoal = (goal: SavingsGoal) => {
    setSavingsForm({
      name: goal.name,
      target_amount: String(goal.target_amount),
      current_amount: String(goal.current_amount),
      deadline: goal.deadline || '',
      category: goal.category || 'Fondo'
    });
    setEditingGoal(goal); setShowSavingsModal(true);
  };

  const copyCode = (code: string) => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  /* ── Family actions ─────────────────────────────────────── */
  const handleCreateFamily = async (e: React.FormEvent) => {
    e.preventDefault(); setFamilyError(''); setFamilyLoading(true);
    try {
      await db.families.create(user.id, familyName);
      setShowCreateFamily(false); fetchFamily(user.id);
    } catch (err: any) { setFamilyError(err.message); }
    finally { setFamilyLoading(false); }
  };

  const handleJoinFamily = async (e: React.FormEvent) => {
    e.preventDefault(); setFamilyError(''); setFamilyLoading(true);
    try {
      await db.families.join(user.id, inviteInput);
      setShowJoinFamily(false); setInviteInput(''); fetchFamily(user.id);
    } catch (err: any) { setFamilyError(err.message); }
    finally { setFamilyLoading(false); }
  };

  const handleLeaveFamily = async () => {
    if (!confirm('¿Salir del grupo familiar? Tus datos personales no se eliminarán.')) return;
    try { await db.families.leave(user.id); setFamily(null); setFamilyMembers([]); setMemberSummaries([]); }
    catch (err: any) { alert(err.message); }
  };

  /* ── Financials ─────────────────────────────────────────── */
  const totalIncomes       = incomes.reduce((a, c) => a + c.amount, 0);
  const totalFixedExpenses = fixedExpenses.reduce((a, c) => a + c.amount, 0);
  const totalSaved         = savingsGoals.reduce((a, g) => a + (g.current_amount || 0), 0);
  const totalSavedTarget   = savingsGoals.reduce((a, g) => a + (g.target_amount || 0), 0);

  const activeDebtsDetails = debts.map(debt => {
    const done = debt.installments_paid >= debt.total_installments;
    if (done) return { ...debt, currentInterest: 0, currentQuota: 0, currentCapital: 0, remainingBalance: 0, isCompleted: true };
    const remaining = debt.total_capital - debt.installments_paid * debt.fixed_capital_payment;
    const interest  = debt.has_interest ? remaining * (debt.monthly_interest_rate / 100) : 0;
    return { ...debt, currentInterest: interest, currentCapital: debt.fixed_capital_payment, currentQuota: debt.fixed_capital_payment + interest, remainingBalance: remaining - debt.fixed_capital_payment, isCompleted: false };
  });

  const totalDebtQuota     = activeDebtsDetails.filter(d => !d.isCompleted).reduce((a, d) => a + d.currentQuota, 0);
  const freeCashFlow       = totalIncomes - totalFixedExpenses - totalDebtQuota;
  const totalRemainingDebt = activeDebtsDetails.reduce((a, d) => a + (d.remainingBalance || 0), 0);
  const savingsRate     = totalIncomes > 0 ? (freeCashFlow / totalIncomes) * 100 : 0;
  const debtToIncome    = totalIncomes > 0 ? (totalDebtQuota / totalIncomes) * 100 : 0;
  const totalInterestRemaining = activeDebtsDetails.filter(d => !d.isCompleted && d.has_interest).reduce((acc, debt) => {
    let bal = debt.total_capital - debt.installments_paid * debt.fixed_capital_payment, tot = 0;
    for (let i = debt.installments_paid; i < debt.total_installments; i++) { const interest = bal * (debt.monthly_interest_rate / 100); tot += interest; bal -= debt.fixed_capital_payment; }
    return acc + tot;
  }, 0);

  /* ── Ciclo de pago ───────────────────────────────────────── */
  const cycleItems = (() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const daysTo = (d: Date | null) => d ? Math.round((d.getTime() - today.getTime()) / 86400000) : null;
    const debtItems = debts.flatMap(debt => {
      const paid = cyclePaid.debts.includes(debt.id);
      const q = cycleDebtQuota(debt, paid);
      if (!q) return [];
      const due = dueDateInCycle(debt.payment_day, cycle);
      return [{ kind: 'debt' as const, id: debt.id, debt, name: debt.name, amount: q.quota, paid, due, daysToDue: daysTo(due),
        sub: `Cuota ${q.installment}/${debt.total_installments}` + (cards.find(c => c.id === debt.card_id) ? ` · ${cards.find(c => c.id === debt.card_id)!.name}` : '') }];
    });
    const expenseItems = fixedExpenses.map(e => ({ kind: 'expense' as const, id: e.id, debt: null, name: e.name, amount: e.amount, paid: cyclePaid.expenses.includes(e.id), due: null as Date | null, daysToDue: null as number | null, sub: e.category }));
    const byDue = (a: { paid: boolean; due: Date | null }, b: { paid: boolean; due: Date | null }) =>
      Number(a.paid) - Number(b.paid) || (a.due?.getTime() ?? Infinity) - (b.due?.getTime() ?? Infinity);
    return { debts: debtItems.sort(byDue), expenses: expenseItems.sort(byDue) };
  })();
  const cycleAll        = [...cycleItems.debts, ...cycleItems.expenses];
  const cycleTotal      = cycleAll.reduce((a, i) => a + i.amount, 0);
  const cyclePaidTotal  = cycleAll.filter(i => i.paid).reduce((a, i) => a + i.amount, 0);
  const cyclePending    = cycleTotal - cyclePaidTotal;
  const cycleInHand     = totalIncomes - cyclePaidTotal;       // lo que te queda ahora mismo
  const cycleLeftover   = totalIncomes - cycleTotal;           // lo que sobra cuando pagues todo
  const cycleFmtDay     = (d: Date) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

  /* ── Billing summary ─────────────────────────────────────── */
  const billingSummary = useMemo(() => {
    const activeDebts = activeDebtsDetails.filter(d => !d.isCompleted);
    // Group by card
    const cardGroups: Record<string, { card: Card | null; debts: typeof activeDebts; total: number }> = {};

    activeDebts.forEach(debt => {
      const cardId = debt.card_id || '_none';
      const card   = cards.find(c => c.id === debt.card_id) || null;
      if (!cardGroups[cardId]) cardGroups[cardId] = { card, debts: [], total: 0 };
      cardGroups[cardId].debts.push(debt);
      cardGroups[cardId].total += debt.currentQuota;
    });

    return Object.values(cardGroups);
  }, [activeDebtsDetails, cards]);

  /* ── Amortization ────────────────────────────────────────── */
  const buildAmortTable = (debt: Debt) => {
    const rows = [];
    let remaining = debt.total_capital;
    for (let i = 1; i <= debt.total_installments; i++) {
      const interest = debt.has_interest ? remaining * (debt.monthly_interest_rate / 100) : 0;
      const quota    = debt.fixed_capital_payment + interest;
      remaining -= debt.fixed_capital_payment;
      rows.push({ num: i, capital: debt.fixed_capital_payment, interest, quota, remaining: Math.max(0, remaining), paid: i <= debt.installments_paid, isNext: i === debt.installments_paid + 1 });
    }
    return rows;
  };

  /* ── Projections ─────────────────────────────────────────── */
  const projections = useMemo(() => {
    const now = new Date(), todayDay = now.getDate();
    const debtEndMonths = debts.map(debt => {
      let offset = 0;
      if (debt.cutoff_day) { if (new Date(debt.start_date).getDate() > debt.cutoff_day) offset++; if (todayDay > debt.cutoff_day) offset++; }
      return debt.total_installments - debt.installments_paid + offset;
    });
    const maxMonths = Math.max(12, ...debtEndMonths, 1);
    return Array.from({ length: maxMonths }, (_, i) => {
      const simDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      let simDebtsQuota = 0;
      const simDebts = debts.map(debt => {
        const start = new Date(debt.start_date);
        let offset = 0;
        if (debt.cutoff_day) { if (start.getDate() > debt.cutoff_day) offset++; if (i === 0 && todayDay > debt.cutoff_day) offset++; }
        const adjStart   = new Date(start.getFullYear(), start.getMonth() + offset, 1);
        const diffMonths = (simDate.getFullYear() - adjStart.getFullYear()) * 12 + simDate.getMonth() - adjStart.getMonth();
        if (diffMonths < 0 || diffMonths >= debt.total_installments) {
          return { name: debt.name, quota: 0, payment_day: debt.payment_day, totalCapital: 0, paidCapital: 0, remainingBalance: 0, currentInstallment: 0, totalInstallments: 0 };
        }
        const remainBefore = debt.total_capital - diffMonths * debt.fixed_capital_payment;
        const interest     = debt.has_interest ? remainBefore * (debt.monthly_interest_rate / 100) : 0;
        const quota        = debt.fixed_capital_payment + interest;
        simDebtsQuota += quota;
        return {
          name: debt.name,
          quota,
          payment_day: debt.payment_day,
          totalCapital: debt.total_capital,
          paidCapital: (diffMonths + 1) * debt.fixed_capital_payment,
          remainingBalance: Math.max(0, debt.total_capital - (diffMonths + 1) * debt.fixed_capital_payment),
          currentInstallment: diffMonths + 1,
          totalInstallments: debt.total_installments
        };
      });
      const cashFlow = totalIncomes - totalFixedExpenses - simDebtsQuota;
      return { date: simDate, label: monthLong(simDate), short: monthShort(simDate), incomes: totalIncomes, fixedExpenses: totalFixedExpenses, debtsQuota: simDebtsQuota, cashFlow, debtItems: simDebts.filter(d => d.quota > 0), isDebtFree: simDebtsQuota === 0 };
    });
  }, [debts, totalIncomes, totalFixedExpenses]);

  const debtFreeIdx  = projections.findIndex((p, i) => p.isDebtFree && i > 0 && !projections[i - 1]?.isDebtFree);
  const debtFreeDate = debtFreeIdx >= 0 ? projections[debtFreeIdx]?.label : null;

  /* chart data */
  const donutSegments = [
    { label: 'Egresos fijos', value: totalFixedExpenses, color: 'var(--red)' },
    { label: 'Cuotas deuda',  value: totalDebtQuota,     color: 'var(--orange)' },
    { label: 'Disponible',    value: Math.max(0, freeCashFlow), color: 'var(--green)' },
  ];
  const barChartGroups = projections.slice(0, 8).map(p => ({ label: p.short, bars: [{ value: p.incomes, color: 'var(--green)' }, { value: p.fixedExpenses, color: 'var(--red)' }, { value: p.debtsQuota, color: 'var(--orange)' }] }));
  const lineChartData  = projections.slice(0, 18).map(p => ({ label: p.short, value: p.cashFlow }));
  const expenseCategoryTotals = fixedExpenses.reduce((acc, exp) => { acc[exp.category] = (acc[exp.category] || 0) + exp.amount; return acc; }, {} as Record<string, number>);
  const categoryColors: Record<string, string> = { Vivienda: 'var(--blue)', Servicios: 'var(--purple)', Alimentación: 'var(--orange)', Transporte: 'var(--green)', Suscripciones: 'var(--red)', Salud: '#ec4899', Educación: '#06b6d4', Otros: 'var(--text-muted)' };



  /* ═══════════════════════════════════════════════════════════
     AUTH SCREEN
     ═══════════════════════════════════════════════════════════ */
  if (recoveryMode) return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}><Wallet size={28} /> Finanzas Pro</div>
        <p className="auth-sub">Crea tu nueva contraseña</p>
        {authError && <div className="auth-error">{authError}</div>}
        <form onSubmit={handleNewPassword}>
          {db.isDemo && <div className="form-group"><label>Correo electrónico</label><input type="email" className="form-control" value={email} onChange={e => setEmail(e.target.value)} required /></div>}
          <div className="form-group"><label>Nueva contraseña</label><input type="password" className="form-control" placeholder="Mínimo 6 caracteres" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={6} required autoFocus /></div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }} disabled={authLoading}>
            {authLoading ? <RefreshCw size={16} className="spin" /> : 'Guardar contraseña'}
          </button>
        </form>
      </div>
    </div>
  );

  if (!user && !loading && forgotMode) return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}><Wallet size={28} /> Finanzas Pro</div>
        <p className="auth-sub">Recupera tu contraseña</p>
        {authError && <div className="auth-error">{authError}</div>}
        {authInfo && <div className="auth-error" style={{ background: 'var(--green-bg)', color: 'var(--green)' }}>{authInfo}</div>}
        <form onSubmit={handleForgot}>
          <div className="form-group"><label>Correo electrónico</label><input type="email" className="form-control" placeholder="tu@correo.com" value={email} onChange={e => setEmail(e.target.value)} required /></div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }} disabled={authLoading}>
            {authLoading ? <RefreshCw size={16} className="spin" /> : (db.isDemo ? 'Continuar' : 'Enviar enlace')}
          </button>
        </form>
        <button type="button" className="btn btn-ghost" style={{ width: '100%', marginTop: 10 }} onClick={() => { setForgotMode(false); setAuthError(''); setAuthInfo(''); }}>Volver a iniciar sesión</button>
      </div>
    </div>
  );

  if (!user && !loading) return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}><Wallet size={28} /> Finanzas Pro</div>
        <p className="auth-sub">Tu panel de finanzas personales y familiares</p>
        <div className="auth-tabs">
          <button className={`auth-tab ${isLogin ? 'active' : ''}`} onClick={() => setIsLogin(true)}>Iniciar sesión</button>
          <button className={`auth-tab ${!isLogin ? 'active' : ''}`} onClick={() => setIsLogin(false)}>Registrarse</button>
        </div>
        {authError && <div className="auth-error">{authError}</div>}
        {authInfo && <div className="auth-error" style={{ background: 'var(--green-bg)', color: 'var(--green)' }}>{authInfo}</div>}
        <form onSubmit={handleAuth}>
          <div className="form-group"><label>Correo electrónico</label><input type="email" className="form-control" placeholder="tu@correo.com" value={email} onChange={e => setEmail(e.target.value)} required /></div>
          <div className="form-group"><label>Contraseña</label><input type="password" className="form-control" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required /></div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }} disabled={authLoading}>
            {authLoading ? <RefreshCw size={16} className="spin" /> : (isLogin ? 'Entrar' : 'Crear cuenta')}
          </button>
          {isLogin && <button type="button" className="btn btn-ghost" style={{ width: '100%', marginTop: 8, fontSize: '0.82rem' }} onClick={() => { setForgotMode(true); setAuthError(''); setAuthInfo(''); }}>¿Olvidaste tu contraseña?</button>}
        </form>
      </div>
    </div>
  );

  if (loading) return <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}><RefreshCw size={32} className="spin" style={{ color: 'var(--text-muted)' }} /></div>;

  /* ═══════════════════════════════════════════════════════════
     MAIN APP
     ═══════════════════════════════════════════════════════════ */
  return (
    <>
      {/* ── HEADER ─────────────────────────────────────────── */}
      <header className="main-header">
        <div className="logo"><Wallet size={18} /><span className="logo-text">Finanzas Pro</span></div>
        <div className="nav-links">
          <button className={`nav-link ${currentTab === 'cycle' ? 'active' : ''}`} onClick={() => setCurrentTab('cycle')}>
            <Calendar size={14} />
            <span>Mi ciclo</span>
          </button>
          <button className={`nav-link ${currentTab === 'dashboard'   ? 'active' : ''}`} onClick={() => setCurrentTab('dashboard')}>
            <PieChart size={14} />
            <span>Dashboard</span>
          </button>
          <button className={`nav-link ${currentTab === 'projections' ? 'active' : ''}`} onClick={() => setCurrentTab('projections')}>
            <TrendingUp size={14} />
            <span>Proyecciones</span>
          </button>
          <button className={`nav-link ${currentTab === 'savings'     ? 'active' : ''}`} onClick={() => setCurrentTab('savings')}>
            <Target size={14} />
            <span>Metas</span>
          </button>
          <button className={`nav-link ${currentTab === 'cards'       ? 'active' : ''}`} onClick={() => setCurrentTab('cards')}>
            <CreditCard size={14} />
            <span>Tarjetas</span>
          </button>
          <button className={`nav-link ${currentTab === 'family'      ? 'active' : ''}`} onClick={() => setCurrentTab('family')}>
            <Users size={14} />
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              Familia
              {family && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />}
            </span>
          </button>
        </div>
        <div className="header-actions">
          <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} className="btn btn-ghost btn-icon" title={theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}>
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button onClick={handleSignOut} className="btn btn-ghost btn-icon" title="Cerrar sesión"><LogOut size={15} /></button>
        </div>
      </header>

      <main className="dashboard-container">

        {/* ══════════════════════════════
            TAB: MI CICLO
            ══════════════════════════════ */}
        {currentTab === 'cycle' && (
          <div className="cycle-page">
            <div className="card cycle-hero">
              <div className="cycle-hero-top">
                <div>
                  <div className="cycle-eyebrow">Ciclo actual</div>
                  <div className="cycle-range">{cycleFmtDay(cycle.start)} → {cycleFmtDay(cycle.end)}</div>
                </div>
                <label className="cycle-payday">
                  <span>Me pagan el día</span>
                  <select className="form-control" value={cycleState.payDay} onChange={e => updateCycleState({ ...cycleState, payDay: parseInt(e.target.value) })}>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </label>
              </div>

              <div className="cycle-amount-label">Te queda ahora</div>
              <div className={`cycle-amount ${cycleInHand >= 0 ? '' : 'neg'}`}>{fmt(cycleInHand)}</div>
              <div className="cycle-hint">
                {cycle.daysLeft === 1 ? 'Mañana' : `En ${cycle.daysLeft} días`} te pagan ({cycleFmtDay(cycle.nextPay)}) ·
                {' '}{cycleLeftover >= 0 ? <>sobrarán <strong>{fmt(cycleLeftover)}</strong> al pagar todo</> : <>faltarán <strong>{fmt(-cycleLeftover)}</strong> para cubrir todo</>}
              </div>

              <div className="cycle-progress"><div style={{ width: `${cycleTotal ? (cyclePaidTotal / cycleTotal) * 100 : 0}%` }} /></div>
              <div className="cycle-progress-legend">
                <span>Pagado <strong>{fmt(cyclePaidTotal)}</strong></span>
                <span>Pendiente <strong>{fmt(cyclePending)}</strong></span>
              </div>
            </div>

            {totalIncomes === 0 && (
              <div className="card cycle-note"><Info size={15} /> Aún no has registrado ingresos. Agrégalos en el Dashboard para ver cuánto te queda.</div>
            )}

            {([
              { title: 'Cuotas de deudas', icon: <CreditCard size={16} />, items: cycleItems.debts, empty: 'No tienes cuotas en este ciclo' },
              { title: 'Egresos fijos',    icon: <Receipt size={16} />,    items: cycleItems.expenses, empty: 'No tienes egresos fijos' },
            ]).map(section => (
              <div className="card" key={section.title}>
                <div className="section-header">
                  <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>{section.icon}{section.title}</div>
                  <span className="cycle-count">{section.items.filter(i => i.paid).length}/{section.items.length} pagados</span>
                </div>
                {section.items.length === 0 ? (
                  <div className="empty-state"><div className="empty-state-text">{section.empty}</div></div>
                ) : (
                  <div className="cycle-list">
                    {section.items.map(item => {
                      const late = !item.paid && item.daysToDue !== null && item.daysToDue < 0;
                      const soon = !item.paid && item.daysToDue !== null && item.daysToDue >= 0 && item.daysToDue <= 3;
                      return (
                        <button key={item.kind + item.id} className={`cycle-item ${item.paid ? 'paid' : ''}`}
                          onClick={() => item.kind === 'debt' ? toggleCycleDebt(item.debt!) : toggleCycleExpense(item.id)}
                          aria-pressed={item.paid} title={item.paid ? 'Desmarcar pago' : 'Marcar como pagado'}>
                          <span className="cycle-check">{item.paid ? <CheckCircle2 size={22} /> : <Circle size={22} />}</span>
                          <span className="cycle-item-main">
                            <span className="cycle-item-name">{item.name}</span>
                            <span className="cycle-item-sub">
                              {item.sub}
                              {item.due && !item.paid && <span className={`cycle-due ${late ? 'late' : soon ? 'soon' : ''}`}>
                                {late ? 'Vencida' : item.daysToDue === 0 ? 'Vence hoy' : `Vence ${cycleFmtDay(item.due)}`}
                              </span>}
                            </span>
                          </span>
                          <span className="cycle-item-amount">{fmt(item.amount)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
            <p className="cycle-footnote">Al marcar una cuota de deuda como pagada se suma a las cuotas pagadas de esa deuda; si te equivocas, desmárcala y se revierte. Los egresos fijos se reinician cada ciclo.</p>
          </div>
        )}

        {/* ══════════════════════════════
            TAB: DASHBOARD
            ══════════════════════════════ */}
        {currentTab === 'dashboard' && (
          <>
            {/* Hero: flujo libre */}
            <div className="card hero">
              <div>
                <div className="hero-label">
                  {freeCashFlow >= 0 ? 'Flujo de caja libre' : 'Déficit mensual'}
                  <span className={`pill ${freeCashFlow >= 0 ? 'pos' : 'neg'}`}>{freeCashFlow >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{savingsRate.toFixed(0)}% de tus ingresos</span>
                </div>
                <div className="hero-value" style={{ color: freeCashFlow >= 0 ? 'var(--text-primary)' : 'var(--red)' }}>{freeCashFlow < 0 && '−'}{fmt(Math.abs(freeCashFlow))}</div>
                <div className="hero-sub">Ingresos − egresos fijos − cuotas del mes</div>
              </div>
              <div>
                <div className="compose-bar">
                  {donutSegments.map((seg, i) => <span key={i} style={{ width: `${(Math.max(0, seg.value) / (Math.max(totalIncomes, totalFixedExpenses + totalDebtQuota, 1))) * 100}%`, background: seg.color }} />)}
                </div>
                <div className="compose-legend">
                  {donutSegments.map((seg, i) => (
                    <div key={i}>
                      <div className="k"><i style={{ background: seg.color }} />{seg.label}</div>
                      <div className="v">{fmt(seg.value)}</div>
                      <div className="p">{totalIncomes > 0 ? ((seg.value / totalIncomes) * 100).toFixed(0) : 0}% del ingreso</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* KPIs */}
            <div className="kpi-grid">
              {[
                { label: 'Ingresos',        value: totalIncomes,       dot: 'var(--green)',  sub: `${incomes.length} fuente${incomes.length !== 1 ? 's' : ''}` },
                { label: 'Egresos fijos',   value: totalFixedExpenses, dot: 'var(--red)',    sub: `${fixedExpenses.length} concepto${fixedExpenses.length !== 1 ? 's' : ''}` },
                { label: 'Deuda restante',  value: totalRemainingDebt, dot: 'var(--orange)', sub: `${activeDebtsDetails.filter(d => !d.isCompleted).length} activa${activeDebtsDetails.filter(d => !d.isCompleted).length !== 1 ? 's' : ''}` },
                { label: 'Ahorrado',        value: totalSaved,         dot: 'var(--blue)',   sub: `${savingsGoals.length} meta${savingsGoals.length !== 1 ? 's' : ''}` },
              ].map((k, i) => (
                <div key={i} className="kpi">
                  <div className="kpi-label"><i style={{ background: k.dot }} />{k.label}</div>
                  <div className="kpi-value">{fmt(k.value)}</div>
                  <div className="kpi-sub">{k.sub}</div>
                </div>
              ))}
            </div>

            {/* ── BILLING SUMMARY (Resumen del Mes por Tarjeta) ── */}
            {billingSummary.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <button
                  onClick={() => setShowBillingSummary(!showBillingSummary)}
                  style={{
                    width: '100%',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: spaceId ? 'space-between' : 'center',
                    cursor: 'pointer',
                    outline: 'none',
                    textAlign: 'left',
                    boxShadow: 'var(--shadow-xs)',
                    transition: 'var(--transition)'
                  }}
                  className="accordion-toggle"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <CardIcon size={18} style={{ color: 'var(--orange)' }} />
                    <div>
                      <span className="section-title" style={{ fontSize: '0.92rem', margin: 0, display: 'block' }}>Resumen del mes — Próximas cuotas</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {showBillingSummary ? 'Haz clic para contraer detalles' : `Total de cuotas de este mes: ${fmt(totalDebtQuota)} (clic para ver detalles)`}
                      </span>
                    </div>
                  </div>
                  {showBillingSummary ? <Eye size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />}
                </button>

                {showBillingSummary && (
                  <div className="billing-summary" style={{ marginTop: 12 }}>
                    {billingSummary.map((group, gi) => {
                      const billing = group.card ? getBillingInfo(group.card.cutoff_day) : null;
                      const daysLeft = billing?.daysUntilPay ?? null;
                      return (
                        <div key={gi} className="billing-card">
                          <div className="billing-card-header">
                            <div className="billing-card-name">
                              {group.card ? <><div className="credit-card-chip" style={{ width: 22, height: 16 }} />{group.card.name}</> : <><Receipt size={14} />Sin tarjeta asignada</>}
                            </div>
                            {billing && (
                              <div className="billing-card-meta">
                                <span className="billing-meta-item"><Scissors size={11} />Corte: <strong>{dateLabel(billing.cutoffDate)}</strong></span>
                                <span className="billing-meta-item"><Calendar size={11} />Pago límite: <strong>{dateLabel(billing.payDeadline)}</strong></span>
                                <span className={`billing-deadline-badge ${daysLeft !== null && daysLeft <= 5 ? 'urgent' : daysLeft !== null && daysLeft > 15 ? 'ok' : ''}`}>
                                  <Clock size={10} />
                                  {daysLeft !== null && daysLeft > 0 ? `${daysLeft} días para pagar` : 'Pago vencido'}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="billing-rows">
                            {group.debts.map((debt, di) => (
                              <div key={di} className="billing-row">
                                <span className="billing-row-name">{debt.name}</span>
                                <span className="billing-row-installment">Cuota #{debt.installments_paid + 1}/{debt.total_installments}</span>
                                <span className="billing-row-amount">{fmt(debt.currentQuota)}</span>
                              </div>
                            ))}
                          </div>

                          <div className="billing-card-footer">
                            <span className="billing-card-total-label">
                              {group.card ? `Total ${group.card.name}` : 'Total sin tarjeta'}
                            </span>
                            <span className="billing-card-total-amount">{fmt(group.total)}</span>
                          </div>
                        </div>
                      );
                    })}

                    {/* Grand total */}
                    <div className="billing-grand-total">
                      <div>
                        <div className="billing-grand-label">Total a pagar este mes</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>Suma de todas las cuotas activas</div>
                      </div>
                      <div className="billing-grand-amount">{fmt(totalDebtQuota)}</div>
                    </div>
                  </div>
                )}
              </div>
            )}


            {/* Dashboard Grid */}
            <div className="dashboard-grid">
              {/* ─── LEFT COLUMN ─── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Ingresos */}
                <div className="card">
                  <div className="section-header">
                    <div><div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Wallet size={16} />Ingresos</div><div className="section-subtitle">Fuentes de ingreso del mes</div></div>
                    <button className="btn btn-primary btn-sm" onClick={() => setShowIncomeModal(true)}><Plus size={14} /> Agregar</button>
                  </div>
                  {incomes.length === 0 ? (
                    <div className="empty-state"><Banknote size={32} style={{ opacity: 0.3 }} /><div className="empty-state-text">Sin ingresos registrados</div></div>
                  ) : (
                    <>
                      <div className="table-wrapper hide-mobile">
                        <table className="data-table">
                          <thead><tr><th>Concepto</th><th>Mes</th><th className="text-right">Valor</th><th></th></tr></thead>
                          <tbody>{incomes.map(inc => (<tr key={inc.id}><td style={{ fontWeight: 600 }}>{inc.name}</td><td style={{ color: 'var(--text-secondary)' }}>{new Date(inc.year, inc.month - 1).toLocaleString('es-ES', { month: 'short', year: 'numeric' })}</td><td className="text-right mono" style={{ color: 'var(--green)', fontWeight: 700 }}>{fmt(inc.amount)}</td><td><button onClick={() => deleteIncome(inc.id)} className="btn btn-danger btn-icon btn-sm"><Trash2 size={13} /></button></td></tr>))}</tbody>
                        </table>
                      </div>
                      <div className="mobile-card-list show-mobile">
                        {incomes.map(inc => (
                          <div key={inc.id} className="mobile-card-item">
                            <div className="mobile-card-row">
                              <span className="mobile-card-title">{inc.name}</span>
                              <span className="mobile-card-value text-green">{fmt(inc.amount)}</span>
                            </div>
                            <div className="mobile-card-row">
                              <span className="mobile-card-sub">{new Date(inc.year, inc.month - 1).toLocaleString('es-ES', { month: 'long', year: 'numeric' })}</span>
                              <button onClick={() => deleteIncome(inc.id)} className="btn btn-danger btn-sm" style={{ padding: '4px 10px', fontSize: '0.72rem' }}><Trash2 size={11} /> Eliminar</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Egresos */}
                <div className="card">
                  <div className="section-header">
                    <div><div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Receipt size={16} />Egresos Fijos</div><div className="section-subtitle">Gastos recurrentes mensuales</div></div>
                    <button className="btn btn-primary btn-sm" onClick={() => setShowExpenseModal(true)}><Plus size={14} /> Agregar</button>
                  </div>
                  {fixedExpenses.length === 0 ? (
                    <div className="empty-state"><Receipt size={32} style={{ opacity: 0.3 }} /><div className="empty-state-text">Sin egresos fijos</div></div>
                  ) : (
                    <>
                      <div className="table-wrapper hide-mobile">
                        <table className="data-table">
                          <thead><tr><th>Concepto</th><th>Categoría</th><th className="text-right">Valor</th><th></th></tr></thead>
                          <tbody>{fixedExpenses.map(exp => (<tr key={exp.id}><td style={{ fontWeight: 600 }}>{exp.name}</td><td><span className="badge badge-gray">{exp.category}</span></td><td className="text-right mono" style={{ color: 'var(--red)', fontWeight: 700 }}>{fmt(exp.amount)}</td><td><button onClick={() => deleteExpense(exp.id)} className="btn btn-danger btn-icon btn-sm"><Trash2 size={13} /></button></td></tr>))}</tbody>
                        </table>
                      </div>
                      <div className="mobile-card-list show-mobile">
                        {fixedExpenses.map(exp => (
                          <div key={exp.id} className="mobile-card-item">
                            <div className="mobile-card-row">
                              <span className="mobile-card-title">{exp.name}</span>
                              <span className="mobile-card-value text-red">{fmt(exp.amount)}</span>
                            </div>
                            <div className="mobile-card-row">
                              <span className="badge badge-gray">{exp.category}</span>
                              <button onClick={() => deleteExpense(exp.id)} className="btn btn-danger btn-sm" style={{ padding: '4px 10px', fontSize: '0.72rem' }}><Trash2 size={11} /> Eliminar</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Deudas */}
                <div className="card">
                  <div className="section-header">
                    <div>
                      <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}><CreditCard size={16} />Deudas y Cuotas</div>
                      <div className="section-subtitle">{activeDebtsDetails.filter(d => !d.isCompleted).length} cuotas activas este mes</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setShowManageDebtsModal(true)}><Edit2 size={13} /> Administrar deudas</button>
                      <button className="btn btn-primary btn-sm" onClick={() => setShowDebtModal(true)}><Plus size={14} /> Agregar</button>
                    </div>
                  </div>
                  {activeDebtsDetails.length === 0 ? (
                    <div className="empty-state"><Sparkles size={32} style={{ opacity: 0.3 }} /><div className="empty-state-text">Sin deudas registradas</div></div>
                  ) : (
                    <>
                      {/* Desktop Summary Table */}
                      <div className="table-wrapper hide-mobile">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Deuda</th>
                              <th>Cuota</th>
                              <th>Tarjeta / Corte</th>
                              <th className="text-right">Valor cuota</th>
                              <th className="text-right">Saldo restante</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeDebtsDetails.map(debt => {
                              const linkedCard = cards.find(c => c.id === debt.card_id);
                              return (
                                <tr key={debt.id} className={debt.isCompleted ? 'paid' : ''} style={{ opacity: debt.isCompleted ? 0.6 : 1 }}>
                                  <td style={{ fontWeight: 600 }}>{debt.name}</td>
                                  <td>{debt.isCompleted ? 'Pagada' : `Cuota #${debt.installments_paid + 1} de ${debt.total_installments}`}</td>
                                  <td>
                                    {linkedCard ? linkedCard.name : 'Manual'} 
                                    {debt.cutoff_day ? ` · Corte día ${debt.cutoff_day}` : ''}
                                  </td>
                                  <td className="text-right mono font-semibold" style={{ color: debt.isCompleted ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                                    {fmt(debt.currentQuota)}
                                  </td>
                                  <td className="text-right mono text-muted">
                                    {fmt(debt.isCompleted ? 0 : debt.remainingBalance)}
                                  </td>
                                  <td className="text-right">
                                    {!debt.isCompleted && (
                                      <button className="btn btn-success btn-sm" style={{ padding: '4px 10px', fontSize: '0.72rem' }} onClick={() => markInstallmentPaid(debt)}>Pagar cuota</button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Summary Cards */}
                      <div className="mobile-card-list show-mobile">
                        {activeDebtsDetails.map(debt => {
                          const linkedCard = cards.find(c => c.id === debt.card_id);
                          return (
                            <div key={debt.id} className="mobile-card-item" style={{ opacity: debt.isCompleted ? 0.6 : 1 }}>
                              <div className="mobile-card-row">
                                <span className="mobile-card-title">{debt.name}</span>
                                <span className="mobile-card-value text-orange">{fmt(debt.currentQuota)}</span>
                              </div>
                              <div className="mobile-card-row">
                                <span className="mobile-card-sub">
                                  {debt.isCompleted ? 'Pagada 🎉' : `Cuota #${debt.installments_paid + 1} de ${debt.total_installments}`}
                                  {linkedCard ? ` · ${linkedCard.name}` : ''}
                                </span>
                                {!debt.isCompleted && (
                                  <button className="btn btn-success btn-sm" style={{ padding: '4px 10px', fontSize: '0.72rem' }} onClick={() => markInstallmentPaid(debt)}>Pagar</button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* ─── RIGHT COLUMN ─── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div className="card">
                  <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 20 }}><PieChart size={16} /> Distribución mensual</div>
                  <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                    <DonutChart segments={donutSegments} size={140} thickness={26} />
                    <div style={{ flex: 1, minWidth: 120, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {donutSegments.map((s, i) => (
                        <div key={i}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 4 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, display: 'inline-block', flexShrink: 0 }} /><span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{s.label}</span></span>
                            <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(s.value)}</span>
                          </div>
                          <HBar value={s.value} max={totalIncomes} color={s.color} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 18 }}><Target size={16} /> Métricas clave</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {[
                      { icon: <ArrowUpRight size={14} />, label: 'Tasa de ahorro', val: `${savingsRate.toFixed(1)}%`, barVal: Math.max(0, savingsRate), barMax: 100, color: savingsRate >= 20 ? 'var(--green)' : savingsRate >= 10 ? 'var(--orange)' : 'var(--red)', showBar: true },
                      { icon: <CreditCard size={14} />, label: 'Cuotas / Ingresos', val: `${debtToIncome.toFixed(1)}%`, barVal: debtToIncome, barMax: 100, color: debtToIncome <= 25 ? 'var(--green)' : debtToIncome <= 40 ? 'var(--orange)' : 'var(--red)', showBar: true },
                    ].map((m, i) => (
                      <div key={i}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.82rem' }}><span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>{m.icon}{m.label}</span><span style={{ fontWeight: 700, color: m.color }}>{m.val}</span></div><HBar value={m.barVal} max={m.barMax} color={m.color} /></div>
                    ))}
                    <div className="section-divider" />
                    {[
                      { icon: <AlertTriangle size={13} />, label: 'Interés total restante', value: fmt(totalInterestRemaining), color: totalInterestRemaining > 0 ? 'var(--orange)' : 'var(--green)' },
                      { icon: <Activity size={13} />,      label: 'Gasto total mes',        value: fmt(totalFixedExpenses + totalDebtQuota), color: 'var(--text-primary)' },
                      { icon: <Sparkles size={13} />,      label: 'Libre de deudas',        value: debtFreeDate || (debts.length === 0 ? 'Ya eres libre' : '—'), color: 'var(--green)' },
                    ].map((m, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                        <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>{m.icon}{m.label}</span>
                        <span style={{ fontWeight: 700, color: m.color, textAlign: 'right', maxWidth: '55%', fontSize: '0.78rem' }}>{m.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {projections.length > 0 && (
                  <div className="card">
                    <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}><BarChart2 size={16} /> Proyección próximos meses</div>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                      {[['var(--green)', 'Ingresos'], ['var(--red)', 'Egresos'], ['var(--orange)', 'Cuotas']].map(([c, l], i) => (
                        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', color: 'var(--text-secondary)' }}><span style={{ width: 8, height: 8, borderRadius: 2, background: c, display: 'inline-block' }} />{l}</span>
                      ))}
                    </div>
                    <BarChart groups={barChartGroups} height={140} />
                  </div>
                )}

                {Object.keys(expenseCategoryTotals).length > 0 && (
                  <div className="card">
                    <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 16 }}><Receipt size={16} /> Egresos por categoría</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                      {Object.entries(expenseCategoryTotals).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                        <div key={cat}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 5 }}><span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{cat}</span><span style={{ fontWeight: 700, color: 'var(--red)' }}>{fmt(amt)}</span></div><HBar value={amt} max={totalFixedExpenses} color={categoryColors[cat] || 'var(--text-muted)'} /></div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ══════════════════════════════
            TAB: PROJECTIONS
            ══════════════════════════════ */}
        {currentTab === 'projections' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="kpi-grid" style={{ marginBottom: 0 }}>
              {[
                { label: 'Meses proyectados', value: String(projections.length), sub: 'Hasta el fin de tus deudas', dot: 'var(--blue)' },
                { label: 'Libre de deudas',   value: debtFreeDate ? debtFreeDate.replace(/^./, c => c.toUpperCase()) : (debts.length === 0 ? 'Ya eres libre' : '—'), sub: 'Última cuota proyectada', dot: 'var(--green)' },
                { label: 'Flujo promedio',    value: fmt(projections.reduce((a, p) => a + p.cashFlow, 0) / (projections.length || 1)), sub: 'Por mes proyectado', dot: 'var(--purple)' },
                { label: 'Interés restante',  value: fmt(totalInterestRemaining), sub: 'Hasta saldar deudas', dot: 'var(--orange)' },
              ].map((k, i) => (
                <div key={i} className="kpi">
                  <div className="kpi-label"><i style={{ background: k.dot }} />{k.label}</div>
                  <div className="kpi-value" style={{ fontSize: '1.1rem' }}>{k.value}</div>
                  <div className="kpi-sub">{k.sub}</div>
                </div>
              ))}
            </div>

            {lineChartData.length > 1 && (
              <div className="card">
                <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 16 }}><Activity size={16} /> Tendencia de flujo de caja libre</div>
                <LineAreaChart data={lineChartData} height={170} />
              </div>
            )}

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '18px 20px 12px' }}>
                <div className="section-title">Detalle mensual</div>
                <div className="section-subtitle">Toca un mes para ver ingresos, egresos y cuotas</div>
              </div>
              <div className="proj-head">
                <span>Mes</span><span>Ingresos</span><span>Egresos</span><span>Cuotas</span><span>Flujo libre</span><span />
              </div>
              {projections.map((proj, i) => {
                const open = expandedMonth === i;
                return (
                  <div key={i} className={`proj-row ${open ? 'open' : ''}`}>
                    <button className="proj-row-main" onClick={() => setExpandedMonth(open ? null : i)} aria-expanded={open}>
                      <span className="proj-month">{proj.label}{proj.isDebtFree && <span className="tag-free">Sin deudas</span>}</span>
                      <span className="proj-num proj-opt">{fmt(proj.incomes)}</span>
                      <span className="proj-num proj-opt">{fmt(proj.fixedExpenses)}</span>
                      <span className="proj-num proj-opt">{fmt(proj.debtsQuota)}</span>
                      <span className={`proj-num flow ${proj.cashFlow < 0 ? 'neg' : ''}`}>{proj.cashFlow < 0 && '−'}{fmt(Math.abs(proj.cashFlow))}</span>
                      <span className="proj-chev"><ChevronRight size={16} /></span>
                    </button>
                    {open && (
                      <div className="proj-detail">
                        <div>
                          <h4>Ingresos · {fmt(proj.incomes)}</h4>
                          {incomes.length === 0 ? <div className="proj-line">Sin ingresos</div> : incomes.map(inc => <div key={inc.id} className="proj-line"><span>{inc.name}</span><b>{fmt(inc.amount)}</b></div>)}
                        </div>
                        <div>
                          <h4>Egresos fijos · {fmt(proj.fixedExpenses)}</h4>
                          {fixedExpenses.length === 0 ? <div className="proj-line">Sin egresos</div> : fixedExpenses.map(exp => <div key={exp.id} className="proj-line"><span>{exp.name}</span><b>{fmt(exp.amount)}</b></div>)}
                        </div>
                        <div>
                          <h4>Cuotas de deuda · {fmt(proj.debtsQuota)}</h4>
                          {proj.debtItems.length === 0 ? <div className="proj-line">Sin cuotas este mes</div> : proj.debtItems.map((debt, idx) => (
                            <div key={idx} className="proj-line">
                              <span>
                                {debt.name} <span style={{ color: 'var(--text-muted)' }}>({debt.currentInstallment}/{debt.totalInstallments})</span>
                                <div className="proj-debt-meta">Abonado {fmt(debt.paidCapital)} · Restante {fmt(debt.remainingBalance)}</div>
                              </span>
                              <b>{fmt(debt.quota)}</b>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══════════════════════════════
            TAB: TARJETAS
            ══════════════════════════════ */}
        {currentTab === 'cards' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="card">
              <div className="section-header">
                <div>
                  <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}><CardIcon size={16} /> Mis Tarjetas de Crédito</div>
                  <div className="section-subtitle">Registra tus tarjetas para calcular automáticamente las fechas de pago</div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => { setEditingCard(null); setCardForm({ name: '', cutoff_day: '' }); setShowCardModal(true); }}><Plus size={14} /> Nueva tarjeta</button>
              </div>

              {cards.length === 0 ? (
                <div className="empty-state" style={{ padding: '48px 0' }}>
                  <CardIcon size={36} style={{ opacity: 0.25 }} />
                  <div className="empty-state-text">No tienes tarjetas registradas</div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: 320, textAlign: 'center', marginTop: 4 }}>Agrega tus tarjetas de crédito para que el sistema calcule automáticamente las fechas de corte y límite de pago</p>
                  <button className="btn btn-primary btn-sm" onClick={() => { setEditingCard(null); setCardForm({ name: '', cutoff_day: '' }); setShowCardModal(true); }}><Plus size={14} /> Agregar primera tarjeta</button>
                </div>
              ) : (
                <div className="cards-grid">
                  {cards.map(card => {
                    const billing = getBillingInfo(card.cutoff_day);
                    const linkedDebts = debts.filter(d => d.card_id === card.id && d.installments_paid < d.total_installments);
                    return (
                      <div key={card.id} className="credit-card-item">
                        <div className="credit-card-header">
                          <div className="credit-card-name">{card.name}</div>
                          <div className="credit-card-chip" />
                        </div>
                        <div className="credit-card-info">
                          <div className="credit-card-info-row"><span className="credit-card-info-label">Día de corte</span><span className="credit-card-info-value">Día {card.cutoff_day}</span></div>
                          <div className="credit-card-info-row"><span className="credit-card-info-label">Límite de pago</span><span className="credit-card-info-value">Día {card.cutoff_day + 15}</span></div>
                          <div className="credit-card-info-row"><span className="credit-card-info-label">Próximo corte</span><span className="credit-card-info-value" style={{ color: 'var(--orange)' }}>{dateLabel(billing.cutoffDate)}</span></div>
                          <div className="credit-card-info-row"><span className="credit-card-info-label">Pagar antes del</span><span className="credit-card-info-value" style={{ color: 'var(--red)' }}>{dateLabel(billing.payDeadline)}</span></div>
                          <div className="credit-card-info-row"><span className="credit-card-info-label">Deudas vinculadas</span><span className="credit-card-info-value">{linkedDebts.length} activa{linkedDebts.length !== 1 ? 's' : ''}</span></div>
                        </div>
                        <div className="credit-card-actions">
                          <button className="btn btn-secondary btn-sm" onClick={() => openEditCard(card)}><Edit2 size={13} /> Editar</button>
                          <button className="btn btn-danger btn-icon btn-sm" onClick={() => deleteCard(card.id)}><Trash2 size={13} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Info box */}
            <div className="card" style={{ padding: '14px 18px', background: 'var(--blue-bg)', border: '1px solid rgba(10,132,255,0.2)' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <Info size={16} style={{ color: 'var(--blue)', flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--blue)', marginBottom: 4 }}>¿Cómo funciona?</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    Al vincular una deuda a una tarjeta, el sistema usa el <strong>día de corte</strong> para calcular cuándo cae cada cuota en tu extracto.
                    El <strong>límite de pago</strong> siempre es 15 días después del corte. El <strong>Resumen del mes</strong> en el Dashboard te muestra cuánto llegarás a deber por tarjeta y cuándo tienes que pagarlo.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════
            TAB: FAMILIA
            ══════════════════════════════ */}
        {currentTab === 'family' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {db.isDemo ? (
              <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
                <Shield size={36} style={{ opacity: 0.3, margin: '0 auto 16px' }} />
                <div className="section-title" style={{ marginBottom: 8 }}>Requiere cuenta activa</div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>El grupo familiar requiere una cuenta en Supabase para sincronizar datos entre miembros.</p>
              </div>
            ) : !family ? (
              /* ── Sin familia ── */
              <div className="card">
                {!showCreateFamily && !showJoinFamily ? (
                  <div className="family-empty">
                    <div className="family-empty-icon"><Users size={28} /></div>
                    <div className="family-empty-title">Sin grupo familiar</div>
                    <div className="family-empty-sub">Crea un grupo para compartir el resumen con tu familia, o únete al grupo de alguien más con un código de invitación.</div>
                    {familyError && <div className="auth-error">{familyError}</div>}
                    <div className="family-empty-actions">
                      <button className="btn btn-primary" onClick={() => setShowCreateFamily(true)}><Users size={15} /> Crear grupo familiar</button>
                      <button className="btn btn-secondary" onClick={() => setShowJoinFamily(true)}><UserPlus size={15} /> Unirse con código</button>
                    </div>
                  </div>
                ) : showCreateFamily ? (
                  <div style={{ maxWidth: 400, margin: '0 auto', padding: '32px 0' }}>
                    <div className="section-title" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}><Users size={18} /> Crear grupo familiar</div>
                    {familyError && <div className="auth-error">{familyError}</div>}
                    <form onSubmit={handleCreateFamily}>
                      <div className="form-group"><label>Nombre del grupo</label><input type="text" className="form-control" placeholder="Ej. Familia García" value={familyName} onChange={e => setFamilyName(e.target.value)} required /></div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button type="button" className="btn btn-secondary" onClick={() => { setShowCreateFamily(false); setFamilyError(''); }}>Cancelar</button>
                        <button type="submit" className="btn btn-primary" disabled={familyLoading}>{familyLoading ? <RefreshCw size={14} className="spin" /> : 'Crear grupo'}</button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <div style={{ maxWidth: 400, margin: '0 auto', padding: '32px 0' }}>
                    <div className="section-title" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}><UserPlus size={18} /> Unirse con código</div>
                    {familyError && <div className="auth-error">{familyError}</div>}
                    <form onSubmit={handleJoinFamily}>
                      <div className="form-group">
                        <label>Código de invitación (6 caracteres)</label>
                        <input type="text" className="form-control" placeholder="Ej. XK92AB" value={inviteInput} onChange={e => setInviteInput(e.target.value.toUpperCase())} maxLength={6} style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.2em', fontSize: '1.2rem', textAlign: 'center' }} required />
                      </div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button type="button" className="btn btn-secondary" onClick={() => { setShowJoinFamily(false); setFamilyError(''); }}>Cancelar</button>
                        <button type="submit" className="btn btn-primary" disabled={familyLoading}>{familyLoading ? <RefreshCw size={14} className="spin" /> : 'Unirse'}</button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            ) : (
              /* ── Con familia ── */
              <>
                {/* Family header */}
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Users size={18} />{family.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>{familyMembers.length} miembro{familyMembers.length !== 1 ? 's' : ''} · Vista de solo lectura</div>
                    </div>
                    <button className="btn btn-danger btn-sm" onClick={handleLeaveFamily}><LogOut size={14} /> Salir del grupo</button>
                  </div>

                  <div style={{ marginTop: 20 }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Código de invitación</div>
                    <div className="invite-code-box">
                      <Hash size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      <div className="invite-code-text">{family.invite_code}</div>
                      <button className="btn btn-secondary btn-sm" onClick={() => copyCode(family.invite_code)} style={{ flexShrink: 0 }}>
                        {copied ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar</>}
                      </button>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>Comparte este código para que otros miembros puedan unirse</div>
                  </div>
                </div>

                {/* Members */}
                <div className="card">
                  <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 20 }}><Users size={16} /> Miembros del grupo</div>
                  <div className="family-members-grid">
                    {memberSummaries.map((ms, i) => {
                      const isMe = ms.member.space_id === spaceId;
                      const initials = ms.member.email.substring(0, 2).toUpperCase();
                      return (
                        <div key={i} className="family-member-card">
                          <div className="family-member-avatar">{initials}</div>
                          <div className="family-member-info">
                            <div className="family-member-email">
                              {ms.member.email.replace(/(.{2}).+(@.+)/, '$1****$2')}
                              {isMe && <span className="is-me-badge">Tú</span>}
                            </div>
                            <div className="family-member-tag">Miembro del grupo</div>
                          </div>
                          {ms.loading ? (
                            <RefreshCw size={16} className="spin" style={{ color: 'var(--text-muted)' }} />
                          ) : (
                            <div className="family-member-stats">
                              <div className="family-stat">
                                <div className="family-stat-label">Ingresos</div>
                                <div className="family-stat-value" style={{ color: 'var(--green)' }}>{fmt(ms.totalIncome)}</div>
                              </div>
                              <div className="family-stat">
                                <div className="family-stat-label">Egresos</div>
                                <div className="family-stat-value" style={{ color: 'var(--red)' }}>{fmt(ms.totalExpenses + ms.totalDebtQuota)}</div>
                              </div>
                              <div className="family-stat">
                                <div className="family-stat-label">Libre</div>
                                <div className="family-stat-value" style={{ color: ms.freeCashFlow >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(ms.freeCashFlow)}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Family totals */}
                  {memberSummaries.every(m => !m.loading) && (
                    <div className="family-total-row" style={{ marginTop: 16 }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Landmark size={16} /> Total familiar
                      </div>
                      <div style={{ display: 'flex', gap: 24 }}>
                        {[
                          { l: 'Ingresos', v: memberSummaries.reduce((a, m) => a + m.totalIncome, 0), c: 'var(--green)' },
                          { l: 'Egresos', v: memberSummaries.reduce((a, m) => a + m.totalExpenses + m.totalDebtQuota, 0), c: 'var(--red)' },
                          { l: 'Flujo libre', v: memberSummaries.reduce((a, m) => a + m.freeCashFlow, 0), c: memberSummaries.reduce((a, m) => a + m.freeCashFlow, 0) >= 0 ? 'var(--green)' : 'var(--red)' },
                        ].map((t, i) => (
                          <div key={i} className="family-stat">
                            <div className="family-stat-label">{t.l}</div>
                            <div className="family-stat-value" style={{ color: t.c }}>{fmt(t.v)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════
            TAB: SAVINGS (METAS)
            ══════════════════════════════ */}
        {currentTab === 'savings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="section-header">
              <div>
                <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Target size={18} /> Metas de Ahorro</div>
                <div className="section-subtitle">Define tus objetivos y haz seguimiento a tus ahorros</div>
              </div>
              <button className="btn btn-primary" onClick={() => { setEditingGoal(null); setSavingsForm(blankSavings); setShowSavingsModal(true); }}><Plus size={15} /> Nueva meta</button>
            </div>

            {/* General progress banner */}
            {savingsGoals.length > 0 && (
              <div className="card" style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Ahorro general de tus metas</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>{fmt(totalSaved)}</span>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>de {fmt(totalSavedTarget)}</span>
                  </div>
                  <div className="progress-bar" style={{ height: 8 }}>
                    <div className="progress-fill" style={{ width: `${Math.min(100, (totalSaved / (totalSavedTarget || 1)) * 100)}%`, background: 'var(--green)' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    <span>Progreso total</span>
                    <span>{Math.round((totalSaved / (totalSavedTarget || 1)) * 100)}%</span>
                  </div>
                </div>
                <DonutChart
                  segments={[
                    { label: 'Ahorrado', value: totalSaved, color: 'var(--green)' },
                    { label: 'Pendiente', value: Math.max(0, totalSavedTarget - totalSaved), color: 'var(--border-strong)' }
                  ]}
                  size={100}
                  thickness={14}
                />
              </div>
            )}

            {savingsGoals.length === 0 ? (
              <div className="empty-state" style={{ padding: '64px 20px' }}>
                <Target size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
                <div className="empty-state-text">No tienes metas de ahorro registradas</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 20 }}>Empieza creando tu primer objetivo financiero.</div>
                <button className="btn btn-primary btn-sm" onClick={() => { setEditingGoal(null); setSavingsForm(blankSavings); setShowSavingsModal(true); }}><Plus size={14} /> Crear meta</button>
              </div>
            ) : (
              <div className="goals-grid">
                {savingsGoals.map(goal => {
                  const pct = Math.min(100, Math.round((goal.current_amount / (goal.target_amount || 1)) * 100));
                  const isCompleted = goal.current_amount >= goal.target_amount;
                  return (
                    <div key={goal.id} className="goal-card">
                      <div className="goal-card-header">
                        <div className="goal-card-info">
                          <span className="goal-card-title">{goal.name}</span>
                          <span className="goal-card-category">
                            <Sparkles size={11} /> {goal.category || 'Ahorro'}
                          </span>
                        </div>
                        <div className="goal-actions">
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEditGoal(goal)} title="Editar"><Edit2 size={13} /></button>
                          <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--red)' }} onClick={() => deleteSavingsGoal(goal.id)} title="Eliminar"><Trash2 size={13} /></button>
                        </div>
                      </div>

                      <div className="goal-progress-section">
                        <div className="goal-amounts">
                          <div>
                            <span className="goal-amount-saved">{fmt(goal.current_amount)}</span>
                            <span className="goal-amount-target"> / {fmt(goal.target_amount)}</span>
                          </div>
                          <span className={`goal-pct-badge ${isCompleted ? 'badge-green' : 'badge-blue'}`}>{pct}%</span>
                        </div>
                        <div className="progress-bar" style={{ height: 6 }}>
                          <div className="progress-fill" style={{ width: `${pct}%`, background: isCompleted ? 'var(--green)' : 'var(--blue)' }} />
                        </div>
                      </div>

                      {goal.deadline && (
                        <div className="goal-deadline">
                          <Calendar size={12} />
                          <span>Fecha límite: {dateLabel(new Date(goal.deadline + 'T00:00:00'))}</span>
                        </div>
                      )}

                      <div className="goal-quick-funds">
                        <span className="goal-quick-label">Ahorrar rápido:</span>
                        <button className="goal-quick-btn" onClick={() => { db.savingsGoals.addFunds(goal.id, 50000); fetchAll(spaceId, user?.id); }}>+$50k</button>
                        <button className="goal-quick-btn" onClick={() => { db.savingsGoals.addFunds(goal.id, 100000); fetchAll(spaceId, user?.id); }}>+$100k</button>
                        <button className="goal-quick-btn" onClick={() => { db.savingsGoals.addFunds(goal.id, 500000); fetchAll(spaceId, user?.id); }}>+$500k</button>
                        <button className="goal-quick-btn" style={{ background: 'var(--blue-bg)', color: 'var(--blue)' }} onClick={() => setShowAddFundsModal(goal)}>Otro</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ════════════════════════════════════
          MODALS
          ════════════════════════════════════ */}

      {/* Income Modal */}
      {showIncomeModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowIncomeModal(false); }}>
          <div className="modal-content">
            <div className="modal-header"><div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Wallet size={18} /> Agregar ingreso</div><button className="btn btn-ghost btn-icon" onClick={() => setShowIncomeModal(false)}><X size={16} /></button></div>
            <form onSubmit={addIncome}>
              <div className="form-group"><label>Nombre / Fuente</label><input type="text" className="form-control" placeholder="Ej. Salario, Freelance" value={incomeForm.name} onChange={e => setIncomeForm({ ...incomeForm, name: e.target.value })} required /></div>
              <div className="form-group"><label>Valor ($)</label><input type="number" className="form-control" placeholder="Ej. 3500000" value={incomeForm.amount} onChange={e => setIncomeForm({ ...incomeForm, amount: e.target.value })} required /></div>
              <div className="form-row">
                <div className="form-group"><label>Mes</label><select className="form-control" value={incomeForm.month} onChange={e => setIncomeForm({ ...incomeForm, month: parseInt(e.target.value) })}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString('es-ES', { month: 'long' })}</option>)}</select></div>
                <div className="form-group"><label>Año</label><input type="number" className="form-control" value={incomeForm.year} onChange={e => setIncomeForm({ ...incomeForm, year: parseInt(e.target.value) })} required /></div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setShowIncomeModal(false)}>Cancelar</button><button type="submit" className="btn btn-primary">Agregar</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {showExpenseModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowExpenseModal(false); }}>
          <div className="modal-content">
            <div className="modal-header"><div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Receipt size={18} /> Agregar egreso fijo</div><button className="btn btn-ghost btn-icon" onClick={() => setShowExpenseModal(false)}><X size={16} /></button></div>
            <form onSubmit={addExpense}>
              <div className="form-group"><label>Concepto</label><input type="text" className="form-control" placeholder="Ej. Arriendo, Servicios" value={expenseForm.name} onChange={e => setExpenseForm({ ...expenseForm, name: e.target.value })} required /></div>
              <div className="form-group"><label>Valor ($)</label><input type="number" className="form-control" placeholder="Ej. 800000" value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })} required /></div>
              <div className="form-group"><label>Categoría</label><select className="form-control" value={expenseForm.category} onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })}>{['Vivienda', 'Servicios', 'Alimentación', 'Transporte', 'Suscripciones', 'Salud', 'Educación', 'Otros'].map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setShowExpenseModal(false)}>Cancelar</button><button type="submit" className="btn btn-primary">Agregar</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Card Modal */}
      {showCardModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setShowCardModal(false); setEditingCard(null); } }}>
          <div className="modal-content">
            <div className="modal-header"><div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><CardIcon size={18} /> {editingCard ? 'Editar tarjeta' : 'Nueva tarjeta'}</div><button className="btn btn-ghost btn-icon" onClick={() => { setShowCardModal(false); setEditingCard(null); }}><X size={16} /></button></div>
            <form onSubmit={addCard}>
              <div className="form-group"><label>Nombre de la tarjeta</label><input type="text" className="form-control" placeholder="Ej. Visa Bancolombia, MC Davivienda" value={cardForm.name} onChange={e => setCardForm({ ...cardForm, name: e.target.value })} required /></div>
              <div className="form-group">
                <label>Día de corte</label>
                <input type="number" min="1" max="31" className="form-control" placeholder="Ej. 25" value={cardForm.cutoff_day} onChange={e => setCardForm({ ...cardForm, cutoff_day: e.target.value })} required />
                <div className="form-hint">El límite de pago se calculará automáticamente como corte + 15 días{cardForm.cutoff_day ? ` = día ${parseInt(cardForm.cutoff_day) + 15}` : ''}</div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => { setShowCardModal(false); setEditingCard(null); }}>Cancelar</button><button type="submit" className="btn btn-primary">{editingCard ? 'Guardar' : 'Agregar tarjeta'}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Debt Modal */}
      {showDebtModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowDebtModal(false); }}>
          <div className="modal-content">
            <div className="modal-header"><div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><CreditCard size={18} /> Agregar deuda</div><button className="btn btn-ghost btn-icon" onClick={() => setShowDebtModal(false)}><X size={16} /></button></div>
            <form onSubmit={addDebt}><DebtFormFields form={debtForm} setForm={setDebtForm} cards={cards} /><div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setShowDebtModal(false)}>Cancelar</button><button type="submit" className="btn btn-primary">Agregar deuda</button></div></form>
          </div>
        </div>
      )}

      {/* Edit Debt Modal */}
      {editingDebt && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setEditingDebt(null); }}>
          <div className="modal-content">
            <div className="modal-header"><div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Edit2 size={17} /> {editingDebt.name}</div><button className="btn btn-ghost btn-icon" onClick={() => setEditingDebt(null)}><X size={16} /></button></div>
            <form onSubmit={saveEditDebt}><DebtFormFields form={editDebtForm} setForm={setEditDebtForm} cards={cards} /><div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setEditingDebt(null)}>Cancelar</button><button type="submit" className="btn btn-primary">Guardar cambios</button></div></form>
          </div>
        </div>
      )}

      {/* Amortization Modal */}
      {amortDebt && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setAmortDebt(null); }}>
          <div className="modal-content modal-wide">
            <div className="modal-header">
              <div><div className="modal-title">{amortDebt.name}</div><div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>{fmt(amortDebt.total_capital)} · {amortDebt.total_installments} cuotas · {amortDebt.has_interest ? `${amortDebt.monthly_interest_rate}% mensual` : 'Sin interés'}</div></div>
              <button className="btn btn-ghost btn-icon" onClick={() => setAmortDebt(null)}><X size={16} /></button>
            </div>
            <div className="hide-mobile" style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
              <table className="amort-table">
                <thead><tr><th>#</th><th>Capital</th><th>Interés</th><th>Cuota total</th><th>Saldo</th><th>Estado</th></tr></thead>
                <tbody>
                  {buildAmortTable(amortDebt).map(row => (
                    <tr key={row.num} className={row.paid ? 'paid' : row.isNext ? 'next-due' : ''}>
                      <td style={{ textAlign: 'left', fontWeight: row.isNext ? 700 : 400 }}>#{row.num}</td>
                      <td>{fmt(row.capital)}</td><td>{fmt(row.interest)}</td><td style={{ fontWeight: 700 }}>{fmt(row.quota)}</td><td>{fmt(row.remaining)}</td>
                      <td style={{ textAlign: 'left' }}>
                        {row.paid ? <span className="badge badge-green"><CheckCircle2 size={10} style={{ display: 'inline', marginRight: 3 }} />Pagada</span> : row.isNext ? <span className="badge badge-orange"><Clock size={10} style={{ display: 'inline', marginRight: 3 }} />Próxima</span> : <span className="badge badge-gray">Pendiente</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="show-mobile" style={{ maxHeight: '55vh', overflowY: 'auto', paddingRight: 4 }}>
              <div className="mobile-card-list">
                {buildAmortTable(amortDebt).map(row => (
                  <div key={row.num} className="mobile-card-item" style={{ borderLeft: row.isNext ? '4px solid var(--orange)' : '1px solid var(--border)', background: row.isNext ? 'var(--orange-bg)' : 'var(--surface)' }}>
                    <div className="mobile-card-row">
                      <span className="mobile-card-title">Cuota #{row.num}</span>
                      <span className="mobile-card-value">{fmt(row.quota)}</span>
                    </div>
                    <div className="mobile-card-row" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      <span>Capital: {fmt(row.capital)} · Interés: {fmt(row.interest)}</span>
                      {row.paid ? (
                        <span className="badge badge-green" style={{ fontSize: '0.62rem', padding: '1px 5px' }}>Pagada</span>
                      ) : row.isNext ? (
                        <span className="badge badge-orange" style={{ fontSize: '0.62rem', padding: '1px 5px' }}>Próxima</span>
                      ) : (
                        <span className="badge badge-gray" style={{ fontSize: '0.62rem', padding: '1px 5px' }}>Pendiente</span>
                      )}
                    </div>
                    <div className="mobile-card-row" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      <span>Saldo restante: {fmt(row.remaining)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer"><button className="btn btn-primary" onClick={() => setAmortDebt(null)}>Cerrar</button></div>
          </div>
        </div>
      )}

      {/* Manage Debts Modal */}
      {showManageDebtsModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowManageDebtsModal(false); }}>
          <div className="modal-content modal-wide" style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CreditCard size={18} />
                Gestión de Deudas
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="btn btn-primary btn-sm" onClick={() => { setShowDebtModal(true); }}><Plus size={14} /> Nueva deuda</button>
                <button className="btn btn-ghost btn-icon" onClick={() => setShowManageDebtsModal(false)}><X size={16} /></button>
              </div>
            </div>
            
            <div style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: 4, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {activeDebtsDetails.length === 0 ? (
                <div className="empty-state"><Sparkles size={32} style={{ opacity: 0.3 }} /><div className="empty-state-text">Sin deudas registradas</div></div>
              ) : (
                <div className="debt-list" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {activeDebtsDetails.map(debt => {
                    const pct = Math.round((debt.installments_paid / debt.total_installments) * 100);
                    const remaining = debt.total_installments - debt.installments_paid;
                    const linkedCard = cards.find(c => c.id === debt.card_id);
                    return (
                      <div key={debt.id} className={`debt-card ${debt.isCompleted ? 'completed' : ''}`}>
                        <div className="debt-card-header">
                          <div>
                            <div className="debt-name">{debt.name}</div>
                            <div className="debt-billing-tags" style={{ padding: '6px 0 0' }}>
                              {linkedCard && <span className="billing-tag"><div className="credit-card-chip" style={{ width: 14, height: 10, display: 'inline-block', verticalAlign: 'middle', marginRight: 4 }} />{linkedCard.name}</span>}
                              {(debt.cutoff_day || linkedCard) && <span className="billing-tag"><Scissors size={10} /> Corte: día {linkedCard ? linkedCard.cutoff_day : debt.cutoff_day}</span>}
                              {(debt.payment_day || linkedCard) && <span className="billing-tag"><Calendar size={10} /> Pago: día {linkedCard ? linkedCard.cutoff_day + 15 : debt.payment_day}</span>}
                            </div>
                          </div>
                          <span className={`debt-status ${debt.isCompleted ? 'done' : 'active'}`}>
                            {debt.isCompleted ? <><CheckCircle2 size={11} style={{ display: 'inline', marginRight: 3 }} />Pagada</> : <><Clock size={11} style={{ display: 'inline', marginRight: 3 }} />{remaining} cuota{remaining !== 1 ? 's' : ''}</>}
                          </span>
                        </div>
                        <div className="debt-card-body">
                          <div className="debt-stat"><div className="debt-stat-label">Capital total</div><div className="debt-stat-value">{fmt(debt.total_capital)}</div></div>
                          <div className="debt-stat"><div className="debt-stat-label">Saldo pendiente</div><div className={`debt-stat-value ${debt.isCompleted ? '' : 'orange'}`}>{fmt(debt.isCompleted ? 0 : debt.remainingBalance + debt.fixed_capital_payment)}</div></div>
                          <div className="debt-stat"><div className="debt-stat-label">Interés</div><div className="debt-stat-value">{debt.has_interest ? `${debt.monthly_interest_rate}% / mes` : 'Sin interés'}</div></div>
                        </div>
                        <div style={{ margin: '4px 20px 0' }}>
                          <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%`, background: debt.isCompleted ? 'var(--green)' : 'var(--orange)' }} /></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.7rem', color: 'var(--text-muted)' }}><span>{debt.installments_paid} / {debt.total_installments} pagadas</span><span>{pct}%</span></div>
                        </div>
                        {!debt.isCompleted && (
                          <div className="debt-next-quota">
                            <div className="debt-next-quota-label">Cuota <strong>#{debt.installments_paid + 1}</strong> · Capital <strong>{fmt(debt.fixed_capital_payment)}</strong>{debt.has_interest && <> + Interés <strong>{fmt(debt.currentInterest)}</strong></>}</div>
                            <div className="debt-next-quota-amount">{fmt(debt.currentQuota)}</div>
                          </div>
                        )}
                        <div className="debt-card-actions">
                          {!debt.isCompleted && <button className="btn btn-success btn-sm" onClick={() => markInstallmentPaid(debt)}><CheckCircle2 size={14} /> Cuota #{debt.installments_paid + 1} pagada</button>}
                          <button className="btn btn-secondary btn-sm" onClick={() => setAmortDebt(debt)}><Eye size={13} /> Ver tabla</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => openEditDebt(debt)}><Edit2 size={13} /> Editar</button>
                          <button className="btn btn-danger btn-icon btn-sm" onClick={() => deleteDebt(debt.id)}><Trash2 size={13} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setShowManageDebtsModal(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Savings Goal Modal */}
      {showSavingsModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setShowSavingsModal(false); setEditingGoal(null); } }}>
          <div className="modal-content">
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Target size={18} />
                {editingGoal ? 'Editar meta de ahorro' : 'Nueva meta de ahorro'}
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => { setShowSavingsModal(false); setEditingGoal(null); }}><X size={16} /></button>
            </div>
            <form onSubmit={addSavingsGoal}>
              <div className="form-group">
                <label>Nombre de la meta</label>
                <input type="text" className="form-control" placeholder="Ej. Fondo de Emergencia, Vacaciones 2027" value={savingsForm.name} onChange={e => setSavingsForm({ ...savingsForm, name: e.target.value })} required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Monto objetivo ($)</label>
                  <input type="number" className="form-control" placeholder="Ej. 5000000" value={savingsForm.target_amount} onChange={e => setSavingsForm({ ...savingsForm, target_amount: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Monto ahorrado inicial ($)</label>
                  <input type="number" className="form-control" placeholder="Ej. 100000" value={savingsForm.current_amount} onChange={e => setSavingsForm({ ...savingsForm, current_amount: e.target.value })} required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Fecha límite (opcional)</label>
                  <input type="date" className="form-control" value={savingsForm.deadline} onChange={e => setSavingsForm({ ...savingsForm, deadline: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Categoría</label>
                  <select className="form-control" value={savingsForm.category} onChange={e => setSavingsForm({ ...savingsForm, category: e.target.value })}>
                    {['Fondo', 'Viajes', 'Tecnología', 'Vehículo', 'Estudio', 'Hogar', 'Salud', 'Otro'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowSavingsModal(false); setEditingGoal(null); }}>Cancelar</button>
                <button type="submit" className="btn btn-primary">{editingGoal ? 'Guardar cambios' : 'Crear meta'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Funds Modal */}
      {showAddFundsModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowAddFundsModal(null); }}>
          <div className="modal-content">
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Plus size={18} />
                Ahorrar en: {showAddFundsModal.name}
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowAddFundsModal(null)}><X size={16} /></button>
            </div>
            <form onSubmit={addSavingsFunds}>
              <div className="form-group">
                <label>Monto a ahorrar ($)</label>
                <input type="number" className="form-control" placeholder="Ej. 150000" value={addFundsAmount} onChange={e => setAddFundsAmount(e.target.value)} required autoFocus />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddFundsModal(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Ahorrar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
