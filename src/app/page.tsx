'use client';

import { useState, useEffect, useMemo } from 'react';
import { db, Income, FixedExpense, Debt } from '@/lib/db';
import {
  TrendingUp,
  TrendingDown,
  Trash2,
  Plus,
  LogOut,
  RefreshCw,
  Sun,
  Moon,
  CheckCircle,
  Eye,
  Edit2,
  X,
} from 'lucide-react';

/* ---- helpers ---- */
const fmt = (n: number) =>
  '$' + Math.round(n).toLocaleString('es-CO');

const monthName = (date: Date) =>
  date.toLocaleString('es-ES', { month: 'long', year: 'numeric' });

/* ============================================================
   COMPONENT
   ============================================================ */
export default function Home() {
  /* Auth */
  const [user, setUser] = useState<any>(null);
  const [spaceId, setSpaceId] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  /* App */
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'projections'>('dashboard');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  /* Data */
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);

  /* Modals */
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [amortDebt, setAmortDebt] = useState<Debt | null>(null);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);

  /* Forms */
  const [incomeForm, setIncomeForm] = useState({
    name: '', amount: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  });
  const [expenseForm, setExpenseForm] = useState({ name: '', amount: '', category: 'Vivienda' });

  const blankDebt = {
    name: '', total_capital: '', monthly_interest_rate: '0',
    total_installments: '12', installments_paid: '0',
    has_interest: false,
    start_date: new Date().toISOString().split('T')[0],
    cutoff_day: '', payment_day: '',
  };
  const [debtForm, setDebtForm] = useState(blankDebt);
  const [editDebtForm, setEditDebtForm] = useState(blankDebt);

  /* ---- Theme persistence ---- */
  useEffect(() => {
    const saved = typeof window !== 'undefined' && localStorage.getItem('fp-theme');
    if (saved === 'light' || saved === 'dark') setTheme(saved);
  }, []);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (typeof window !== 'undefined') localStorage.setItem('fp-theme', theme);
  }, [theme]);

  /* ---- Session ---- */
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
      const [inc, exp, dbt] = await Promise.all([
        db.incomes.list(sId),
        db.fixedExpenses.list(sId),
        db.debts.list(sId),
      ]);
      setIncomes(inc);
      setFixedExpenses(exp);
      setDebts(dbt);
    } finally {
      setLoading(false);
    }
  };

  /* ---- Auth ---- */
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      if (isLogin) {
        const u = await db.auth.signIn(email, password);
        setUser(u);
        setSpaceId(u.space_id || '');
        fetchData(u.space_id || '');
      } else {
        const u = await db.auth.signUp(email, password);
        setUser(u);
        setSpaceId(u.space_id || '');
        fetchData(u.space_id || '');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Error de autenticación');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await db.auth.signOut();
    setUser(null);
    setSpaceId('');
    setIncomes([]); setFixedExpenses([]); setDebts([]);
  };

  /* ---- Income CRUD ---- */
  const addIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incomeForm.name || !incomeForm.amount) return;
    try {
      await db.incomes.create({
        space_id: spaceId, name: incomeForm.name,
        amount: parseFloat(incomeForm.amount),
        month: incomeForm.month, year: incomeForm.year,
      });
      setShowIncomeModal(false);
      setIncomeForm({ name: '', amount: '', month: new Date().getMonth() + 1, year: new Date().getFullYear() });
      fetchData(spaceId);
    } catch (err: any) { alert('Error: ' + err.message); }
  };

  const deleteIncome = async (id: string) => {
    if (confirm('¿Eliminar este ingreso?')) { await db.incomes.delete(id); fetchData(spaceId); }
  };

  /* ---- Expense CRUD ---- */
  const addExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.name || !expenseForm.amount) return;
    try {
      await db.fixedExpenses.create({
        space_id: spaceId, name: expenseForm.name,
        amount: parseFloat(expenseForm.amount), category: expenseForm.category,
      });
      setShowExpenseModal(false);
      setExpenseForm({ name: '', amount: '', category: 'Vivienda' });
      fetchData(spaceId);
    } catch (err: any) { alert('Error: ' + err.message); }
  };

  const deleteExpense = async (id: string) => {
    if (confirm('¿Eliminar este egreso fijo?')) { await db.fixedExpenses.delete(id); fetchData(spaceId); }
  };

  /* ---- Debt CRUD ---- */
  const addDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!debtForm.name || !debtForm.total_capital || !debtForm.total_installments) return;
    try {
      const capital = parseFloat(debtForm.total_capital);
      const installments = parseInt(debtForm.total_installments);
      await db.debts.create({
        space_id: spaceId,
        name: debtForm.name,
        total_capital: capital,
        monthly_interest_rate: debtForm.has_interest ? parseFloat(debtForm.monthly_interest_rate) : 0,
        total_installments: installments,
        installments_paid: parseInt(debtForm.installments_paid),
        fixed_capital_payment: capital / installments,
        start_date: debtForm.start_date,
        has_interest: debtForm.has_interest,
        cutoff_day: debtForm.cutoff_day ? parseInt(debtForm.cutoff_day) : null,
        payment_day: debtForm.payment_day ? parseInt(debtForm.payment_day) : null,
      });
      setShowDebtModal(false);
      setDebtForm(blankDebt);
      fetchData(spaceId);
    } catch (err: any) { alert('Error al agregar deuda: ' + err.message); }
  };

  const markInstallmentPaid = async (debt: Debt) => {
    if (debt.installments_paid >= debt.total_installments) return;
    const nextNum = debt.installments_paid + 1;
    if (!confirm(`¿Marcar la cuota #${nextNum} de "${debt.name}" como pagada?`)) return;
    await db.debts.updateInstallments(debt.id, debt.installments_paid + 1);
    fetchData(spaceId);
  };

  const openEditDebt = (debt: Debt) => {
    setEditDebtForm({
      name: debt.name,
      total_capital: String(debt.total_capital),
      monthly_interest_rate: String(debt.monthly_interest_rate),
      total_installments: String(debt.total_installments),
      installments_paid: String(debt.installments_paid),
      has_interest: debt.has_interest,
      start_date: debt.start_date,
      cutoff_day: debt.cutoff_day ? String(debt.cutoff_day) : '',
      payment_day: debt.payment_day ? String(debt.payment_day) : '',
    });
    setEditingDebt(debt);
  };

  const saveEditDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDebt) return;
    try {
      const capital = parseFloat(editDebtForm.total_capital);
      const installments = parseInt(editDebtForm.total_installments);
      await db.debts.update(editingDebt.id, {
        name: editDebtForm.name,
        total_capital: capital,
        monthly_interest_rate: editDebtForm.has_interest ? parseFloat(editDebtForm.monthly_interest_rate) : 0,
        total_installments: installments,
        installments_paid: parseInt(editDebtForm.installments_paid),
        fixed_capital_payment: capital / installments,
        start_date: editDebtForm.start_date,
        has_interest: editDebtForm.has_interest,
        cutoff_day: editDebtForm.cutoff_day ? parseInt(editDebtForm.cutoff_day) : null,
        payment_day: editDebtForm.payment_day ? parseInt(editDebtForm.payment_day) : null,
      });
      setEditingDebt(null);
      fetchData(spaceId);
    } catch (err: any) { alert('Error al editar: ' + err.message); }
  };

  const deleteDebt = async (id: string) => {
    if (confirm('¿Eliminar esta deuda?')) { await db.debts.delete(id); fetchData(spaceId); }
  };

  /* ---- Financial calculations ---- */
  const totalIncomes = incomes.reduce((a, c) => a + c.amount, 0);
  const totalFixedExpenses = fixedExpenses.reduce((a, c) => a + c.amount, 0);

  const activeDebtsDetails = debts.map(debt => {
    const isCompleted = debt.installments_paid >= debt.total_installments;
    if (isCompleted) return { ...debt, currentInterest: 0, currentQuota: 0, currentCapital: 0, remainingBalance: 0, isCompleted: true };
    const remaining = debt.total_capital - (debt.installments_paid * debt.fixed_capital_payment);
    const interest = debt.has_interest ? remaining * (debt.monthly_interest_rate / 100) : 0;
    const quota = debt.fixed_capital_payment + interest;
    return { ...debt, currentInterest: interest, currentCapital: debt.fixed_capital_payment, currentQuota: quota, remainingBalance: remaining - debt.fixed_capital_payment, isCompleted: false };
  });

  const totalDebtQuota = activeDebtsDetails.filter(d => !d.isCompleted).reduce((a, d) => a + d.currentQuota, 0);
  const freeCashFlow = totalIncomes - totalFixedExpenses - totalDebtQuota;
  const totalRemainingDebt = activeDebtsDetails.reduce((a, d) => a + (d.remainingBalance || 0), 0);

  /* ---- Amortization table for a single debt ---- */
  const buildAmortTable = (debt: Debt) => {
    const rows = [];
    let remaining = debt.total_capital;
    for (let i = 1; i <= debt.total_installments; i++) {
      const interest = debt.has_interest ? remaining * (debt.monthly_interest_rate / 100) : 0;
      const quota = debt.fixed_capital_payment + interest;
      remaining -= debt.fixed_capital_payment;
      const paid = i <= debt.installments_paid;
      const isNext = i === debt.installments_paid + 1;
      rows.push({ num: i, capital: debt.fixed_capital_payment, interest, quota, remaining: Math.max(0, remaining), paid, isNext });
    }
    return rows;
  };

  /* ---- Dynamic projections ---- */
  const getProjections = () => {
    const now = new Date();
    const todayDay = now.getDate();

    // How many months until each debt is fully paid (considering billing offset)?
    const debtEndMonths = debts.map(debt => {
      const start = new Date(debt.start_date);
      let billingOffset = 0;
      if (debt.cutoff_day) {
        if (start.getDate() > debt.cutoff_day) billingOffset = 1;
        if (todayDay > debt.cutoff_day) billingOffset += 1;
      }
      const remaining = debt.total_installments - debt.installments_paid;
      return remaining + billingOffset;
    });

    const maxMonths = Math.max(12, ...debtEndMonths, 1);
    const months = [];

    for (let i = 0; i < maxMonths; i++) {
      const simDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      let simDebtsQuota = 0;

      const simDebts = debts.map(debt => {
        const start = new Date(debt.start_date);
        let billingOffset = 0;
        if (debt.cutoff_day) {
          if (start.getDate() > debt.cutoff_day) billingOffset = 1;
          if (i === 0 && todayDay > debt.cutoff_day) billingOffset += 1;
        }
        const adjustedStart = new Date(start.getFullYear(), start.getMonth() + billingOffset, 1);
        const diffMonths = (simDate.getFullYear() - adjustedStart.getFullYear()) * 12 + (simDate.getMonth() - adjustedStart.getMonth());

        if (diffMonths < 0 || diffMonths >= debt.total_installments) {
          return { name: debt.name, quota: 0, payment_day: debt.payment_day };
        }
        const remainingBefore = debt.total_capital - diffMonths * debt.fixed_capital_payment;
        const interest = debt.has_interest ? remainingBefore * (debt.monthly_interest_rate / 100) : 0;
        const quota = debt.fixed_capital_payment + interest;
        simDebtsQuota += quota;
        return { name: debt.name, quota, payment_day: debt.payment_day };
      });

      const totalExp = totalFixedExpenses + simDebtsQuota;
      const cashFlow = totalIncomes - totalExp;
      months.push({
        date: simDate,
        label: monthName(simDate),
        incomes: totalIncomes,
        fixedExpenses: totalFixedExpenses,
        debtsQuota: simDebtsQuota,
        totalExpenses: totalExp,
        cashFlow,
        debtItems: simDebts.filter(d => d.quota > 0),
        isDebtFree: simDebtsQuota === 0,
      });
    }
    return months;
  };

  const projections = useMemo(getProjections, [debts, totalIncomes, totalFixedExpenses]);

  /* ---- Chart data ---- */
  const chartMax = Math.max(totalIncomes, totalFixedExpenses + totalDebtQuota, 1);

  /* ============================================================
     AUTH SCREEN
     ============================================================ */
  if (!user && !loading) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-logo">💰 Finanzas Pro</div>
          <p className="auth-sub">Tu panel de finanzas personales y familiares</p>

          <div className="auth-tabs">
            <button className={`auth-tab ${isLogin ? 'active' : ''}`} onClick={() => setIsLogin(true)}>Iniciar sesión</button>
            <button className={`auth-tab ${!isLogin ? 'active' : ''}`} onClick={() => setIsLogin(false)}>Registrarse</button>
          </div>

          {authError && <div className="auth-error">{authError}</div>}

          <form onSubmit={handleAuth}>
            <div className="form-group">
              <label>Correo electrónico</label>
              <input type="email" className="form-control" placeholder="tu@correo.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Contraseña</label>
              <input type="password" className="form-control" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', fontSize: '0.95rem' }} disabled={authLoading}>
              {authLoading ? <RefreshCw size={16} className="spin" /> : (isLogin ? 'Entrar' : 'Crear cuenta')}
            </button>
          </form>

          <p style={{ marginTop: '16px', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
            ¿Quieres compartir el espacio con tu pareja? Compártele el ID de espacio después de iniciar sesión.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <RefreshCw size={32} className="spin" style={{ color: 'var(--text-muted)' }} />
      </div>
    );
  }

  /* ============================================================
     MAIN APP
     ============================================================ */
  return (
    <>
      {/* ---- HEADER ---- */}
      <header className="main-header">
        <div className="logo">💰 <span className="logo-text">Finanzas Pro</span></div>

        <div className="nav-links">
          <button className={`nav-link ${currentTab === 'dashboard' ? 'active' : ''}`} onClick={() => setCurrentTab('dashboard')}>
            Dashboard
          </button>
          <button className={`nav-link ${currentTab === 'projections' ? 'active' : ''}`} onClick={() => setCurrentTab('projections')}>
            Proyecciones
          </button>
        </div>

        <div className="header-actions">
          <button
            id="theme-toggle"
            onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            className="btn btn-ghost btn-icon"
            title={theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <div className="shared-space-badge">
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Espacio familiar</div>
            <div
              style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', cursor: 'pointer' }}
              onClick={() => { navigator.clipboard.writeText(spaceId); }}
              title="Clic para copiar"
            >
              {spaceId.substring(0, 8)}…
            </div>
          </div>
          <button onClick={handleSignOut} className="btn btn-ghost btn-icon" title="Cerrar sesión">
            <LogOut size={15} />
          </button>
        </div>
      </header>

      {/* ---- MAIN CONTENT ---- */}
      <main className="dashboard-container">

        {/* ===================== DASHBOARD TAB ===================== */}
        {currentTab === 'dashboard' && (
          <>
            {/* Executive Summary */}
            <div className="summary-grid">
              <div className="stat-card">
                <div className="stat-label">💰 Ingresos del mes</div>
                <div className="stat-value green">{fmt(totalIncomes)}</div>
                <div className="stat-sub">{incomes.length} fuente{incomes.length !== 1 ? 's' : ''}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">📋 Egresos fijos</div>
                <div className="stat-value red">{fmt(totalFixedExpenses)}</div>
                <div className="stat-sub">{fixedExpenses.length} concepto{fixedExpenses.length !== 1 ? 's' : ''}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">💳 Cuotas del mes</div>
                <div className="stat-value orange">{fmt(totalDebtQuota)}</div>
                <div className="stat-sub">{activeDebtsDetails.filter(d => !d.isCompleted).length} deuda{activeDebtsDetails.filter(d => !d.isCompleted).length !== 1 ? 's' : ''} activa{activeDebtsDetails.filter(d => !d.isCompleted).length !== 1 ? 's' : ''}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">🏦 Deuda total restante</div>
                <div className="stat-value red">{fmt(totalRemainingDebt)}</div>
                <div className="stat-sub">{debts.length} obligación{debts.length !== 1 ? 'es' : ''}</div>
              </div>
            </div>

            {/* Free Cash Flow Banner */}
            <div className={`fcf-banner ${freeCashFlow >= 0 ? 'positive' : 'negative'}`} style={{ marginBottom: '24px' }}>
              <div>
                <div className="fcf-banner-label">{freeCashFlow >= 0 ? '✅ Flujo de caja libre' : '⚠️ Déficit mensual'}</div>
                <div style={{ fontSize: '0.78rem', color: freeCashFlow >= 0 ? 'var(--green)' : 'var(--red)', marginTop: '2px', opacity: 0.75 }}>
                  Ingresos − Egresos fijos − Cuotas del mes
                </div>
              </div>
              <div className="fcf-banner-amount">{fmt(Math.abs(freeCashFlow))}</div>
            </div>

            <div className="dashboard-grid">
              {/* LEFT COLUMN */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                {/* Ingresos */}
                <div className="card">
                  <div className="section-header">
                    <div>
                      <div className="section-title">Ingresos</div>
                      <div className="section-subtitle">Fuentes de ingreso del mes</div>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={() => setShowIncomeModal(true)}>
                      <Plus size={14} /> Agregar
                    </button>
                  </div>
                  {incomes.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-state-icon">💵</div>
                      <div className="empty-state-text">Sin ingresos registrados</div>
                    </div>
                  ) : (
                    <div className="table-wrapper">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Concepto</th>
                            <th>Mes / Año</th>
                            <th className="text-right">Valor</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {incomes.map(inc => (
                            <tr key={inc.id}>
                              <td style={{ fontWeight: 600 }}>{inc.name}</td>
                              <td style={{ color: 'var(--text-secondary)' }}>
                                {new Date(inc.year, inc.month - 1).toLocaleString('es-ES', { month: 'short', year: 'numeric' })}
                              </td>
                              <td className="text-right mono" style={{ color: 'var(--green)', fontWeight: 700 }}>{fmt(inc.amount)}</td>
                              <td>
                                <button onClick={() => deleteIncome(inc.id)} className="btn btn-danger btn-icon btn-sm"><Trash2 size={13} /></button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Egresos Fijos */}
                <div className="card">
                  <div className="section-header">
                    <div>
                      <div className="section-title">Egresos Fijos</div>
                      <div className="section-subtitle">Gastos recurrentes mensuales</div>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={() => setShowExpenseModal(true)}>
                      <Plus size={14} /> Agregar
                    </button>
                  </div>
                  {fixedExpenses.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-state-icon">🧾</div>
                      <div className="empty-state-text">Sin egresos fijos registrados</div>
                    </div>
                  ) : (
                    <div className="table-wrapper">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Concepto</th>
                            <th>Categoría</th>
                            <th className="text-right">Valor</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {fixedExpenses.map(exp => (
                            <tr key={exp.id}>
                              <td style={{ fontWeight: 600 }}>{exp.name}</td>
                              <td>
                                <span className="badge badge-gray">{exp.category}</span>
                              </td>
                              <td className="text-right mono" style={{ color: 'var(--red)', fontWeight: 700 }}>{fmt(exp.amount)}</td>
                              <td>
                                <button onClick={() => deleteExpense(exp.id)} className="btn btn-danger btn-icon btn-sm"><Trash2 size={13} /></button>
                              </td>
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
                      <div className="section-title">Deudas y Cuotas</div>
                      <div className="section-subtitle">Compras financiadas y créditos activos</div>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={() => setShowDebtModal(true)}>
                      <Plus size={14} /> Agregar
                    </button>
                  </div>

                  {activeDebtsDetails.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-state-icon">🎉</div>
                      <div className="empty-state-text">¡Sin deudas registradas!</div>
                    </div>
                  ) : (
                    <div className="debt-list">
                      {activeDebtsDetails.map(debt => {
                        const pct = Math.round((debt.installments_paid / debt.total_installments) * 100);
                        const remaining = debt.total_installments - debt.installments_paid;
                        return (
                          <div key={debt.id} className={`debt-card ${debt.isCompleted ? 'completed' : ''}`}>
                            {/* Header */}
                            <div className="debt-card-header">
                              <div>
                                <div className="debt-name">{debt.name}</div>
                                {(debt.cutoff_day || debt.payment_day) && (
                                  <div className="debt-billing-tags" style={{ padding: '6px 0 0' }}>
                                    {debt.cutoff_day && <span className="billing-tag">✂️ Corte: día {debt.cutoff_day}</span>}
                                    {debt.payment_day && <span className="billing-tag">💳 Pago: día {debt.payment_day}</span>}
                                  </div>
                                )}
                              </div>
                              <span className={`debt-status ${debt.isCompleted ? 'done' : 'active'}`}>
                                {debt.isCompleted ? '✅ Pagada' : `${remaining} cuota${remaining !== 1 ? 's' : ''} restante${remaining !== 1 ? 's' : ''}`}
                              </span>
                            </div>

                            {/* Stats */}
                            <div className="debt-card-body">
                              <div className="debt-stat">
                                <div className="debt-stat-label">Capital total</div>
                                <div className="debt-stat-value">{fmt(debt.total_capital)}</div>
                              </div>
                              <div className="debt-stat">
                                <div className="debt-stat-label">Saldo pendiente</div>
                                <div className={`debt-stat-value ${debt.isCompleted ? '' : 'orange'}`}>
                                  {fmt(debt.isCompleted ? 0 : debt.remainingBalance + debt.fixed_capital_payment)}
                                </div>
                              </div>
                              <div className="debt-stat">
                                <div className="debt-stat-label">Interés</div>
                                <div className="debt-stat-value">{debt.has_interest ? `${debt.monthly_interest_rate}% / mes` : 'Sin interés'}</div>
                              </div>
                            </div>

                            {/* Progress bar */}
                            <div style={{ margin: '4px 20px 0' }}>
                              <div className="progress-bar">
                                <div className={`progress-fill ${debt.isCompleted ? '' : ''}`}
                                  style={{ width: `${pct}%`, background: debt.isCompleted ? 'var(--green)' : 'var(--orange)' }}
                                />
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                <span>{debt.installments_paid} / {debt.total_installments} pagadas</span>
                                <span>{pct}% completado</span>
                              </div>
                            </div>

                            {/* Next quota */}
                            {!debt.isCompleted && (
                              <div className="debt-next-quota">
                                <div className="debt-next-quota-label">
                                  Cuota <strong>#{debt.installments_paid + 1}</strong> · Capital{' '}
                                  <strong>{fmt(debt.fixed_capital_payment)}</strong>
                                  {debt.has_interest && <> + Interés <strong>{fmt(debt.currentInterest)}</strong></>}
                                </div>
                                <div className="debt-next-quota-amount">{fmt(debt.currentQuota)}</div>
                              </div>
                            )}

                            {/* Actions */}
                            <div className="debt-card-actions">
                              {!debt.isCompleted && (
                                <button
                                  className="btn btn-success btn-sm"
                                  onClick={() => markInstallmentPaid(debt)}
                                >
                                  <CheckCircle size={14} /> Marcar cuota #{debt.installments_paid + 1} como pagada
                                </button>
                              )}
                              <button className="btn btn-secondary btn-sm" onClick={() => setAmortDebt(debt)}>
                                <Eye size={13} /> Ver tabla
                              </button>
                              <button className="btn btn-secondary btn-sm" onClick={() => openEditDebt(debt)}>
                                <Edit2 size={13} /> Editar
                              </button>
                              <button className="btn btn-danger btn-icon btn-sm" onClick={() => deleteDebt(debt.id)}>
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                {/* Distribution chart */}
                <div className="card">
                  <div className="section-title" style={{ marginBottom: '20px' }}>Distribución mensual</div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Ingresos bar */}
                    <div className="breakdown-item">
                      <div className="breakdown-label-row">
                        <span className="breakdown-label">💰 Ingresos</span>
                        <span className="breakdown-value" style={{ color: 'var(--green)' }}>{fmt(totalIncomes)}</span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: '100%', background: 'var(--green)' }} />
                      </div>
                    </div>

                    {/* Egresos bar */}
                    <div className="breakdown-item">
                      <div className="breakdown-label-row">
                        <span className="breakdown-label">📋 Egresos fijos ({((totalFixedExpenses / (totalIncomes || 1)) * 100).toFixed(0)}%)</span>
                        <span className="breakdown-value" style={{ color: 'var(--red)' }}>{fmt(totalFixedExpenses)}</span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${Math.min(100, (totalFixedExpenses / chartMax) * 100)}%`, background: 'var(--red)' }} />
                      </div>
                    </div>

                    {/* Deuda bar */}
                    <div className="breakdown-item">
                      <div className="breakdown-label-row">
                        <span className="breakdown-label">💳 Cuotas ({((totalDebtQuota / (totalIncomes || 1)) * 100).toFixed(0)}%)</span>
                        <span className="breakdown-value" style={{ color: 'var(--orange)' }}>{fmt(totalDebtQuota)}</span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${Math.min(100, (totalDebtQuota / chartMax) * 100)}%`, background: 'var(--orange)' }} />
                      </div>
                    </div>

                    <div className="section-divider" />

                    {/* FCF */}
                    <div className="breakdown-label-row">
                      <span className="breakdown-label" style={{ fontWeight: 700 }}>🏦 Disponible</span>
                      <span className="breakdown-value" style={{ color: freeCashFlow >= 0 ? 'var(--green)' : 'var(--red)', fontSize: '1.1rem' }}>
                        {fmt(freeCashFlow)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Income breakdown */}
                {incomes.length > 0 && (
                  <div className="card">
                    <div className="section-title" style={{ marginBottom: '16px' }}>Fuentes de ingreso</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {incomes.map(inc => (
                        <div key={inc.id} className="breakdown-item">
                          <div className="breakdown-label-row">
                            <span className="breakdown-label">{inc.name}</span>
                            <span className="breakdown-value" style={{ color: 'var(--green)' }}>{fmt(inc.amount)}</span>
                          </div>
                          <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${(inc.amount / (totalIncomes || 1)) * 100}%`, background: 'var(--blue)' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Expense breakdown */}
                {fixedExpenses.length > 0 && (
                  <div className="card">
                    <div className="section-title" style={{ marginBottom: '16px' }}>Egresos por categoría</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {fixedExpenses.map(exp => (
                        <div key={exp.id} className="breakdown-item">
                          <div className="breakdown-label-row">
                            <span className="breakdown-label">{exp.name} <span className="badge badge-gray">{exp.category}</span></span>
                            <span className="breakdown-value" style={{ color: 'var(--red)' }}>{fmt(exp.amount)}</span>
                          </div>
                          <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${(exp.amount / (totalFixedExpenses || 1)) * 100}%`, background: 'var(--red)' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ===================== PROJECTIONS TAB ===================== */}
        {currentTab === 'projections' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="card" style={{ padding: '20px 24px' }}>
              <div className="section-title">📅 Proyección hasta el fin de tus deudas</div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                {projections.length} meses proyectados ·{' '}
                {debts.length > 0
                  ? `Libre de deudas estimado: ${projections.find(p => p.isDebtFree)?.label || projections[projections.length - 1]?.label}`
                  : 'Sin deudas activas'}
              </p>
            </div>

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
                          <span className="badge badge-green" style={{ marginTop: '4px' }}>🎉 Libre de deudas</span>
                        )}
                      </td>
                      <td className="text-right">
                        <span className="proj-amount green">{fmt(proj.incomes)}</span>
                      </td>
                      <td className="text-right">
                        <span className="proj-amount red">{fmt(proj.fixedExpenses)}</span>
                      </td>
                      <td className="text-right">
                        {proj.debtsQuota > 0
                          ? <span className="proj-amount orange">{fmt(proj.debtsQuota)}</span>
                          : <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                        }
                      </td>
                      <td className="text-right">
                        <span className={`proj-amount ${proj.cashFlow >= 0 ? 'green' : 'red'}`}>
                          {proj.cashFlow >= 0 ? '+' : ''}{fmt(proj.cashFlow)}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {proj.debtItems.length === 0
                            ? <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Sin cuotas</span>
                            : proj.debtItems.map((d, j) => (
                              <div key={j} style={{ fontSize: '0.78rem' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>{d.name}: </span>
                                <span style={{ color: 'var(--orange)', fontWeight: 700 }}>{fmt(d.quota)}</span>
                                {d.payment_day && (
                                  <span className="badge badge-gray" style={{ marginLeft: '4px', fontSize: '0.65rem' }}>día {d.payment_day}</span>
                                )}
                              </div>
                            ))
                          }
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ============================================================
          MODALS
          ============================================================ */}

      {/* Income Modal */}
      {showIncomeModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowIncomeModal(false); }}>
          <div className="modal-content">
            <div className="modal-header">
              <div className="modal-title">Agregar ingreso</div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowIncomeModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={addIncome}>
              <div className="form-group">
                <label>Nombre / Fuente</label>
                <input type="text" className="form-control" placeholder="Ej. Salario, Freelance" value={incomeForm.name} onChange={e => setIncomeForm({ ...incomeForm, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Valor ($)</label>
                <input type="number" className="form-control" placeholder="Ej. 3500000" value={incomeForm.amount} onChange={e => setIncomeForm({ ...incomeForm, amount: e.target.value })} required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Mes</label>
                  <select className="form-control" value={incomeForm.month} onChange={e => setIncomeForm({ ...incomeForm, month: parseInt(e.target.value) })}>
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString('es-ES', { month: 'long' })}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Año</label>
                  <input type="number" className="form-control" value={incomeForm.year} onChange={e => setIncomeForm({ ...incomeForm, year: parseInt(e.target.value) })} required />
                </div>
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
              <div className="modal-title">Agregar egreso fijo</div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowExpenseModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={addExpense}>
              <div className="form-group">
                <label>Concepto</label>
                <input type="text" className="form-control" placeholder="Ej. Arriendo, Servicios" value={expenseForm.name} onChange={e => setExpenseForm({ ...expenseForm, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Valor ($)</label>
                <input type="number" className="form-control" placeholder="Ej. 800000" value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Categoría</label>
                <select className="form-control" value={expenseForm.category} onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })}>
                  {['Vivienda', 'Servicios', 'Alimentación', 'Transporte', 'Suscripciones', 'Salud', 'Educación', 'Otros'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
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

      {/* Debt Modal (Add) */}
      {showDebtModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowDebtModal(false); }}>
          <div className="modal-content">
            <div className="modal-header">
              <div className="modal-title">Agregar deuda / cuota</div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowDebtModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={addDebt}>
              <div className="form-group">
                <label>Nombre de la deuda</label>
                <input type="text" className="form-control" placeholder="Ej. Tarjeta Visa — Computador" value={debtForm.name} onChange={e => setDebtForm({ ...debtForm, name: e.target.value })} required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Monto financiado ($)</label>
                  <input type="number" className="form-control" placeholder="Ej. 1200000" value={debtForm.total_capital} onChange={e => setDebtForm({ ...debtForm, total_capital: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Cuotas totales</label>
                  <input type="number" className="form-control" placeholder="Ej. 12" value={debtForm.total_installments} onChange={e => setDebtForm({ ...debtForm, total_installments: e.target.value })} required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Cuotas ya pagadas</label>
                  <input type="number" className="form-control" placeholder="0" value={debtForm.installments_paid} onChange={e => setDebtForm({ ...debtForm, installments_paid: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Fecha de compra</label>
                  <input type="date" className="form-control" value={debtForm.start_date} onChange={e => setDebtForm({ ...debtForm, start_date: e.target.value })} required />
                </div>
              </div>

              <div className="form-group">
                <div className="switch-group" onClick={() => setDebtForm({ ...debtForm, has_interest: !debtForm.has_interest })}>
                  <span className="switch">
                    <input type="checkbox" checked={debtForm.has_interest} onChange={() => {}} />
                    <span className="slider"></span>
                  </span>
                  <span>¿Tiene intereses mensuales?</span>
                </div>
              </div>

              {debtForm.has_interest && (
                <div className="form-group">
                  <label>Tasa mensual (%)</label>
                  <input type="number" step="0.01" className="form-control" placeholder="Ej. 1.8" value={debtForm.monthly_interest_rate} onChange={e => setDebtForm({ ...debtForm, monthly_interest_rate: e.target.value })} />
                </div>
              )}

              <div style={{ borderTop: '1px solid var(--divider)', paddingTop: '16px', marginTop: '4px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  💳 <strong>Ciclo de facturación</strong> — Opcional, para tarjetas de crédito
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Día de corte</label>
                    <input type="number" min="1" max="31" className="form-control" placeholder="Ej. 25" value={debtForm.cutoff_day} onChange={e => setDebtForm({ ...debtForm, cutoff_day: e.target.value })} />
                    <div className="form-hint">Día en que cierra el ciclo</div>
                  </div>
                  <div className="form-group">
                    <label>Día de pago</label>
                    <input type="number" min="1" max="31" className="form-control" placeholder="Ej. 30" value={debtForm.payment_day} onChange={e => setDebtForm({ ...debtForm, payment_day: e.target.value })} />
                    <div className="form-hint">Día en que pagas</div>
                  </div>
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
              <div className="modal-title">Editar — {editingDebt.name}</div>
              <button className="btn btn-ghost btn-icon" onClick={() => setEditingDebt(null)}><X size={16} /></button>
            </div>
            <form onSubmit={saveEditDebt}>
              <div className="form-group">
                <label>Nombre</label>
                <input type="text" className="form-control" value={editDebtForm.name} onChange={e => setEditDebtForm({ ...editDebtForm, name: e.target.value })} required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Capital total ($)</label>
                  <input type="number" className="form-control" value={editDebtForm.total_capital} onChange={e => setEditDebtForm({ ...editDebtForm, total_capital: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Cuotas totales</label>
                  <input type="number" className="form-control" value={editDebtForm.total_installments} onChange={e => setEditDebtForm({ ...editDebtForm, total_installments: e.target.value })} required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Cuotas pagadas</label>
                  <input type="number" className="form-control" value={editDebtForm.installments_paid} onChange={e => setEditDebtForm({ ...editDebtForm, installments_paid: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Fecha de compra</label>
                  <input type="date" className="form-control" value={editDebtForm.start_date} onChange={e => setEditDebtForm({ ...editDebtForm, start_date: e.target.value })} required />
                </div>
              </div>
              <div className="form-group">
                <div className="switch-group" onClick={() => setEditDebtForm({ ...editDebtForm, has_interest: !editDebtForm.has_interest })}>
                  <span className="switch">
                    <input type="checkbox" checked={editDebtForm.has_interest} onChange={() => {}} />
                    <span className="slider"></span>
                  </span>
                  <span>¿Tiene intereses?</span>
                </div>
              </div>
              {editDebtForm.has_interest && (
                <div className="form-group">
                  <label>Tasa mensual (%)</label>
                  <input type="number" step="0.01" className="form-control" value={editDebtForm.monthly_interest_rate} onChange={e => setEditDebtForm({ ...editDebtForm, monthly_interest_rate: e.target.value })} />
                </div>
              )}
              <div className="form-row">
                <div className="form-group">
                  <label>Día de corte</label>
                  <input type="number" min="1" max="31" className="form-control" placeholder="Ej. 25" value={editDebtForm.cutoff_day} onChange={e => setEditDebtForm({ ...editDebtForm, cutoff_day: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Día de pago</label>
                  <input type="number" min="1" max="31" className="form-control" placeholder="Ej. 30" value={editDebtForm.payment_day} onChange={e => setEditDebtForm({ ...editDebtForm, payment_day: e.target.value })} />
                </div>
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
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {fmt(amortDebt.total_capital)} · {amortDebt.total_installments} cuotas · {amortDebt.has_interest ? `${amortDebt.monthly_interest_rate}% mensual` : 'Sin interés'}
                </div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setAmortDebt(null)}><X size={16} /></button>
            </div>

            <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid var(--border)' }}>
              <table className="amort-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Capital</th>
                    <th>Interés</th>
                    <th>Cuota total</th>
                    <th>Saldo</th>
                    <th>Estado</th>
                  </tr>
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
                          ? <span className="badge badge-green">✅ Pagada</span>
                          : row.isNext
                            ? <span className="badge badge-orange">⏳ Próxima</span>
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
