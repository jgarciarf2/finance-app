import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Check if we should use Supabase or local storage mock
const useSupabase = !!(supabaseUrl && supabaseAnonKey);

export const supabase = useSupabase
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;

console.log(
  useSupabase
    ? 'Using Supabase database provider'
    : 'Using localStorage Database Adapter (Demo Mode)'
);

// Types
export interface Profile {
  id: string;
  email: string;
  space_id: string;
}

export interface Income {
  id: string;
  space_id: string;
  name: string;
  amount: number;
  month: number;
  year: number;
}

export interface FixedExpense {
  id: string;
  space_id: string;
  name: string;
  amount: number;
  category: string;
}

export interface Debt {
  id: string;
  space_id: string;
  name: string;
  total_capital: number;
  monthly_interest_rate: number;
  total_installments: number;
  installments_paid: number;
  fixed_capital_payment: number;
  start_date: string;
  has_interest: boolean;
  cutoff_day?: number | null;   // Día de corte de la tarjeta (1-31)
  payment_day?: number | null;  // Día de pago real (1-31)
  card_id?: string | null;      // Referencia a la tarjeta de crédito
}

export interface Card {
  id: string;
  space_id: string;
  name: string;        // Ej. "Visa Bancolombia"
  cutoff_day: number;  // Día en que cierra el ciclo (1-31)
}

export interface Family {
  id: string;
  invite_code: string;
  name: string;
}

export interface FamilyMember {
  id: string;       // user id
  email: string;
  space_id: string;
  family_id: string;
}

export interface MemberSummary {
  member: FamilyMember;
  totalIncome: number;
  totalExpenses: number;
  totalDebtQuota: number;
  freeCashFlow: number;
}

