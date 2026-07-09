'use client';

import { useState, useEffect } from 'react';
import { db, Income, FixedExpense, Debt } from '@/lib/db';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar, 
  Trash2, 
  Plus, 
  LogOut, 
  Lock, 
  Mail, 
  UserPlus, 
  RefreshCw, 
  Info,
  ChevronRight,
  TrendingUp as ProjIcon,
  Sun,
  Moon
} from 'lucide-react';

export default function Home() {
  // Auth state
  const [user, setUser] = useState<any>(null);
  const [spaceId, setSpaceId] = useState<string>('');
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [customSpaceId, setCustomSpaceId] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  // App state
  const [loading, setLoading] = useState<boolean>(true);
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'projections'>('dashboard');
  
  // Data state
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);

  // Modals state
  const [showIncomeModal, setShowIncomeModal] = useState<boolean>(false);
  const [showExpenseModal, setShowExpenseModal] = useState<boolean>(false);
  const [showDebtModal, setShowDebtModal] = useState<boolean>(false);

  // Form states
  const [incomeForm, setIncomeForm] = useState({ name: '', amount: '', month: new Date().getMonth() + 1, year: new Date().getFullYear() });
  const [expenseForm, setExpenseForm] = useState({ name: '', amount: '', category: 'Vivienda' });
  const [debtForm, setDebtForm] = useState({ 
    name: '', 
    total_capital: '', 
    monthly_interest_rate: '0', 
    total_installments: '12', 
    installments_paid: '0',
    has_interest: false,
    start_date: new Date().toISOString().split('T')[0],
    cutoff_day: '',   // Día de corte (ej: 25)
    payment_day: ''   // Día de pago (ej: 30)
  });

  // Theme state – persists in localStorage
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const saved = (typeof window !== 'undefined' && localStorage.getItem('fp-theme')) as 'dark' | 'light' | null;
    if (saved === 'light' || saved === 'dark') setTheme(saved);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (typeof window !== 'undefined') localStorage.setItem('fp-theme', theme);
  }, [theme]);

  // Load user session
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const currentUser = await db.auth.getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
        setSpaceId(currentUser.space_id);
        fetchData(currentUser.space_id);
      } else {
        setLoading(false);
      }
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const fetchData = async (sId: string) => {
    setLoading(true);
    try {
      const [incList, expList, debtList] = await Promise.all([
        db.incomes.list(sId),
        db.fixedExpenses.list(sId),
        db.debts.list(sId)
      ]);
      setIncomes(incList);
      setFixedExpenses(expList);
      setDebts(debtList);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      if (isLogin) {
        const { user: u, space_id } = await db.auth.signIn(email, password);
        setUser(u);
        setSpaceId(space_id || '');
        fetchData(space_id || '');
      } else {
        const { user: u, space_id } = await db.auth.signUp(email, password, customSpaceId || undefined);
        setUser(u);
        setSpaceId(space_id || '');
        fetchData(space_id || '');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Error de autenticación.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await db.auth.signOut();
    setUser(null);
    setSpaceId('');
    setIncomes([]);
    setFixedExpenses([]);
    setDebts([]);
  };

  // Mutators
  const addIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incomeForm.name || !incomeForm.amount) return;
    try {
      await db.incomes.create({
        space_id: spaceId,
        name: incomeForm.name,
        amount: parseFloat(incomeForm.amount),
        month: parseInt(incomeForm.month.toString()),
        year: parseInt(incomeForm.year.toString())
      });
      setShowIncomeModal(false);
      setIncomeForm({ name: '', amount: '', month: new Date().getMonth() + 1, year: new Date().getFullYear() });
      fetchData(spaceId);
    } catch (err: any) {
      console.error(err);
      alert('Error al agregar ingreso: ' + (err.message || 'Error desconocido de base de datos.'));
    }
  };

  const addExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.name || !expenseForm.amount) return;
    try {
      await db.fixedExpenses.create({
        space_id: spaceId,
        name: expenseForm.name,
        amount: parseFloat(expenseForm.amount),
        category: expenseForm.category
      });
      setShowExpenseModal(false);
      setExpenseForm({ name: '', amount: '', category: 'Vivienda' });
      fetchData(spaceId);
    } catch (err: any) {
      console.error(err);
      alert('Error al agregar egreso fijo: ' + (err.message || 'Error desconocido de base de datos.'));
    }
  };

  const addDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!debtForm.name || !debtForm.total_capital || !debtForm.total_installments) return;
    try {
      const capital = parseFloat(debtForm.total_capital);
      const installments = parseInt(debtForm.total_installments);
      const fixed_capital_payment = capital / installments;
      
      await db.debts.create({
        space_id: spaceId,
        name: debtForm.name,
        total_capital: capital,
        monthly_interest_rate: debtForm.has_interest ? parseFloat(debtForm.monthly_interest_rate) : 0,
        total_installments: installments,
        installments_paid: parseInt(debtForm.installments_paid),
        fixed_capital_payment,
        start_date: debtForm.start_date,
        has_interest: debtForm.has_interest,
        cutoff_day: debtForm.cutoff_day ? parseInt(debtForm.cutoff_day) : null,
        payment_day: debtForm.payment_day ? parseInt(debtForm.payment_day) : null,
      });
      setShowDebtModal(false);
      setDebtForm({
        name: '',
        total_capital: '',
        monthly_interest_rate: '0',
        total_installments: '12',
        installments_paid: '0',
        has_interest: false,
        start_date: new Date().toISOString().split('T')[0],
        cutoff_day: '',
        payment_day: ''
      });
      fetchData(spaceId);
    } catch (err: any) {
      console.error(err);
      alert('Error al agregar deuda: ' + (err.message || 'Error desconocido de base de datos.'));
    }
  };

  const deleteIncome = async (id: string) => {
    if (confirm('¿Eliminar este ingreso?')) {
      await db.incomes.delete(id);
      fetchData(spaceId);
    }
  };

  const deleteExpense = async (id: string) => {
    if (confirm('¿Eliminar este egreso fijo?')) {
      await db.fixedExpenses.delete(id);
      fetchData(spaceId);
    }
  };

  const deleteDebt = async (id: string) => {
    if (confirm('¿Eliminar esta deuda?')) {
      await db.debts.delete(id);
      fetchData(spaceId);
    }
  };

  const updateDebtPaidInstallments = async (id: string, currentPaid: number, change: number) => {
    const newVal = Math.max(0, currentPaid + change);
    await db.debts.updateInstallments(id, newVal);
    fetchData(spaceId);
  };

  // Financial calculations
  const totalIncomes = incomes.reduce((acc, curr) => acc + curr.amount, 0);
  const totalFixedExpenses = fixedExpenses.reduce((acc, curr) => acc + curr.amount, 0);
  
  // Calculate active debts for this current month
  const activeDebtsDetails = debts.map(debt => {
    const isCompleted = debt.installments_paid >= debt.total_installments;
    if (isCompleted) return { ...debt, currentInterest: 0, currentQuota: 0, currentCapital: 0, remainingBalanceBefore: 0 };
    
    // Alemana method logic
    const nextInstallmentNum = debt.installments_paid + 1;
    const remainingBalance = debt.total_capital - (debt.installments_paid * debt.fixed_capital_payment);
    const currentInterest = debt.has_interest 
      ? remainingBalance * (debt.monthly_interest_rate / 100)
      : 0;
    const currentQuota = debt.fixed_capital_payment + currentInterest;
    
    return {
      ...debt,
      currentInterest,
      currentCapital: debt.fixed_capital_payment,
      currentQuota,
      remainingBalanceBefore: remainingBalance
    };
  });

  const totalCurrentDebtsQuota = activeDebtsDetails.reduce((acc, curr) => acc + curr.currentQuota, 0);
  const freeCashFlow = totalIncomes - totalFixedExpenses - totalCurrentDebtsQuota;

  // Projections Logic
  const getProjections = () => {
    const months = [];
    const currentDate = new Date();
    const todayDay = currentDate.getDate(); // día actual del mes (ej: 9)
    
    let currentIncomesBase = totalIncomes;
    
    for (let i = 0; i < 12; i++) {
      const simDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
      const monthName = simDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
      
      // Calculate debts active in this simulated month
      let simulatedDebtsQuota = 0;
      const simulatedDebtsList = debts.map(debt => {
        const start = new Date(debt.start_date);

        // --- Billing cycle shift ---
        // If this debt has a cutoff_day, we need to determine in which calendar month
        // the payment actually falls. The rule:
        //   • If the PURCHASE date's day > cutoff_day → the first billing cycle closes
        //     the NEXT month after the purchase month, so we add 1 month to the "clock".
        //   • Additionally, when iterating simulated months (i=0 = this month),
        //     if today's day > cutoff_day the CURRENT cycle has already closed, meaning
        //     the next payment will appear in the month that contains the payment_day.
        let billingOffset = 0;
        if (debt.cutoff_day) {
          // If start date day is after cutoff, first payment is pushed to +1 month
          if (start.getDate() > debt.cutoff_day) {
            billingOffset = 1;
          }
          // For the very first simulated month (current month):
          // if today we're already past the cutoff, this month's cycle is closed,
          // the next payment is for NEXT month's cycle → shift forward 1 extra month.
          if (i === 0 && todayDay > debt.cutoff_day) {
            billingOffset += 1;
          }
        }

        const adjustedStart = new Date(start.getFullYear(), start.getMonth() + billingOffset, 1);
        const diffMonths = (simDate.getFullYear() - adjustedStart.getFullYear()) * 12 + (simDate.getMonth() - adjustedStart.getMonth());
        
        // If the simulation is before the adjusted start or past total installments
        if (diffMonths < 0 || diffMonths >= debt.total_installments) {
          return { name: debt.name, quota: 0, remaining: 0, cutoff_day: debt.cutoff_day, payment_day: debt.payment_day };
        }
        
        const remainingBefore = debt.total_capital - (diffMonths * debt.fixed_capital_payment);
        const interest = debt.has_interest ? remainingBefore * (debt.monthly_interest_rate / 100) : 0;
        const quota = debt.fixed_capital_payment + interest;
        simulatedDebtsQuota += quota;
        
        return {
          name: debt.name,
          quota,
          remaining: remainingBefore - debt.fixed_capital_payment,
          cutoff_day: debt.cutoff_day,
          payment_day: debt.payment_day,
        };
      });

      const totalExpenses = totalFixedExpenses + simulatedDebtsQuota;
      const cashFlow = currentIncomesBase - totalExpenses;

      months.push({
        monthName,
        incomes: currentIncomesBase,
        fixedExpenses: totalFixedExpenses,
        debtsQuota: simulatedDebtsQuota,
        totalExpenses,
        cashFlow,
        debts: simulatedDebtsList.filter(d => d.quota > 0)
      });
    }
    return months;
  };


  const projections = getProjections();

  if (loading && !user) {
    return (
      <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <RefreshCw size={48} className="text-primary" style={{ animation: 'spin 1.5s linear infinite' }} />
        <style jsx global>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // --- Auth View ---
  if (!user) {
    return (
      <div className="auth-wrapper" style={{ marginTop: '10vh' }}>
        <div className="auth-card glass-panel">
          <div className="auth-header">
            <h1 className="logo" style={{ justifyContent: 'center', fontSize: '2rem' }}>
              💰 Finanzas Pro
            </h1>
            <p>{isLogin ? 'Inicia sesión para administrar las finanzas' : 'Regístrate y crea un espacio compartido'}</p>
          </div>

          {authError && (
            <div style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', marginBottom: '16px', fontSize: '0.85rem' }}>
              {authError}
            </div>
          )}

          <form onSubmit={handleAuth}>
            <div className="form-group">
              <label>Correo Electrónico</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: '12px', top: '15px', color: 'var(--text-secondary)' }} />
                <input 
                  type="email" 
                  className="form-control" 
                  style={{ paddingLeft: '38px' }} 
                  placeholder="ejemplo@correo.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                />
              </div>
            </div>

            <div className="form-group">
              <label>Contraseña</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '12px', top: '15px', color: 'var(--text-secondary)' }} />
                <input 
                  type="password" 
                  className="form-control" 
                  style={{ paddingLeft: '38px' }} 
                  placeholder="••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                />
              </div>
            </div>

            {!isLogin && (
              <div className="form-group">
                <label>ID de Espacio Compartido (Opcional)</label>
                <div style={{ position: 'relative' }}>
                  <UserPlus size={16} style={{ position: 'absolute', left: '12px', top: '15px', color: 'var(--text-secondary)' }} />
                  <input 
                    type="text" 
                    className="form-control" 
                    style={{ paddingLeft: '38px' }} 
                    placeholder="Pegar código de tu pareja para unirse" 
                    value={customSpaceId}
                    onChange={(e) => setCustomSpaceId(e.target.value)}
                  />
                </div>
                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px', textAlign: 'left' }}>
                  Déjalo en blanco para crear un nuevo espacio. Luego compártele el código a tu pareja.
                </small>
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '16px' }} disabled={authLoading}>
              {authLoading ? <RefreshCw size={16} style={{ animation: 'spin 1.5s linear infinite' }} /> : (isLogin ? 'Ingresar' : 'Registrarse')}
            </button>
          </form>

          <div style={{ marginTop: '24px', borderTop: '1px solid var(--panel-border)', paddingTop: '20px' }}>
            <button 
              type="button" 
              onClick={() => { setIsLogin(!isLogin); setAuthError(''); }}
              style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontWeight: 500, fontSize: '0.9rem' }}
            >
              {isLogin ? '¿No tienes cuenta? Regístrate gratis' : '¿Ya tienes cuenta? Inicia sesión'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Main App Dashboard ---
  return (
    <>
      {/* Header */}
      <header className="main-header">
        <div className="logo">
          <span>💰</span> Finanzas Pro
        </div>
        <div className="nav-links">
          <button 
            className={`nav-link ${currentTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentTab('dashboard')}
          >
            Dashboard
          </button>
          <button 
            className={`nav-link ${currentTab === 'projections' ? 'active' : ''}`}
            onClick={() => setCurrentTab('projections')}
          >
            Proyecciones de Cuotas
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Theme Toggle */}
          <button
            id="theme-toggle"
            onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            className="btn btn-secondary btn-sm"
            style={{ padding: '8px', borderRadius: '50%', width: '36px', height: '36px' }}
            title={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <div className="shared-space-badge">
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Espacio Familiar:</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'monospace', cursor: 'pointer' }} onClick={() => { navigator.clipboard.writeText(spaceId); alert('ID de Espacio copiado al portapapeles.'); }} title="Haz clic para copiar">
              {spaceId.substring(0, 8)}... (copiar)
            </div>
          </div>
          <button onClick={handleSignOut} className="btn btn-secondary btn-sm" style={{ padding: '8px' }}>
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-container">
        {/* Executive Summary */}
        <section className="summary-grid">
          <div className="glass-panel summary-card">
            <span className="card-label"><TrendingUp size={16} className="text-success" /> Ingresos Mensuales</span>
            <span className="card-value income">${totalIncomes.toLocaleString('es-ES')}</span>
          </div>
          
          <div className="glass-panel summary-card">
            <span className="card-label"><TrendingDown size={16} className="text-danger" /> Egresos Fijos</span>
            <span className="card-value expense">${totalFixedExpenses.toLocaleString('es-ES')}</span>
          </div>

          <div className="glass-panel summary-card">
            <span className="card-label"><Calendar size={16} style={{ color: 'var(--accent-warning)' }} /> Cuota Deudas (Mes)</span>
            <span className="card-value expense">${totalCurrentDebtsQuota.toLocaleString('es-ES')}</span>
          </div>

          <div className="glass-panel summary-card" style={{ background: 'rgba(139, 92, 246, 0.1)' }}>
            <span className="card-label"><DollarSign size={16} className="text-success" /> Flujo de Caja Libre</span>
            <span className="card-value flow">${freeCashFlow.toLocaleString('es-ES')}</span>
          </div>
        </section>

        {currentTab === 'dashboard' ? (
          /* Dashboard Tab */
          <div className="dashboard-grid">
            {/* Left side: Main tables */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Incomes Panel */}
              <div className="glass-panel">
                <div className="flex-between" style={{ marginBottom: '16px' }}>
                  <h2>Ingresos</h2>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowIncomeModal(true)}>
                    <Plus size={16} /> Agregar
                  </button>
                </div>

                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Concepto</th>
                        <th>Fecha/Periodo</th>
                        <th className="text-right">Monto</th>
                        <th style={{ width: '50px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {incomes.length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Sin ingresos registrados</td>
                        </tr>
                      ) : (
                        incomes.map(inc => (
                          <tr key={inc.id}>
                            <td style={{ fontWeight: 500 }}>{inc.name}</td>
                            <td><span className="month-badge">{inc.month}/{inc.year}</span></td>
                            <td className="text-right text-success" style={{ fontWeight: 600 }}>
                              ${inc.amount.toLocaleString('es-ES')}
                            </td>
                            <td>
                              <button onClick={() => deleteIncome(inc.id)} className="btn btn-danger btn-sm" style={{ padding: '6px' }}>
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Fixed Expenses Panel */}
              <div className="glass-panel">
                <div className="flex-between" style={{ marginBottom: '16px' }}>
                  <h2>Egresos Fijos</h2>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowExpenseModal(true)}>
                    <Plus size={16} /> Agregar
                  </button>
                </div>

                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Concepto</th>
                        <th>Categoría</th>
                        <th className="text-right">Monto</th>
                        <th style={{ width: '50px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {fixedExpenses.length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Sin egresos fijos registrados</td>
                        </tr>
                      ) : (
                        fixedExpenses.map(exp => (
                          <tr key={exp.id}>
                            <td style={{ fontWeight: 500 }}>{exp.name}</td>
                            <td>
                              <span style={{ fontSize: '0.8rem', padding: '4px 8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}>
                                {exp.category}
                              </span>
                            </td>
                            <td className="text-right text-danger" style={{ fontWeight: 600 }}>
                              ${exp.amount.toLocaleString('es-ES')}
                            </td>
                            <td>
                              <button onClick={() => deleteExpense(exp.id)} className="btn btn-danger btn-sm" style={{ padding: '6px' }}>
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financed Debts Panel */}
              <div className="glass-panel">
                <div className="flex-between" style={{ marginBottom: '16px' }}>
                  <div>
                    <h2>Deudas Financiadas</h2>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Método de cuota decreciente (Amortización Alemana)</p>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowDebtModal(true)}>
                    <Plus size={16} /> Agregar Deuda
                  </button>
                </div>

                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Nombre Deuda</th>
                        <th>Total Capital</th>
                        <th>Tasa Interés</th>
                        <th>Progreso Cuotas</th>
                        <th className="text-right">Valor Cuota Actual</th>
                        <th className="text-right">Saldo Restante</th>
                        <th style={{ width: '100px' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeDebtsDetails.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Sin deudas registradas</td>
                        </tr>
                      ) : (
                        activeDebtsDetails.map(debt => (
                          <tr key={debt.id} style={{ opacity: debt.installments_paid >= debt.total_installments ? 0.5 : 1 }}>
                            <td style={{ fontWeight: 500 }}>
                              <div>{debt.name}</div>
                              {(debt.cutoff_day || debt.payment_day) && (
                                <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                                  {debt.cutoff_day && (
                                    <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24', borderRadius: '4px', border: '1px solid rgba(245,158,11,0.2)' }}>
                                      ✂️ Corte: día {debt.cutoff_day}
                                    </span>
                                  )}
                                  {debt.payment_day && (
                                    <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: 'rgba(139, 92, 246, 0.12)', color: '#c084fc', borderRadius: '4px', border: '1px solid rgba(139,92,246,0.2)' }}>
                                      💳 Pago: día {debt.payment_day}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td>${debt.total_capital.toLocaleString('es-ES')}</td>
                            <td>{debt.has_interest ? `${debt.monthly_interest_rate}%` : 'Sin interés'}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <button 
                                  onClick={() => updateDebtPaidInstallments(debt.id, debt.installments_paid, -1)} 
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '2px 6px', fontSize: '0.75rem' }}
                                >
                                  -
                                </button>
                                <span>{debt.installments_paid}/{debt.total_installments}</span>
                                <button 
                                  onClick={() => updateDebtPaidInstallments(debt.id, debt.installments_paid, 1)} 
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '2px 6px', fontSize: '0.75rem' }}
                                  disabled={debt.installments_paid >= debt.total_installments}
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td className="text-right text-danger" style={{ fontWeight: 600 }}>
                              ${(debt.currentQuota || 0).toLocaleString('es-ES')}
                            </td>
                            <td className="text-right" style={{ fontWeight: 500 }}>
                              ${((debt.installments_paid >= debt.total_installments) ? 0 : (debt.remainingBalanceBefore || 0) - (debt.currentCapital || 0)).toLocaleString('es-ES')}
                            </td>
                            <td>
                              <button onClick={() => deleteDebt(debt.id)} className="btn btn-danger btn-sm" style={{ padding: '6px' }}>
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* Right side: Charts and Breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Financial Breakdown / Mini Graphic */}
              <div className="glass-panel">
                <h2>Distribución del Mes</h2>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '20px' }}>
                  <div>
                    <div className="flex-between" style={{ fontSize: '0.85rem', marginBottom: '6px' }}>
                      <span>Egresos Fijos ({((totalFixedExpenses / (totalIncomes || 1)) * 100).toFixed(0)}%)</span>
                      <span className="text-danger">${totalFixedExpenses.toLocaleString('es-ES')}</span>
                    </div>
                    <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, (totalFixedExpenses / (totalIncomes || 1)) * 100)}%`, background: 'var(--accent-danger)' }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex-between" style={{ fontSize: '0.85rem', marginBottom: '6px' }}>
                      <span>Deudas ({((totalCurrentDebtsQuota / (totalIncomes || 1)) * 100).toFixed(0)}%)</span>
                      <span className="text-danger">${totalCurrentDebtsQuota.toLocaleString('es-ES')}</span>
                    </div>
                    <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, (totalCurrentDebtsQuota / (totalIncomes || 1)) * 100)}%`, background: 'var(--accent-warning)' }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex-between" style={{ fontSize: '0.85rem', marginBottom: '6px' }}>
                      <span>Flujo de Caja Disponible ({((freeCashFlow / (totalIncomes || 1)) * 100).toFixed(0)}%)</span>
                      <span className="text-success">${freeCashFlow.toLocaleString('es-ES')}</span>
                    </div>
                    <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, (freeCashFlow / (totalIncomes || 1)) * 100))}%`, background: 'var(--accent-success)' }}></div>
                    </div>
                  </div>
                </div>

                {/* SVG Visual comparison */}
                <div className="graph-container" style={{ marginTop: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <svg width="220" height="220" viewBox="0 0 200 200">
                    <circle cx="100" cy="100" r="80" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="15" />
                    
                    {/* Ring for Free Cash Flow */}
                    <circle 
                      cx="100" 
                      cy="100" 
                      r="80" 
                      fill="none" 
                      stroke="var(--accent-success)" 
                      strokeWidth="15" 
                      strokeDasharray={`${Math.max(0, (freeCashFlow / (totalIncomes || 1)) * 502)} 502`} 
                      transform="rotate(-90 100 100)"
                      style={{ transition: 'stroke-dasharray 1s ease' }}
                    />
                    
                    {/* Ring for expenses */}
                    <circle 
                      cx="100" 
                      cy="100" 
                      r="80" 
                      fill="none" 
                      stroke="var(--accent-danger)" 
                      strokeWidth="15" 
                      strokeDasharray={`${((totalFixedExpenses + totalCurrentDebtsQuota) / (totalIncomes || 1)) * 502} 502`} 
                      transform={`rotate(${(freeCashFlow / (totalIncomes || 1)) * 360 - 90} 100 100)`}
                      style={{ transition: 'stroke-dasharray 1s ease' }}
                    />

                    <text x="100" y="95" textAnchor="middle" fill="var(--text-secondary)" fontSize="12">Disponible</text>
                    <text x="100" y="120" textAnchor="middle" fill="var(--text-primary)" fontSize="20" fontWeight="bold">
                      {((freeCashFlow / (totalIncomes || 1)) * 100).toFixed(0)}%
                    </text>
                  </svg>
                </div>
              </div>

              {/* Shared couple note */}
              <div className="glass-panel" style={{ background: 'linear-gradient(135deg, rgba(236,72,153,0.05) 0%, rgba(139,92,246,0.05) 100%)' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <Info style={{ color: 'var(--accent-secondary)' }} size={24} />
                  <div>
                    <h4 style={{ color: 'var(--accent-secondary)' }}>Administración en Pareja</h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Comparte el ID del espacio con tu novia para que se registre usándolo. Ambos verán y editarán estas mismas tablas en tiempo real.
                    </p>
                    <div style={{ marginTop: '12px', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '4px', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                      {spaceId}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        ) : (
          /* Projections Tab */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="glass-panel">
              <div className="flex-between" style={{ marginBottom: '16px' }}>
                <div>
                  <h2>Proyección a 12 Meses</h2>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Cálculo dinámico basado en la amortización de tus cuotas restantes</p>
                </div>
              </div>

              {/* Dynamic projections line chart using SVG */}
              <div className="graph-container" style={{ height: '300px' }}>
                <svg width="100%" height="100%" viewBox="0 0 1000 300" preserveAspectRatio="none">
                  {/* Grid Lines */}
                  <line x1="50" y1="50" x2="950" y2="50" stroke="rgba(255,255,255,0.05)" />
                  <line x1="50" y1="125" x2="950" y2="125" stroke="rgba(255,255,255,0.05)" />
                  <line x1="50" y1="200" x2="950" y2="200" stroke="rgba(255,255,255,0.05)" />
                  <line x1="50" y1="250" x2="950" y2="250" stroke="rgba(255,255,255,0.1)" />

                  {/* Math mapping function for heights */}
                  {(() => {
                    const maxFlow = Math.max(...projections.map(p => p.cashFlow), 1);
                    const minFlow = Math.min(...projections.map(p => p.cashFlow), 0);
                    const range = maxFlow - minFlow || 1;
                    
                    const points = projections.map((proj, idx) => {
                      const x = 50 + (idx * (900 / 11));
                      // Normalize y to range 50 - 250
                      const y = 250 - ((proj.cashFlow - minFlow) / range) * 200;
                      return { x, y, flow: proj.cashFlow, month: proj.monthName.split(' ')[0] };
                    });

                    // Build line path
                    const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

                    return (
                      <>
                        {/* Line path */}
                        <path d={d} fill="none" stroke="var(--accent-success)" strokeWidth="4" style={{ transition: 'all 0.5s ease' }} />
                        
                        {/* Dots */}
                        {points.map((p, idx) => (
                          <g key={idx}>
                            <circle cx={p.x} cy={p.y} r="6" fill="#10b981" stroke="#fff" strokeWidth="2" />
                            <text x={p.x} y={p.y - 12} textAnchor="middle" fill="var(--text-primary)" fontSize="10" fontWeight="bold">
                              ${Math.round(p.flow).toLocaleString('es-ES')}
                            </text>
                            <text x={p.x} y="275" textAnchor="middle" fill="var(--text-secondary)" fontSize="10">
                              {p.month.charAt(0).toUpperCase() + p.month.slice(1)}
                            </text>
                          </g>
                        ))}
                      </>
                    );
                  })()}
                </svg>
              </div>

              <div className="table-wrapper" style={{ marginTop: '24px' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Mes Simulado</th>
                      <th className="text-right">Ingresos</th>
                      <th className="text-right">Egresos Fijos</th>
                      <th className="text-right">Cuotas Deudas</th>
                      <th className="text-right">Egresos Totales</th>
                      <th className="text-right">Dinero Disponible</th>
                      <th>Estado de Deudas del Mes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projections.map((proj, idx) => (
                      <tr key={idx}>
                        <td><span className="month-badge" style={{ textTransform: 'capitalize' }}>{proj.monthName}</span></td>
                        <td className="text-right text-success">${proj.incomes.toLocaleString('es-ES')}</td>
                        <td className="text-right text-danger">${proj.fixedExpenses.toLocaleString('es-ES')}</td>
                        <td className="text-right text-danger">${proj.debtsQuota.toLocaleString('es-ES')}</td>
                        <td className="text-right text-danger" style={{ fontWeight: 500 }}>${proj.totalExpenses.toLocaleString('es-ES')}</td>
                        <td className="text-right text-success" style={{ fontWeight: 700, background: 'rgba(16, 185, 129, 0.03)' }}>
                          ${proj.cashFlow.toLocaleString('es-ES')}
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {proj.debts.length === 0 ? (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>🎉 ¡Sin deudas!</span>
                            ) : (
                              proj.debts.map((d, dIdx) => (
                                <div key={dIdx} style={{ fontSize: '0.8rem' }}>
                                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>{d.name}:</span>
                                    <span style={{ color: 'var(--accent-warning)', fontWeight: 600 }}>${Math.round(d.quota).toLocaleString('es-ES')}</span>
                                  </div>
                                  {d.payment_day && (
                                    <div style={{ marginTop: '2px' }}>
                                      <span style={{ fontSize: '0.68rem', padding: '1px 6px', background: 'rgba(139, 92, 246, 0.1)', color: '#a78bfa', borderRadius: '4px' }}>
                                        💳 Vence día {d.payment_day}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* --- Income Modal --- */}
      {showIncomeModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ marginBottom: '20px' }}>Agregar Ingreso</h3>
            <form onSubmit={addIncome}>
              <div className="form-group">
                <label>Concepto / Nombre del ingreso</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Ej. Salario, Trabajo extra" 
                  value={incomeForm.name} 
                  onChange={(e) => setIncomeForm({ ...incomeForm, name: e.target.value })}
                  required 
                />
              </div>
              <div className="form-group">
                <label>Valor ($)</label>
                <input 
                  type="number" 
                  className="form-control" 
                  placeholder="Ej. 1500000" 
                  value={incomeForm.amount} 
                  onChange={(e) => setIncomeForm({ ...incomeForm, amount: e.target.value })}
                  required 
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Mes</label>
                  <select 
                    className="form-control" 
                    value={incomeForm.month}
                    onChange={(e) => setIncomeForm({ ...incomeForm, month: parseInt(e.target.value) })}
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>{i + 1}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Año</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    value={incomeForm.year} 
                    onChange={(e) => setIncomeForm({ ...incomeForm, year: parseInt(e.target.value) })}
                    required 
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowIncomeModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Agregar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Expense Modal --- */}
      {showExpenseModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ marginBottom: '20px' }}>Agregar Egreso Fijo</h3>
            <form onSubmit={addExpense}>
              <div className="form-group">
                <label>Concepto / Nombre del egreso</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Ej. Arriendo, Servicios públicos" 
                  value={expenseForm.name} 
                  onChange={(e) => setExpenseForm({ ...expenseForm, name: e.target.value })}
                  required 
                />
              </div>
              <div className="form-group">
                <label>Valor ($)</label>
                <input 
                  type="number" 
                  className="form-control" 
                  placeholder="Ej. 600000" 
                  value={expenseForm.amount} 
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  required 
                />
              </div>
              <div className="form-group">
                <label>Categoría</label>
                <select 
                  className="form-control" 
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                >
                  <option value="Vivienda">Vivienda (Arriendo, Expensas)</option>
                  <option value="Servicios">Servicios (Agua, Luz, Gas, Internet)</option>
                  <option value="Alimentación">Alimentación</option>
                  <option value="Transporte">Transporte</option>
                  <option value="Suscripciones">Suscripciones (Netflix, Spotify)</option>
                  <option value="Otros">Otros</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowExpenseModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Agregar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Debt Modal --- */}
      {showDebtModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ marginBottom: '20px' }}>Agregar Compra Financiada (Deuda)</h3>
            <form onSubmit={addDebt}>
              <div className="form-group">
                <label>Concepto / Nombre de la compra</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Ej. Computador, Viaje" 
                  value={debtForm.name} 
                  onChange={(e) => setDebtForm({ ...debtForm, name: e.target.value })}
                  required 
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Monto Financiado ($)</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    placeholder="Ej. 1200000" 
                    value={debtForm.total_capital} 
                    onChange={(e) => setDebtForm({ ...debtForm, total_capital: e.target.value })}
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Cuotas Totales</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    placeholder="Ej. 12" 
                    value={debtForm.total_installments} 
                    onChange={(e) => setDebtForm({ ...debtForm, total_installments: e.target.value })}
                    required 
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Cuotas Pagadas</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    value={debtForm.installments_paid} 
                    onChange={(e) => setDebtForm({ ...debtForm, installments_paid: e.target.value })}
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Fecha de Compra</label>
                  <input 
                    type="date" 
                    className="form-control" 
                    value={debtForm.start_date} 
                    onChange={(e) => setDebtForm({ ...debtForm, start_date: e.target.value })}
                    required 
                  />
                </div>
              </div>

              <div className="form-group" style={{ margin: '16px 0' }}>
                <div className="switch-group" onClick={() => setDebtForm({ ...debtForm, has_interest: !debtForm.has_interest })}>
                  <span className="switch">
                    <input 
                      type="checkbox" 
                      checked={debtForm.has_interest} 
                      onChange={() => {}} // Controlled by outer click
                    />
                    <span className="slider"></span>
                  </span>
                  <span>¿Tiene intereses mensuales?</span>
                </div>
              </div>

              {debtForm.has_interest && (
                <div className="form-group">
                  <label>Tasa de Interés Mensual (%)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    className="form-control" 
                    placeholder="Ej. 1.8" 
                    value={debtForm.monthly_interest_rate} 
                    onChange={(e) => setDebtForm({ ...debtForm, monthly_interest_rate: e.target.value })}
                    required={debtForm.has_interest} 
                  />
                </div>
              )}

              {/* Billing cycle fields */}
              <div style={{ borderTop: '1px solid var(--panel-border)', paddingTop: '16px', marginTop: '8px' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '1rem' }}>💳</span>
                  <span><strong style={{ color: 'var(--text-secondary)' }}>Ciclo de facturación</strong> (opcional) — Configura esto si es una tarjeta de crédito para que las proyecciones reflejen el mes correcto de pago.</span>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Día de Corte</label>
                    <input 
                      type="number" 
                      min="1"
                      max="31"
                      className="form-control" 
                      placeholder="Ej. 25" 
                      value={debtForm.cutoff_day} 
                      onChange={(e) => setDebtForm({ ...debtForm, cutoff_day: e.target.value })}
                    />
                    <small style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Día del mes en que cierra el ciclo</small>
                  </div>
                  <div className="form-group">
                    <label>Día de Pago</label>
                    <input 
                      type="number" 
                      min="1"
                      max="31"
                      className="form-control" 
                      placeholder="Ej. 30" 
                      value={debtForm.payment_day} 
                      onChange={(e) => setDebtForm({ ...debtForm, payment_day: e.target.value })}
                    />
                    <small style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Día en que realizas el pago</small>
                  </div>
                </div>
                {debtForm.cutoff_day && debtForm.payment_day && (
                  <div style={{ padding: '10px 14px', background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--accent-primary)' }}>
                    📅 Las cuotas se calcularán considerando que el ciclo cierra el día <strong>{debtForm.cutoff_day}</strong> y pagas el día <strong>{debtForm.payment_day}</strong> del mes siguiente.
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowDebtModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Agregar Deuda</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
