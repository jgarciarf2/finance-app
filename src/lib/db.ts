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
  }
};
