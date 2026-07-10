'use client';

import { useState, useEffect, useMemo } from 'react';
import { db, Income, FixedExpense, Debt } from '@/lib/db';
import {
  Wallet,
  Receipt,
  CreditCard,
  Landmark,
  TrendingUp,
  TrendingDown,
  Trash2,
  Plus,
  LogOut,
  RefreshCw,
  Sun,
  Moon,
  CheckCircle2,
  Eye,
  Edit2,
  X,
  Scissors,
  Calendar,
  Banknote,
  Clock,
  Sparkles,
  PieChart,
  BarChart2,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Target,
} from 'lucide-react';

/* ── helpers ────────────────────────────────────────────── */
const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CO');
const monthShort = (d: Date) => d.toLocaleString('es-ES', { month: 'short' });
const monthLong  = (d: Date) => d.toLocaleString('es-ES', { month: 'long', year: 'numeric' });

/* ── SVG: Donut Chart ───────────────────────────────────── */
function DonutChart({ segments, size = 160, thickness = 26 }: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
}) {
  const total = segments.reduce((a, c) => a + c.value, 0);
  if (total === 0) return <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--surface-inset)', flexShrink: 0 }} />;
  const r   = (size - thickness) / 2;
  const cx  = size / 2;
  const cy  = size / 2;
  const C   = 2 * Math.PI * r;
  let cum = 0;

  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface-inset)" strokeWidth={thickness} />
      {segments.filter(s => s.value > 0).map((seg, i) => {
        const dash   = (seg.value / total) * C;
        const offset = -(cum / total) * C;
        cum += seg.value;
        return (
          <circle key={i} cx={cx} cy={cy} r={r}
            fill="none" stroke={seg.color} strokeWidth={thickness - 3}
            strokeDasharray={`${dash} ${C - dash}`}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        );
      })}
    </svg>
  );
}