// Generate UUID for mock
const generateUUID = () => {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// Local storage helpers
const getLocalData = (key: string): any[] => {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
};

const setLocalData = (key: string, data: any[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(data));
};

// Database interface wrapper
export const db = {
  isDemo: !useSupabase,

  // Auth Operations
  auth: {
    async signUp(email: string, password: string, spaceIdInput?: string) {
      if (useSupabase && supabase) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        
        const user = data.user;
        if (user) {
          const space_id = spaceIdInput || generateUUID();
          // Insert profile
          const { error: profileError } = await supabase
            .from('profiles')
            .insert([{ id: user.id, email, space_id }]);
          if (profileError) console.error('Error creating profile:', profileError);
          return { user, space_id };
        }
        return { user: null, space_id: null };
      } else {
        // Mock Auth Sign Up
        const users = getLocalData('mock_users');
        if (users.find(u => u.email === email)) {
          throw new Error('El usuario ya existe.');
        }
        const userId = generateUUID();
        const space_id = spaceIdInput || generateUUID();
        const newUser = { id: userId, email, password, space_id };
        users.push(newUser);
        setLocalData('mock_users', users);
        
        const session = { id: userId, email, space_id };
        localStorage.setItem('mock_session', JSON.stringify(session));
        return { user: { id: userId, email }, space_id };
      }
    },

    async signIn(email: string, password: string) {
      if (useSupabase && supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        // Fetch profile to get space_id (using maybeSingle to handle missing profiles gracefully)
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('space_id')
          .eq('id', data.user?.id)
          .maybeSingle();
        
        if (profileError) throw profileError;
        
        let space_id = profile?.space_id;
        if (!space_id && data.user) {
          // If no profile exists, create one on-the-fly
          space_id = generateUUID();
          await supabase
            .from('profiles')
            .insert([{ id: data.user.id, email, space_id }]);
        }
        
        return { user: data.user, space_id: space_id || null };
      } else {
        // Mock Auth Sign In
        const users = getLocalData('mock_users');
        const user = users.find(u => u.email === email && u.password === password);
        if (!user) {
          throw new Error('Credenciales incorrectas.');
        }
        const session = { id: user.id, email: user.email, space_id: user.space_id };
        localStorage.setItem('mock_session', JSON.stringify(session));
        return { user: { id: user.id, email: user.email }, space_id: user.space_id };
      }
    },

    async signOut() {
      if (useSupabase && supabase) {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      } else {
        localStorage.removeItem('mock_session');
      }
    },

    async getCurrentUser() {
      if (typeof window === 'undefined') return null;
      if (useSupabase && supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;
        
        const { data: profile } = await supabase
          .from('profiles')
          .select('space_id')
          .eq('id', user.id)
          .single();
        
        return user ? { id: user.id, email: user.email, space_id: profile?.space_id || '' } : null;
      } else {
        const session = localStorage.getItem('mock_session');
        return session ? JSON.parse(session) : null;
      }
    }
  },

  // Income Operations
  incomes: {
    async list(spaceId: string): Promise<Income[]> {
      if (useSupabase && supabase) {
        const { data, error } = await supabase
          .from('incomes')
          .select('*')
          .eq('space_id', spaceId);
        if (error) throw error;
        return data || [];
      } else {
        return getLocalData('mock_incomes').filter(i => i.space_id === spaceId);
      }
    },

    async create(income: Omit<Income, 'id'>): Promise<Income> {
      const newIncome = { ...income, id: generateUUID() };
      if (useSupabase && supabase) {
        const { data, error } = await supabase
          .from('incomes')
          .insert([newIncome])
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const incomes = getLocalData('mock_incomes');
        incomes.push(newIncome);
        setLocalData('mock_incomes', incomes);
        return newIncome;
      }
    },

    async delete(id: string): Promise<void> {
      if (useSupabase && supabase) {
        const { error } = await supabase
          .from('incomes')
          .delete()
          .eq('id', id);
        if (error) throw error;
      } else {
        const incomes = getLocalData('mock_incomes');
        const filtered = incomes.filter(i => i.id !== id);
        setLocalData('mock_incomes', filtered);
      }
    }
  },

  // Fixed Expenses Operations
  fixedExpenses: {
    async list(spaceId: string): Promise<FixedExpense[]> {
      if (useSupabase && supabase) {
        const { data, error } = await supabase
          .from('fixed_expenses')
          .select('*')
          .eq('space_id', spaceId);
        if (error) throw error;
        return data || [];
      } else {
        return getLocalData('mock_fixed_expenses').filter(e => e.space_id === spaceId);
      }
    },

    async create(expense: Omit<FixedExpense, 'id'>): Promise<FixedExpense> {
      const newExpense = { ...expense, id: generateUUID() };
      if (useSupabase && supabase) {
        const { data, error } = await supabase
          .from('fixed_expenses')
          .insert([newExpense])
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const expenses = getLocalData('mock_fixed_expenses');
        expenses.push(newExpense);
        setLocalData('mock_fixed_expenses', expenses);
        return newExpense;
      }
    },

    async delete(id: string): Promise<void> {
      if (useSupabase && supabase) {
        const { error } = await supabase
          .from('fixed_expenses')
          .delete()
          .eq('id', id);
        if (error) throw error;
      } else {
        const expenses = getLocalData('mock_fixed_expenses');
        const filtered = expenses.filter(e => e.id !== id);
        setLocalData('mock_fixed_expenses', filtered);
      }
    }
  },

  // Debts Operations
  debts: {
    async list(spaceId: string): Promise<Debt[]> {
      if (useSupabase && supabase) {
        const { data, error } = await supabase
          .from('debts')
          .select('*')
          .eq('space_id', spaceId);
        if (error) throw error;
        return data || [];
      } else {
        return getLocalData('mock_debts').filter(d => d.space_id === spaceId);
      }
    },

    async create(debt: Omit<Debt, 'id'>): Promise<Debt> {
      const newDebt = { ...debt, id: generateUUID() };
      if (useSupabase && supabase) {
        const { data, error } = await supabase
          .from('debts')
          .insert([newDebt])
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const debts = getLocalData('mock_debts');
        debts.push(newDebt);
        setLocalData('mock_debts', debts);
        return newDebt;
      }
    },

    async updateInstallments(id: string, paid: number): Promise<void> {
      if (useSupabase && supabase) {
        const { error } = await supabase
          .from('debts')
          .update({ installments_paid: paid })
          .eq('id', id);
        if (error) throw error;
      } else {
        const debts = getLocalData('mock_debts');
        const debt = debts.find(d => d.id === id);
        if (debt) {
          debt.installments_paid = paid;
          setLocalData('mock_debts', debts);
        }
      }
    },

    async update(id: string, data: Partial<Omit<Debt, 'id' | 'space_id'>>): Promise<void> {
      if (useSupabase && supabase) {
        const { error } = await supabase
          .from('debts')
          .update(data)
          .eq('id', id);
        if (error) throw error;
      } else {
        const debts = getLocalData('mock_debts');
        const idx = debts.findIndex(d => d.id === id);
        if (idx !== -1) {
          debts[idx] = { ...debts[idx], ...data };
          setLocalData('mock_debts', debts);
        }
      }
    },

    async delete(id: string): Promise<void> {
      if (useSupabase && supabase) {
        const { error } = await supabase
          .from('debts')
          .delete()
          .eq('id', id);
        if (error) throw error;
      } else {
        const debts = getLocalData('mock_debts');
        const filtered = debts.filter(d => d.id !== id);
        setLocalData('mock_debts', filtered);
      }
    }
  },

  // ── Cards ──────────────────────────────────────────────
  cards: {
    async list(spaceId: string): Promise<Card[]> {
      if (useSupabase && supabase) {
        const { data, error } = await supabase
          .from('cards')
          .select('*')
          .eq('space_id', spaceId)
          .order('name');
        if (error) throw error;
        return data || [];
      } else {
        return getLocalData('mock_cards').filter((c: Card) => c.space_id === spaceId);
      }
    },

    async create(card: Omit<Card, 'id'>): Promise<Card> {
      const newCard = { ...card, id: generateUUID() };
      if (useSupabase && supabase) {
        const { data, error } = await supabase
          .from('cards')
          .insert([newCard])
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const cards = getLocalData('mock_cards');
        cards.push(newCard);
        setLocalData('mock_cards', cards);
        return newCard;
      }
    },

    async update(id: string, data: Partial<Omit<Card, 'id' | 'space_id'>>): Promise<void> {
      if (useSupabase && supabase) {
        const { error } = await supabase
          .from('cards')
          .update(data)
          .eq('id', id);
        if (error) throw error;
      } else {
        const cards = getLocalData('mock_cards');
        const idx = cards.findIndex((c: Card) => c.id === id);
        if (idx !== -1) {
          cards[idx] = { ...cards[idx], ...data };
          setLocalData('mock_cards', cards);
        }
      }
    },

    async delete(id: string): Promise<void> {
      if (useSupabase && supabase) {
        const { error } = await supabase
          .from('cards')
          .delete()
          .eq('id', id);
        if (error) throw error;
      } else {
        const cards = getLocalData('mock_cards');
        setLocalData('mock_cards', cards.filter((c: Card) => c.id !== id));
      }
    }
  },

  // ── Families ────────────────────────────────────────────
  families: {
    /** Get the current user's family + all members */
    async getMyFamily(userId: string): Promise<{ family: Family; members: FamilyMember[] } | null> {
      if (!useSupabase || !supabase) return null; // requires Supabase

      const { data: profile } = await supabase
        .from('profiles')
        .select('family_id')
        .eq('id', userId)
        .single();

      if (!profile?.family_id) return null;

      const [familyRes, membersRes] = await Promise.all([
        supabase.from('families').select('*').eq('id', profile.family_id).single(),
        supabase.from('profiles').select('id, email, space_id, family_id').eq('family_id', profile.family_id),
      ]);

      if (familyRes.error || !familyRes.data) return null;
      return { family: familyRes.data, members: membersRes.data || [] };
    },

    /** Create a new family and set it on the current user's profile */
    async create(userId: string, name: string): Promise<Family> {
      if (!useSupabase || !supabase) throw new Error('Requiere Supabase');

      // Generate 6-char invite code
      const invite_code = Math.random().toString(36).substring(2, 8).toUpperCase();

      const { data: family, error: fErr } = await supabase
        .from('families')
        .insert([{ name, invite_code }])
        .select()
        .single();
      if (fErr) throw fErr;

      const { error: pErr } = await supabase
        .from('profiles')
        .update({ family_id: family.id })
        .eq('id', userId);
      if (pErr) throw pErr;

      return family;
    },

    /** Join a family using an invite code */
    async join(userId: string, inviteCode: string): Promise<Family> {
      if (!useSupabase || !supabase) throw new Error('Requiere Supabase');

      const { data: family, error: fErr } = await supabase
        .from('families')
        .select('*')
        .eq('invite_code', inviteCode.toUpperCase().trim())
        .single();
      if (fErr || !family) throw new Error('Código de familia inválido o no encontrado');

      const { error: pErr } = await supabase
        .from('profiles')
        .update({ family_id: family.id })
        .eq('id', userId);
      if (pErr) throw pErr;

      return family;
    },

    /** Leave the current family */
    async leave(userId: string): Promise<void> {
      if (!useSupabase || !supabase) throw new Error('Requiere Supabase');
      const { error } = await supabase
        .from('profiles')
        .update({ family_id: null })
        .eq('id', userId);
      if (error) throw error;
    },

    /** Get aggregated financial summary for one member (by their space_id) */
    async getMemberSummary(spaceId: string): Promise<{ totalIncome: number; totalExpenses: number; totalDebtQuota: number }> {
      if (!useSupabase || !supabase) return { totalIncome: 0, totalExpenses: 0, totalDebtQuota: 0 };

      const now = new Date();
      const [incRes, expRes, debtRes] = await Promise.all([
        supabase.from('incomes').select('amount').eq('space_id', spaceId)
          .eq('month', now.getMonth() + 1).eq('year', now.getFullYear()),
        supabase.from('fixed_expenses').select('amount').eq('space_id', spaceId),
        supabase.from('debts').select('total_capital, monthly_interest_rate, total_installments, installments_paid, fixed_capital_payment, has_interest').eq('space_id', spaceId),
      ]);

      const totalIncome   = (incRes.data  || []).reduce((a: number, r: any) => a + r.amount, 0);
      const totalExpenses = (expRes.data  || []).reduce((a: number, r: any) => a + r.amount, 0);
      const totalDebtQuota = (debtRes.data || []).reduce((a: number, d: any) => {
        if (d.installments_paid >= d.total_installments) return a;
        const remaining = d.total_capital - d.installments_paid * d.fixed_capital_payment;
        const interest  = d.has_interest ? remaining * (d.monthly_interest_rate / 100) : 0;
        return a + d.fixed_capital_payment + interest;
      }, 0);

      return { totalIncome, totalExpenses, totalDebtQuota };
    },
  }
};