/* ── SVG: Bar Chart (grouped vertical) ─────────────────── */
function BarChart({ groups, height = 160 }: {
  groups: { label: string; bars: { value: number; color: string }[] }[];
  height?: number;
}) {
  const maxVal = Math.max(...groups.flatMap(g => g.bars.map(b => b.value)), 1);
  const barW   = 16;
  const gap    = 6;
  const groupW = groups[0]?.bars.length * (barW + gap) - gap + 10;
  const totalW = groups.length * (groupW + 14) + 10;

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
      <svg width={totalW} height={height + 28}>
        {groups.map((group, gi) => {
          const groupX = 5 + gi * (groupW + 14);
          return (
            <g key={gi}>
              {group.bars.map((bar, bi) => {
                const bh  = Math.max((bar.value / maxVal) * height, bar.value > 0 ? 3 : 0);
                const bx  = groupX + bi * (barW + gap);
                const by  = height - bh;
                return (
                  <rect key={bi} x={bx} y={by} width={barW} height={bh}
                    fill={bar.color} rx={4} />
                );
              })}
              <text x={groupX + groupW / 2 - 8} y={height + 18}
                textAnchor="middle" fontSize={9} fill="var(--text-muted)">
                {group.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ── SVG: Line / Area Chart ─────────────────────────────── */
function LineAreaChart({ data, height = 160 }: {
  data: { label: string; value: number }[];
  height?: number;
}) {
  if (data.length < 2) return null;
  const padL  = 56;
  const padR  = 16;
  const padT  = 14;
  const padB  = 26;
  const W     = Math.max(data.length * 52 + padL + padR, 400);
  const vals  = data.map(d => d.value);
  const minV  = Math.min(...vals);
  const maxV  = Math.max(...vals);
  const range = maxV - minV || 1;

  const getX = (i: number) => padL + (i / (data.length - 1)) * (W - padL - padR);
  const getY = (v: number) => padT + ((maxV - v) / range) * (height - padT - padB);
  const zero  = getY(0);

  const linePts = data.map((d, i) => `${getX(i)},${getY(d.value)}`).join(' ');
  const areaPts = [
    `${getX(0)},${Math.min(zero, height - padB)}`,
    ...data.map((d, i) => `${getX(i)},${getY(d.value)}`),
    `${getX(data.length - 1)},${Math.min(zero, height - padB)}`,
  ].join(' ');

  // Y axis labels
  const yLabels = [maxV, (maxV + minV) / 2, minV].map(v => ({
    v, y: getY(v), label: fmt(v).replace('$', '$').replace('.000.000', 'M').replace('.000', 'k'),
  }));

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={W} height={height} style={{ display: 'block' }}>
        <defs>
          <linearGradient id="areaGradPos" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--green)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--green)" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="areaGradNeg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--red)" stopOpacity={0.02} />
            <stop offset="100%" stopColor="var(--red)" stopOpacity={0.18} />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yLabels.map((yl, i) => (
          <line key={i} x1={padL} y1={yl.y} x2={W - padR} y2={yl.y}
            stroke="var(--border)" strokeWidth={1} strokeDasharray="4 4" />
        ))}

        {/* Zero line */}
        {minV < 0 && maxV > 0 && (
          <line x1={padL} y1={zero} x2={W - padR} y2={zero}
            stroke="var(--border-strong)" strokeWidth={1} />
        )}

        {/* Area */}
        <polygon points={areaPts} fill={minV >= 0 ? 'url(#areaGradPos)' : 'url(#areaGradNeg)'} />

        {/* Line */}
        <polyline points={linePts} fill="none"
          stroke={minV >= 0 ? 'var(--green)' : 'var(--blue)'}
          strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

        {/* Dots */}
        {data.map((d, i) => (
          <circle key={i} cx={getX(i)} cy={getY(d.value)} r={3.5}
            fill={d.value >= 0 ? 'var(--green)' : 'var(--red)'}
            stroke="var(--surface)" strokeWidth={2} />
        ))}

        {/* X labels (every 2nd) */}
        {data.map((d, i) => i % 2 === 0 && (
          <text key={i} x={getX(i)} y={height - 6}
            textAnchor="middle" fontSize={8.5} fill="var(--text-muted)">
            {d.label}
          </text>
        ))}

        {/* Y labels */}
        {yLabels.map((yl, i) => (
          <text key={i} x={padL - 6} y={yl.y + 4}
            textAnchor="end" fontSize={8} fill="var(--text-muted)">
            {yl.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

/* ── Horizontal Progress Bar ─────────────────────────────── */
function HBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, Math.max(0, (value / (max || 1)) * 100));
  return (
    <div className="progress-bar" style={{ height: 6 }}>
      <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */
export default function Home() {
  /* auth */
  const [user, setUser]         = useState<any>(null);
  const [spaceId, setSpaceId]   = useState('');
  const [isLogin, setIsLogin]   = useState(true);
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError]     = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  /* app */
  const [loading, setLoading]         = useState(true);
  const [currentTab, setCurrentTab]   = useState<'dashboard' | 'projections'>('dashboard');
  const [theme, setTheme]             = useState<'dark' | 'light'>('dark');

  /* data */
  const [incomes, setIncomes]               = useState<Income[]>([]);
  const [fixedExpenses, setFixedExpenses]   = useState<FixedExpense[]>([]);
  const [debts, setDebts]                   = useState<Debt[]>([]);

  /* modals */
  const [showIncomeModal,  setShowIncomeModal]  = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showDebtModal,    setShowDebtModal]    = useState(false);
  const [amortDebt,    setAmortDebt]    = useState<Debt | null>(null);
  const [editingDebt,  setEditingDebt]  = useState<Debt | null>(null);

  /* forms */
  const [incomeForm,  setIncomeForm]  = useState({ name: '', amount: '', month: new Date().getMonth() + 1, year: new Date().getFullYear() });
  const [expenseForm, setExpenseForm] = useState({ name: '', amount: '', category: 'Vivienda' });

  const blankDebt = { name: '', total_capital: '', monthly_interest_rate: '0', total_installments: '12', installments_paid: '0', has_interest: false, start_date: new Date().toISOString().split('T')[0], cutoff_day: '', payment_day: '' };
  const [debtForm,     setDebtForm]     = useState(blankDebt);
  const [editDebtForm, setEditDebtForm] = useState(blankDebt);

  /* ── theme ─────────────────────────────────────────────── */
  useEffect(() => {
    const s = typeof window !== 'undefined' && localStorage.getItem('fp-theme');
    if (s === 'light' || s === 'dark') setTheme(s);
  }, []);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (typeof window !== 'undefined') localStorage.setItem('fp-theme', theme);
  }, [theme]);

  /* ── session ────────────────────────────────────────────── */
  useEffect(() => { checkSession(); }, []);

  const checkSession = async () => {
    try {
      const u = await db.auth.getCurrentUser();
      if (u) { setUser(u); setSpaceId(u.space_id || ''); fetchData(u.space_id || ''); }
      else setLoading(false);
    } catch { setLoading(false); }
  };

  const fetchData = async (sId: string) => {
    setLoading(true);
    try {
      const [inc, exp, dbt] = await Promise.all([db.incomes.list(sId), db.fixedExpenses.list(sId), db.debts.list(sId)]);
      setIncomes(inc); setFixedExpenses(exp); setDebts(dbt);
    } finally { setLoading(false); }
  };

  /* ── auth ───────────────────────────────────────────────── */
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault(); setAuthError(''); setAuthLoading(true);
    try {
      const u = isLogin ? await db.auth.signIn(email, password) : await db.auth.signUp(email, password);
      setUser(u); setSpaceId(u.space_id || ''); fetchData(u.space_id || '');
    } catch (err: any) { setAuthError(err.message || 'Error de autenticación'); }
    finally { setAuthLoading(false); }
  };

  const handleSignOut = async () => {
    await db.auth.signOut();
    setUser(null); setSpaceId(''); setIncomes([]); setFixedExpenses([]); setDebts([]);
  };

  /* ── CRUD helpers ───────────────────────────────────────── */
  const addIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    await db.incomes.create({ space_id: spaceId, name: incomeForm.name, amount: parseFloat(incomeForm.amount), month: incomeForm.month, year: incomeForm.year });
    setShowIncomeModal(false); setIncomeForm({ name: '', amount: '', month: new Date().getMonth() + 1, year: new Date().getFullYear() }); fetchData(spaceId);
  };

  const addExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    await db.fixedExpenses.create({ space_id: spaceId, name: expenseForm.name, amount: parseFloat(expenseForm.amount), category: expenseForm.category });
    setShowExpenseModal(false); setExpenseForm({ name: '', amount: '', category: 'Vivienda' }); fetchData(spaceId);
  };

  const addDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    const capital = parseFloat(debtForm.total_capital);
    const installments = parseInt(debtForm.total_installments);
    try {
      await db.debts.create({ space_id: spaceId, name: debtForm.name, total_capital: capital, monthly_interest_rate: debtForm.has_interest ? parseFloat(debtForm.monthly_interest_rate) : 0, total_installments: installments, installments_paid: parseInt(debtForm.installments_paid), fixed_capital_payment: capital / installments, start_date: debtForm.start_date, has_interest: debtForm.has_interest, cutoff_day: debtForm.cutoff_day ? parseInt(debtForm.cutoff_day) : null, payment_day: debtForm.payment_day ? parseInt(debtForm.payment_day) : null });
      setShowDebtModal(false); setDebtForm(blankDebt); fetchData(spaceId);
    } catch (err: any) { alert('Error al agregar deuda: ' + err.message); }
  };

  const markInstallmentPaid = async (debt: Debt) => {
    if (debt.installments_paid >= debt.total_installments) return;
    if (!confirm(`¿Marcar cuota #${debt.installments_paid + 1} de "${debt.name}" como pagada?`)) return;
    await db.debts.updateInstallments(debt.id, debt.installments_paid + 1); fetchData(spaceId);
  };

  const openEditDebt = (debt: Debt) => {
    setEditDebtForm({ name: debt.name, total_capital: String(debt.total_capital), monthly_interest_rate: String(debt.monthly_interest_rate), total_installments: String(debt.total_installments), installments_paid: String(debt.installments_paid), has_interest: debt.has_interest, start_date: debt.start_date, cutoff_day: debt.cutoff_day ? String(debt.cutoff_day) : '', payment_day: debt.payment_day ? String(debt.payment_day) : '' });
    setEditingDebt(debt);
  };

  const saveEditDebt = async (e: React.FormEvent) => {
    e.preventDefault(); if (!editingDebt) return;
    const capital = parseFloat(editDebtForm.total_capital);
    const installments = parseInt(editDebtForm.total_installments);
    try {
      await db.debts.update(editingDebt.id, { name: editDebtForm.name, total_capital: capital, monthly_interest_rate: editDebtForm.has_interest ? parseFloat(editDebtForm.monthly_interest_rate) : 0, total_installments: installments, installments_paid: parseInt(editDebtForm.installments_paid), fixed_capital_payment: capital / installments, start_date: editDebtForm.start_date, has_interest: editDebtForm.has_interest, cutoff_day: editDebtForm.cutoff_day ? parseInt(editDebtForm.cutoff_day) : null, payment_day: editDebtForm.payment_day ? parseInt(editDebtForm.payment_day) : null });
      setEditingDebt(null); fetchData(spaceId);
    } catch (err: any) { alert('Error al editar: ' + err.message); }
  };

  const deleteIncome  = async (id: string) => { if (confirm('¿Eliminar?')) { await db.incomes.delete(id); fetchData(spaceId); } };
  const deleteExpense = async (id: string) => { if (confirm('¿Eliminar?')) { await db.fixedExpenses.delete(id); fetchData(spaceId); } };
  const deleteDebt    = async (id: string) => { if (confirm('¿Eliminar esta deuda?')) { await db.debts.delete(id); fetchData(spaceId); } };

  /* ── Financials ─────────────────────────────────────────── */
  const totalIncomes       = incomes.reduce((a, c) => a + c.amount, 0);
  const totalFixedExpenses = fixedExpenses.reduce((a, c) => a + c.amount, 0);

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

  /* ── Key metrics ────────────────────────────────────────── */
  const savingsRate     = totalIncomes > 0 ? (freeCashFlow / totalIncomes) * 100 : 0;
  const debtToIncome    = totalIncomes > 0 ? (totalDebtQuota / totalIncomes) * 100 : 0;
  const totalInterestRemaining = activeDebtsDetails.filter(d => !d.isCompleted && d.has_interest).reduce((acc, debt) => {
    let bal = debt.total_capital - debt.installments_paid * debt.fixed_capital_payment;
    let tot = 0;
    for (let i = debt.installments_paid; i < debt.total_installments; i++) {
      const interest = bal * (debt.monthly_interest_rate / 100);
      tot += interest;
      bal -= debt.fixed_capital_payment;
    }
    return acc + tot;
  }, 0);

  /* ── Amortization table ─────────────────────────────────── */
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

  /* ── Projections ────────────────────────────────────────── */
  const getProjections = () => {
    const now      = new Date();
    const todayDay = now.getDate();
    const debtEndMonths = debts.map(debt => {
      let offset = 0;
      if (debt.cutoff_day) {
        if (new Date(debt.start_date).getDate() > debt.cutoff_day) offset++;
        if (todayDay > debt.cutoff_day) offset++;
      }
      return debt.total_installments - debt.installments_paid + offset;
    });
    const maxMonths = Math.max(12, ...debtEndMonths, 1);
    const months = [];

    for (let i = 0; i < maxMonths; i++) {
      const simDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      let simDebtsQuota = 0;

      const simDebts = debts.map(debt => {
        const start = new Date(debt.start_date);
        let offset  = 0;
        if (debt.cutoff_day) {
          if (start.getDate() > debt.cutoff_day) offset++;
          if (i === 0 && todayDay > debt.cutoff_day) offset++;
        }
        const adjStart   = new Date(start.getFullYear(), start.getMonth() + offset, 1);
        const diffMonths = (simDate.getFullYear() - adjStart.getFullYear()) * 12 + simDate.getMonth() - adjStart.getMonth();
        if (diffMonths < 0 || diffMonths >= debt.total_installments) return { name: debt.name, quota: 0, payment_day: debt.payment_day };
        const remainBefore = debt.total_capital - diffMonths * debt.fixed_capital_payment;
        const interest     = debt.has_interest ? remainBefore * (debt.monthly_interest_rate / 100) : 0;
        const quota        = debt.fixed_capital_payment + interest;
        simDebtsQuota += quota;
        return { name: debt.name, quota, payment_day: debt.payment_day };
      });

      const cashFlow = totalIncomes - totalFixedExpenses - simDebtsQuota;
      months.push({ date: simDate, label: monthLong(simDate), short: monthShort(simDate), incomes: totalIncomes, fixedExpenses: totalFixedExpenses, debtsQuota: simDebtsQuota, totalExpenses: totalFixedExpenses + simDebtsQuota, cashFlow, debtItems: simDebts.filter(d => d.quota > 0), isDebtFree: simDebtsQuota === 0 });
    }
    return months;
  };

  const projections = useMemo(getProjections, [debts, totalIncomes, totalFixedExpenses]);

  const debtFreeIdx  = projections.findIndex((p, i) => p.isDebtFree && i > 0 && !projections[i - 1]?.isDebtFree);
  const debtFreeDate = debtFreeIdx >= 0 ? projections[debtFreeIdx]?.label : null;

  /* ── Chart data ─────────────────────────────────────────── */
  const donutSegments = [
    { label: 'Egresos fijos', value: totalFixedExpenses, color: 'var(--red)' },
    { label: 'Cuotas deuda',  value: totalDebtQuota,     color: 'var(--orange)' },
    { label: 'Disponible',    value: Math.max(0, freeCashFlow), color: 'var(--green)' },
  ];

  const barChartGroups = projections.slice(0, 8).map(p => ({
    label: p.short,
    bars: [
      { value: p.incomes,        color: 'var(--green)' },
      { value: p.fixedExpenses,  color: 'var(--red)' },
      { value: p.debtsQuota,     color: 'var(--orange)' },
    ],
  }));

  const lineChartData = projections.slice(0, 18).map(p => ({ label: p.short, value: p.cashFlow }));

  const expenseCategoryTotals = fixedExpenses.reduce((acc, exp) => {
    acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
    return acc;
  }, {} as Record<string, number>);
  const categoryColors: Record<string, string> = { Vivienda: 'var(--blue)', Servicios: 'var(--purple)', Alimentación: 'var(--orange)', Transporte: 'var(--green)', Suscripciones: 'var(--red)', Salud: '#ec4899', Educación: '#06b6d4', Otros: 'var(--text-muted)' };

  /* ═══════════════════════════════════════════════════════════
     AUTH SCREEN
     ═══════════════════════════════════════════════════════════ */
  if (!user && !loading) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <Wallet size={28} /> Finanzas Pro
          </div>
          <p className="auth-sub">Tu panel de finanzas personales y familiares</p>
          <div className="auth-tabs">
            <button className={`auth-tab ${isLogin ? 'active' : ''}`} onClick={() => setIsLogin(true)}>Iniciar sesión</button>
            <button className={`auth-tab ${!isLogin ? 'active' : ''}`} onClick={() => setIsLogin(false)}>Registrarse</button>
          </div>
          {authError && <div className="auth-error">{authError}</div>}
          <form onSubmit={handleAuth}>
            <div className="form-group"><label>Correo electrónico</label><input type="email" className="form-control" placeholder="tu@correo.com" value={email} onChange={e => setEmail(e.target.value)} required /></div>
            <div className="form-group"><label>Contraseña</label><input type="password" className="form-control" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required /></div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }} disabled={authLoading}>
              {authLoading ? <RefreshCw size={16} className="spin" /> : (isLogin ? 'Entrar' : 'Crear cuenta')}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <RefreshCw size={32} className="spin" style={{ color: 'var(--text-muted)' }} />
    </div>
  );

  /* ═══════════════════════════════════════════════════════════
     MAIN APP
     ═══════════════════════════════════════════════════════════ */
  return (
    <>
      {/* ── HEADER ─────────────────────────────────────────── */}
      <header className="main-header">
        <div className="logo">
          <Wallet size={18} />
          <span className="logo-text">Finanzas Pro</span>
        </div>

        <div className="nav-links">
          <button className={`nav-link ${currentTab === 'dashboard' ? 'active' : ''}`} onClick={() => setCurrentTab('dashboard')}>Dashboard</button>
          <button className={`nav-link ${currentTab === 'projections' ? 'active' : ''}`} onClick={() => setCurrentTab('projections')}>Proyecciones</button>
        </div>

        <div className="header-actions">
          <button id="theme-toggle" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} className="btn btn-ghost btn-icon" title={theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}>
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <div className="shared-space-badge">
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Espacio familiar</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', cursor: 'pointer' }} onClick={() => navigator.clipboard.writeText(spaceId)} title="Clic para copiar">{spaceId.substring(0, 8)}…</div>
          </div>
          <button onClick={handleSignOut} className="btn btn-ghost btn-icon" title="Cerrar sesión"><LogOut size={15} /></button>
        </div>
      </header>

      {/* ── CONTENT ────────────────────────────────────────── */}
      <main className="dashboard-container">

        {/* ══════════ DASHBOARD ══════════ */}
        {currentTab === 'dashboard' && (
          <>
            {/* Stat Cards */}
            <div className="summary-grid">
              {[
                { icon: <Wallet size={13} />,    label: 'Ingresos del mes',     value: totalIncomes,       cls: 'green' },
                { icon: <Receipt size={13} />,   label: 'Egresos fijos',        value: totalFixedExpenses, cls: 'red' },
                { icon: <CreditCard size={13} />,label: 'Cuotas del mes',       value: totalDebtQuota,     cls: 'orange' },
                { icon: <Landmark size={13} />,  label: 'Deuda total restante', value: totalRemainingDebt, cls: 'red' },
              ].map((s, i) => (
                <div key={i} className="stat-card">
                  <div className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>{s.icon}{s.label}</div>
                  <div className={`stat-value ${s.cls}`}>{fmt(s.value)}</div>
                  <div className="stat-sub">
                    {i === 0 && `${incomes.length} fuente${incomes.length !== 1 ? 's' : ''}`}
                    {i === 1 && `${fixedExpenses.length} concepto${fixedExpenses.length !== 1 ? 's' : ''}`}
                    {i === 2 && `${activeDebtsDetails.filter(d => !d.isCompleted).length} deuda${activeDebtsDetails.filter(d => !d.isCompleted).length !== 1 ? 's' : ''} activa${activeDebtsDetails.filter(d => !d.isCompleted).length !== 1 ? 's' : ''}`}
                    {i === 3 && `${debts.length} obligación${debts.length !== 1 ? 'es' : ''}`}
                  </div>
                </div>
              ))}
            </div>

            {/* FCF Banner */}
            <div className={`fcf-banner ${freeCashFlow >= 0 ? 'positive' : 'negative'}`} style={{ marginBottom: 20 }}>
              <div>
                <div className="fcf-banner-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {freeCashFlow >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                  {freeCashFlow >= 0 ? 'Flujo de caja libre' : 'Déficit mensual'}
                </div>
                <div style={{ fontSize: '0.75rem', marginTop: 2, opacity: 0.75 }}>
                  Ingresos − Egresos fijos − Cuotas del mes
                </div>
              </div>
              <div className="fcf-banner-amount">{fmt(Math.abs(freeCashFlow))}</div>
            </div>

            {/* Dashboard Grid */}
            <div className="dashboard-grid">

              {/* ─── LEFT COLUMN ─── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* Ingresos */}
                <div className="card">
                  <div className="section-header">
                    <div>
                      <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Wallet size={16} />Ingresos</div>
                      <div className="section-subtitle">Fuentes de ingreso del mes</div>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={() => setShowIncomeModal(true)}><Plus size={14} /> Agregar</button>
                  </div>
                  {incomes.length === 0 ? (
                    <div className="empty-state"><Banknote size={32} style={{ opacity: 0.3 }} /><div className="empty-state-text">Sin ingresos registrados</div></div>
                  ) : (
                    <div className="table-wrapper">
                      <table className="data-table">
                        <thead><tr><th>Concepto</th><th>Mes / Año</th><th className="text-right">Valor</th><th></th></tr></thead>
                        <tbody>
                          {incomes.map(inc => (
                            <tr key={inc.id}>
                              <td style={{ fontWeight: 600 }}>{inc.name}</td>
                              <td style={{ color: 'var(--text-secondary)' }}>{new Date(inc.year, inc.month - 1).toLocaleString('es-ES', { month: 'short', year: 'numeric' })}</td>
                              <td className="text-right mono" style={{ color: 'var(--green)', fontWeight: 700 }}>{fmt(inc.amount)}</td>
                              <td><button onClick={() => deleteIncome(inc.id)} className="btn btn-danger btn-icon btn-sm"><Trash2 size={13} /></button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Egresos */}
                <div className="card">
                  <div className="section-header">
                    <div>
                      <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Receipt size={16} />Egresos Fijos</div>
                      <div className="section-subtitle">Gastos recurrentes mensuales</div>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={() => setShowExpenseModal(true)}><Plus size={14} /> Agregar</button>
                  </div>
                  {fixedExpenses.length === 0 ? (
                    <div className="empty-state"><Receipt size={32} style={{ opacity: 0.3 }} /><div className="empty-state-text">Sin egresos fijos registrados</div></div>
                  ) : (
                    <div className="table-wrapper">
                      <table className="data-table">
                        <thead><tr><th>Concepto</th><th>Categoría</th><th className="text-right">Valor</th><th></th></tr></thead>
                        <tbody>
                          {fixedExpenses.map(exp => (
                            <tr key={exp.id}>
                              <td style={{ fontWeight: 600 }}>{exp.name}</td>
                              <td><span className="badge badge-gray">{exp.category}</span></td>
                              <td className="text-right mono" style={{ color: 'var(--red)', fontWeight: 700 }}>{fmt(exp.amount)}</td>
                              <td><button onClick={() => deleteExpense(exp.id)} className="btn btn-danger btn-icon btn-sm"><Trash2 size={13} /></button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Deudas */}
                <div className="card">
                  <div className="section-header">
                    <div>
                      <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}><CreditCard size={16} />Deudas y Cuotas</div>
                      <div className="section-subtitle">Compras financiadas y créditos activos</div>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={() => setShowDebtModal(true)}><Plus size={14} /> Agregar</button>
                  </div>

                  {activeDebtsDetails.length === 0 ? (
                    <div className="empty-state"><Sparkles size={32} style={{ opacity: 0.3 }} /><div className="empty-state-text">Sin deudas registradas</div></div>
                  ) : (
                    <div className="debt-list">
                      {activeDebtsDetails.map(debt => {
                        const pct       = Math.round((debt.installments_paid / debt.total_installments) * 100);
                        const remaining = debt.total_installments - debt.installments_paid;
                        return (
                          <div key={debt.id} className={`debt-card ${debt.isCompleted ? 'completed' : ''}`}>
                            <div className="debt-card-header">
                              <div>
                                <div className="debt-name">{debt.name}</div>
                                {(debt.cutoff_day || debt.payment_day) && (
                                  <div className="debt-billing-tags" style={{ padding: '6px 0 0' }}>
                                    {debt.cutoff_day  && <span className="billing-tag"><Scissors size={10} /> Corte: día {debt.cutoff_day}</span>}
                                    {debt.payment_day && <span className="billing-tag"><Calendar size={10} /> Pago: día {debt.payment_day}</span>}
                                  </div>
                                )}
                              </div>
                              <span className={`debt-status ${debt.isCompleted ? 'done' : 'active'}`}>
                                {debt.isCompleted
                                  ? <><CheckCircle2 size={11} style={{ display: 'inline', marginRight: 3 }} />Pagada</>
                                  : <><Clock size={11} style={{ display: 'inline', marginRight: 3 }} />{remaining} cuota{remaining !== 1 ? 's' : ''}</>
                                }
                              </span>
                            </div>

                            <div className="debt-card-body">
                              <div className="debt-stat"><div className="debt-stat-label">Capital total</div><div className="debt-stat-value">{fmt(debt.total_capital)}</div></div>
                              <div className="debt-stat"><div className="debt-stat-label">Saldo pendiente</div><div className={`debt-stat-value ${debt.isCompleted ? '' : 'orange'}`}>{fmt(debt.isCompleted ? 0 : debt.remainingBalance + debt.fixed_capital_payment)}</div></div>
                              <div className="debt-stat"><div className="debt-stat-label">Interés</div><div className="debt-stat-value">{debt.has_interest ? `${debt.monthly_interest_rate}% / mes` : 'Sin interés'}</div></div>
                            </div>

                            <div style={{ margin: '4px 20px 0' }}>
                              <div className="progress-bar">
                                <div className="progress-fill" style={{ width: `${pct}%`, background: debt.isCompleted ? 'var(--green)' : 'var(--orange)' }} />
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                <span>{debt.installments_paid} / {debt.total_installments} pagadas</span>
                                <span>{pct}%</span>
                              </div>
                            </div>

                            {!debt.isCompleted && (
                              <div className="debt-next-quota">
                                <div className="debt-next-quota-label">
                                  Cuota <strong>#{debt.installments_paid + 1}</strong> · Capital <strong>{fmt(debt.fixed_capital_payment)}</strong>
                                  {debt.has_interest && <> + Interés <strong>{fmt(debt.currentInterest)}</strong></>}
                                </div>
                                <div className="debt-next-quota-amount">{fmt(debt.currentQuota)}</div>
                              </div>
                            )}

                            <div className="debt-card-actions">
                              {!debt.isCompleted && (
                                <button className="btn btn-success btn-sm" onClick={() => markInstallmentPaid(debt)}>
                                  <CheckCircle2 size={14} /> Marcar cuota #{debt.installments_paid + 1} pagada
                                </button>
                              )}
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
              </div>

              {/* ─── RIGHT COLUMN ─── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* Donut + Distribution */}
                <div className="card">
                  <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 20 }}>
                    <PieChart size={16} /> Distribución mensual
                  </div>
                  <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                    <DonutChart segments={donutSegments} size={140} thickness={26} />
                    <div style={{ flex: 1, minWidth: 120, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {donutSegments.map((s, i) => (
                        <div key={i}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 4 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, display: 'inline-block', flexShrink: 0 }} />
                              <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{s.label}</span>
                            </span>
                            <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>{fmt(s.value)}</span>
                          </div>
                          <HBar value={s.value} max={totalIncomes} color={s.color} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Key Metrics */}
                <div className="card">
                  <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 18 }}>
                    <Target size={16} /> Métricas clave
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* Savings Rate */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.82rem' }}>
                        <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}><ArrowUpRight size={14} />Tasa de ahorro</span>
                        <span style={{ fontWeight: 700, color: savingsRate >= 20 ? 'var(--green)' : savingsRate >= 10 ? 'var(--orange)' : 'var(--red)' }}>{savingsRate.toFixed(1)}%</span>
                      </div>
                      <HBar value={Math.max(0, savingsRate)} max={100} color={savingsRate >= 20 ? 'var(--green)' : savingsRate >= 10 ? 'var(--orange)' : 'var(--red)'} />
                    </div>
                    {/* Debt/Income */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.82rem' }}>
                        <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}><CreditCard size={14} />Cuotas / Ingresos</span>
                        <span style={{ fontWeight: 700, color: debtToIncome <= 25 ? 'var(--green)' : debtToIncome <= 40 ? 'var(--orange)' : 'var(--red)' }}>{debtToIncome.toFixed(1)}%</span>
                      </div>
                      <HBar value={debtToIncome} max={100} color={debtToIncome <= 25 ? 'var(--green)' : debtToIncome <= 40 ? 'var(--orange)' : 'var(--red)'} />
                    </div>
                    <div className="section-divider" />
                    {/* Other stats */}
                    {[
                      { icon: <AlertTriangle size={13} />, label: 'Interés total restante', value: fmt(totalInterestRemaining), color: totalInterestRemaining > 0 ? 'var(--orange)' : 'var(--green)' },
                      { icon: <Activity size={13} />,      label: 'Gasto total mes',        value: fmt(totalFixedExpenses + totalDebtQuota), color: 'var(--text-primary)' },
                      { icon: <Sparkles size={13} />,      label: 'Libre de deudas',        value: debtFreeDate || (debts.length === 0 ? 'Ya eres libre' : 'Calculando...'), color: 'var(--green)' },
                    ].map((m, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                        <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>{m.icon}{m.label}</span>
                        <span style={{ fontWeight: 700, color: m.color, textAlign: 'right', maxWidth: '55%', fontSize: '0.78rem' }}>{m.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bar Chart — próximos 8 meses */}
                {projections.length > 0 && (
                  <div className="card">
                    <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                      <BarChart2 size={16} /> Proyección próximos meses
                    </div>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                      {[['var(--green)', 'Ingresos'], ['var(--red)', 'Egresos'], ['var(--orange)', 'Cuotas']].map(([c, l], i) => (
                        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: c, display: 'inline-block' }} />{l}
                        </span>
                      ))}
                    </div>
                    <BarChart groups={barChartGroups} height={140} />
                  </div>
                )}

                {/* Expense categories */}
                {Object.keys(expenseCategoryTotals).length > 0 && (
                  <div className="card">
                    <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 16 }}>
                      <Receipt size={16} /> Egresos por categoría
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                      {Object.entries(expenseCategoryTotals).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                        <div key={cat}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 5 }}>
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{cat}</span>
                            <span style={{ fontWeight: 700, color: 'var(--red)' }}>{fmt(amt)}</span>
                          </div>
                          <HBar value={amt} max={totalFixedExpenses} color={categoryColors[cat] || 'var(--text-muted)'} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ══════════ PROJECTIONS ══════════ */}
        {currentTab === 'projections' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Header */}
            <div className="card" style={{ padding: '18px 22px' }}>
              <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Calendar size={16} /> Proyección hasta el fin de tus deudas
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 6 }}>
                {projections.length} meses proyectados
                {debtFreeDate && <> · Libre de deudas estimado: <strong style={{ color: 'var(--green)' }}>{debtFreeDate}</strong></>}
              </p>
            </div>

            {/* Line Chart — Cash Flow Trend */}
            {lineChartData.length > 1 && (
              <div className="card">
                <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 16 }}>
                  <Activity size={16} /> Tendencia de flujo de caja libre
                </div>
                <div style={{ display: 'flex', gap: 14, marginBottom: 12, flexWrap: 'wrap' }}>
                  {[['var(--green)', 'Flujo positivo'], ['var(--red)', 'Déficit']].map(([c, l], i) => (
                    <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      <span style={{ width: 10, height: 3, borderRadius: 2, background: c, display: 'inline-block' }} />{l}
                    </span>
                  ))}
                </div>
                <LineAreaChart data={lineChartData} height={170} />
              </div>
            )}

            {/* Table */}
            <div className="projection-table-wrapper">
              <table className="projection-table">
                <thead>
                  <tr>
                    <th>Mes</th>
                    <th className="text-right">Ingresos</th>
                    <th className="text-right">Egresos fijos</th>
                    <th className="text-right">Cuotas</th>
                    <th className="text-right">Flujo libre</th>
                    <th>Detalle cuotas</th>
                  </tr>
                </thead>
                <tbody>
                  {projections.map((proj, i) => (
                    <tr key={i} className={proj.isDebtFree && i > 0 && !projections[i - 1].isDebtFree ? 'debt-free' : ''}>
                      <td>
                        <div className="month-label">{proj.label}</div>
                        {proj.isDebtFree && i > 0 && !projections[i - 1].isDebtFree && (
                          <span className="badge badge-green" style={{ marginTop: 4 }}>
                            <Sparkles size={10} style={{ display: 'inline', marginRight: 3 }} />Libre de deudas
                          </span>
                        )}
                      </td>
                      <td className="text-right"><span className="proj-amount green">{fmt(proj.incomes)}</span></td>
                      <td className="text-right"><span className="proj-amount red">{fmt(proj.fixedExpenses)}</span></td>
                      <td className="text-right">
                        {proj.debtsQuota > 0 ? <span className="proj-amount orange">{fmt(proj.debtsQuota)}</span> : <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>}
                      </td>
                      <td className="text-right">
                        <span className={`proj-amount ${proj.cashFlow >= 0 ? 'green' : 'red'}`}>
                          {proj.cashFlow >= 0 ? '+' : ''}{fmt(proj.cashFlow)}
                        </span>
                      </td>
                      <td>
                        {proj.debtItems.length === 0
                          ? <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Sin cuotas</span>
                          : proj.debtItems.map((d, j) => (
                            <div key={j} style={{ fontSize: '0.78rem' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>{d.name}: </span>
                              <span style={{ color: 'var(--orange)', fontWeight: 700 }}>{fmt(d.quota)}</span>
                              {d.payment_day && <span className="badge badge-gray" style={{ marginLeft: 4, fontSize: '0.65rem' }}>día {d.payment_day}</span>}
                            </div>
                          ))
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Wallet size={18} /> Agregar ingreso</div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowIncomeModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={addIncome}>
              <div className="form-group"><label>Nombre / Fuente</label><input type="text" className="form-control" placeholder="Ej. Salario, Freelance" value={incomeForm.name} onChange={e => setIncomeForm({ ...incomeForm, name: e.target.value })} required /></div>
              <div className="form-group"><label>Valor ($)</label><input type="number" className="form-control" placeholder="Ej. 3500000" value={incomeForm.amount} onChange={e => setIncomeForm({ ...incomeForm, amount: e.target.value })} required /></div>
              <div className="form-row">
                <div className="form-group"><label>Mes</label>
                  <select className="form-control" value={incomeForm.month} onChange={e => setIncomeForm({ ...incomeForm, month: parseInt(e.target.value) })}>
                    {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString('es-ES', { month: 'long' })}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Año</label><input type="number" className="form-control" value={incomeForm.year} onChange={e => setIncomeForm({ ...incomeForm, year: parseInt(e.target.value) })} required /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowIncomeModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Agregar ingreso</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {showExpenseModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowExpenseModal(false); }}>
          <div className="modal-content">
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Receipt size={18} /> Agregar egreso fijo</div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowExpenseModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={addExpense}>
              <div className="form-group"><label>Concepto</label><input type="text" className="form-control" placeholder="Ej. Arriendo, Servicios" value={expenseForm.name} onChange={e => setExpenseForm({ ...expenseForm, name: e.target.value })} required /></div>
              <div className="form-group"><label>Valor ($)</label><input type="number" className="form-control" placeholder="Ej. 800000" value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })} required /></div>
              <div className="form-group"><label>Categoría</label>
                <select className="form-control" value={expenseForm.category} onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })}>
                  {['Vivienda', 'Servicios', 'Alimentación', 'Transporte', 'Suscripciones', 'Salud', 'Educación', 'Otros'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowExpenseModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Agregar egreso</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Debt Modal */}
      {showDebtModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowDebtModal(false); }}>
          <div className="modal-content">
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><CreditCard size={18} /> Agregar deuda / cuota</div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowDebtModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={addDebt}>
              <div className="form-group"><label>Nombre de la deuda</label><input type="text" className="form-control" placeholder="Ej. Tarjeta Visa — Computador" value={debtForm.name} onChange={e => setDebtForm({ ...debtForm, name: e.target.value })} required /></div>
              <div className="form-row">
                <div className="form-group"><label>Monto financiado ($)</label><input type="number" className="form-control" placeholder="Ej. 1200000" value={debtForm.total_capital} onChange={e => setDebtForm({ ...debtForm, total_capital: e.target.value })} required /></div>
                <div className="form-group"><label>Cuotas totales</label><input type="number" className="form-control" placeholder="Ej. 12" value={debtForm.total_installments} onChange={e => setDebtForm({ ...debtForm, total_installments: e.target.value })} required /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Cuotas ya pagadas</label><input type="number" className="form-control" placeholder="0" value={debtForm.installments_paid} onChange={e => setDebtForm({ ...debtForm, installments_paid: e.target.value })} required /></div>
                <div className="form-group"><label>Fecha de compra</label><input type="date" className="form-control" value={debtForm.start_date} onChange={e => setDebtForm({ ...debtForm, start_date: e.target.value })} required /></div>
              </div>
              <div className="form-group">
                <div className="switch-group" onClick={() => setDebtForm({ ...debtForm, has_interest: !debtForm.has_interest })}>
                  <span className="switch"><input type="checkbox" checked={debtForm.has_interest} onChange={() => {}} /><span className="slider" /></span>
                  <span>¿Tiene intereses mensuales?</span>
                </div>
              </div>
              {debtForm.has_interest && <div className="form-group"><label>Tasa mensual (%)</label><input type="number" step="0.01" className="form-control" placeholder="Ej. 1.8" value={debtForm.monthly_interest_rate} onChange={e => setDebtForm({ ...debtForm, monthly_interest_rate: e.target.value })} /></div>}
              <div style={{ borderTop: '1px solid var(--divider)', paddingTop: 16, marginTop: 4 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Scissors size={13} /> <strong>Ciclo de facturación</strong> — Opcional, para tarjetas de crédito
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Día de corte</label><input type="number" min="1" max="31" className="form-control" placeholder="Ej. 25" value={debtForm.cutoff_day} onChange={e => setDebtForm({ ...debtForm, cutoff_day: e.target.value })} /><div className="form-hint">Día en que cierra el ciclo</div></div>
                  <div className="form-group"><label>Día de pago</label><input type="number" min="1" max="31" className="form-control" placeholder="Ej. 30" value={debtForm.payment_day} onChange={e => setDebtForm({ ...debtForm, payment_day: e.target.value })} /><div className="form-hint">Día en que pagas</div></div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowDebtModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Agregar deuda</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Debt Modal */}
      {editingDebt && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setEditingDebt(null); }}>
          <div className="modal-content">
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Edit2 size={17} /> {editingDebt.name}</div>
              <button className="btn btn-ghost btn-icon" onClick={() => setEditingDebt(null)}><X size={16} /></button>
            </div>
            <form onSubmit={saveEditDebt}>
              <div className="form-group"><label>Nombre</label><input type="text" className="form-control" value={editDebtForm.name} onChange={e => setEditDebtForm({ ...editDebtForm, name: e.target.value })} required /></div>
              <div className="form-row">
                <div className="form-group"><label>Capital total ($)</label><input type="number" className="form-control" value={editDebtForm.total_capital} onChange={e => setEditDebtForm({ ...editDebtForm, total_capital: e.target.value })} required /></div>
                <div className="form-group"><label>Cuotas totales</label><input type="number" className="form-control" value={editDebtForm.total_installments} onChange={e => setEditDebtForm({ ...editDebtForm, total_installments: e.target.value })} required /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Cuotas pagadas</label><input type="number" className="form-control" value={editDebtForm.installments_paid} onChange={e => setEditDebtForm({ ...editDebtForm, installments_paid: e.target.value })} required /></div>
                <div className="form-group"><label>Fecha de compra</label><input type="date" className="form-control" value={editDebtForm.start_date} onChange={e => setEditDebtForm({ ...editDebtForm, start_date: e.target.value })} required /></div>
              </div>
              <div className="form-group">
                <div className="switch-group" onClick={() => setEditDebtForm({ ...editDebtForm, has_interest: !editDebtForm.has_interest })}>
                  <span className="switch"><input type="checkbox" checked={editDebtForm.has_interest} onChange={() => {}} /><span className="slider" /></span>
                  <span>¿Tiene intereses?</span>
                </div>
              </div>
              {editDebtForm.has_interest && <div className="form-group"><label>Tasa mensual (%)</label><input type="number" step="0.01" className="form-control" value={editDebtForm.monthly_interest_rate} onChange={e => setEditDebtForm({ ...editDebtForm, monthly_interest_rate: e.target.value })} /></div>}
              <div className="form-row">
                <div className="form-group"><label>Día de corte</label><input type="number" min="1" max="31" className="form-control" placeholder="Ej. 25" value={editDebtForm.cutoff_day} onChange={e => setEditDebtForm({ ...editDebtForm, cutoff_day: e.target.value })} /></div>
                <div className="form-group"><label>Día de pago</label><input type="number" min="1" max="31" className="form-control" placeholder="Ej. 30" value={editDebtForm.payment_day} onChange={e => setEditDebtForm({ ...editDebtForm, payment_day: e.target.value })} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditingDebt(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Amortization Modal */}
      {amortDebt && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setAmortDebt(null); }}>
          <div className="modal-content modal-wide">
            <div className="modal-header">
              <div>
                <div className="modal-title">{amortDebt.name}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                  {fmt(amortDebt.total_capital)} · {amortDebt.total_installments} cuotas · {amortDebt.has_interest ? `${amortDebt.monthly_interest_rate}% mensual` : 'Sin interés'}
                </div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setAmortDebt(null)}><X size={16} /></button>
            </div>
            <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
              <table className="amort-table">
                <thead>
                  <tr><th>#</th><th>Capital</th><th>Interés</th><th>Cuota total</th><th>Saldo</th><th>Estado</th></tr>
                </thead>
                <tbody>
                  {buildAmortTable(amortDebt).map(row => (
                    <tr key={row.num} className={row.paid ? 'paid' : row.isNext ? 'next-due' : ''}>
                      <td style={{ textAlign: 'left', fontWeight: row.isNext ? 700 : 400 }}>#{row.num}</td>
                      <td>{fmt(row.capital)}</td>
                      <td>{fmt(row.interest)}</td>
                      <td style={{ fontWeight: 700 }}>{fmt(row.quota)}</td>
                      <td>{fmt(row.remaining)}</td>
                      <td style={{ textAlign: 'left' }}>
                        {row.paid
                          ? <span className="badge badge-green"><CheckCircle2 size={10} style={{ display: 'inline', marginRight: 3 }} />Pagada</span>
                          : row.isNext
                            ? <span className="badge badge-orange"><Clock size={10} style={{ display: 'inline', marginRight: 3 }} />Próxima</span>
                            : <span className="badge badge-gray">Pendiente</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setAmortDebt(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
