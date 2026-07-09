# 💰 Finanzas Pro — Personal Finance Dashboard

> **Live demo:** [https://finance-app-chi-woad.vercel.app](https://finance-app-chi-woad.vercel.app)

A full-stack personal and family finance management web app built with **Next.js 16 + Supabase**. Track incomes, fixed expenses, debts, generate 12-month projections with amortization tables, and visualize everything with interactive charts.

![Finanzas Pro](https://finance-app-chi-woad.vercel.app)

---

## ✨ Features

### 💵 Income Management
- Add multiple income sources with name, amount, month and year
- Totals calculated automatically

### 🧾 Fixed Expenses
- Track recurring expenses by category (Housing, Services, Food, Transport, Subscriptions, Others)
- Clearly separated from variable/debt payments

### 💳 Debt & Installment Tracking
- Register any financed purchase (credit card, loan, etc.)
- Configure:
  - Total capital, installments, paid installments
  - Monthly interest rate (optional)
  - **Billing cutoff day** (e.g. day 25 of the month)
  - **Payment due day** (e.g. day 30 of the month)
- Real-time interest calculation using standard amortization formula
- Increment/decrement paid installments directly from the dashboard table

### 📊 Interactive Charts
- Income vs. Expenses bar chart (SVG, no dependencies)
- Monthly cashflow projection line chart
- Breakdown donut/bar of expense categories

### 📅 12-Month Projections
- Billing-cycle-aware projection engine:
  - If a purchase was made AFTER the billing cutoff → payment shifts to the next month
  - If today is past the cutoff → current cycle already closed, next payment is in the following month
- Full amortization table per month showing:
  - Total income
  - Fixed expenses
  - Debt installments (with **due day badge**)
  - Net free cash flow (color-coded: green/red)

### 🌗 Light / Dark Theme
- Beautiful dark mode (default) with purple glassmorphism accents
- Clean light mode with lavender tones
- Toggle button in the header (☀️ / 🌙)
- Theme is persisted in `localStorage`

### 🔐 Authentication & Shared Spaces
- Email + password authentication via Supabase Auth
- **Shared Space ID**: couples or families can share the same financial space by using the same space ID
- Session persisted in localStorage (Demo Mode) or Supabase JWT

### 🗄️ Dual Database Mode
| Mode | When active | How |
|---|---|---|
| **Supabase** | `.env.local` has Supabase keys | Full PostgreSQL backend |
| **Demo (localStorage)** | No env vars set | All data stored in browser `localStorage` — no setup needed |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router, Server Actions) |
| Language | TypeScript |
| Styling | Vanilla CSS (CSS custom properties, glassmorphism) |
| Database | [Supabase](https://supabase.com) (PostgreSQL) |
| Auth | Supabase Auth (email/password) |
| Icons | [lucide-react](https://lucide.dev) |
| Charts | Custom inline SVG (no chart library) |
| Deployment | [Vercel](https://vercel.com) |

---

## 🚀 Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/jgarciarf2/finance-app.git
cd finance-app
```

### 2. Install dependencies

```bash
npm install
```

### 3. (Optional) Configure Supabase

> Skip this step to run in **Demo Mode** with localStorage only.

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Run the database migrations

Run the following SQL in your Supabase SQL editor:

```sql
-- Profiles (linked to Supabase Auth)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  space_id text not null default gen_random_uuid()::text
);

-- Incomes
create table if not exists incomes (
  id uuid primary key default gen_random_uuid(),
  space_id text not null,
  name text not null,
  amount numeric not null,
  month int not null,
  year int not null,
  created_at timestamptz default now()
);

-- Fixed Expenses
create table if not exists fixed_expenses (
  id uuid primary key default gen_random_uuid(),
  space_id text not null,
  name text not null,
  amount numeric not null,
  category text not null default 'Otros',
  created_at timestamptz default now()
);

-- Debts / Installment Purchases
create table if not exists debts (
  id uuid primary key default gen_random_uuid(),
  space_id text not null,
  name text not null,
  total_capital numeric not null,
  monthly_interest_rate numeric not null default 0,
  total_installments int not null,
  installments_paid int not null default 0,
  fixed_capital_payment numeric not null,
  start_date date not null,
  has_interest boolean not null default false,
  cutoff_day int,       -- billing cycle cutoff day (1-31)
  payment_day int,      -- actual payment day (1-31)
  created_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, space_id)
  values (new.id, new.email, gen_random_uuid()::text);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Row Level Security
alter table incomes enable row level security;
alter table fixed_expenses enable row level security;
alter table debts enable row level security;
alter table profiles enable row level security;

-- RLS Policies (allow users to access their own space)
create policy "space_access_incomes" on incomes
  using (space_id = (select space_id from profiles where id = auth.uid()));

create policy "space_access_expenses" on fixed_expenses
  using (space_id = (select space_id from profiles where id = auth.uid()));

create policy "space_access_debts" on debts
  using (space_id = (select space_id from profiles where id = auth.uid()));

create policy "own_profile" on profiles
  using (id = auth.uid());
```

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 🧮 Financial Formulas

### Installment with interest (French amortization)
```
Quota = Capital_remaining × monthly_rate / (1 - (1 + monthly_rate)^(-remaining_installments))
```

### Simple installment without interest
```
Quota = total_capital / total_installments
```

### Free Cash Flow
```
FCF = Total_Incomes − Fixed_Expenses − Σ(Active_Debt_Quotas)
```

### Billing cycle projection offset
```
if purchase_day > cutoff_day  →  billingOffset += 1
if today > cutoff_day (month i=0)  →  billingOffset += 1
```

---

## 📁 Project Structure

```
finance-app/
├── src/
│   ├── app/
│   │   ├── globals.css       # Full design system (dark + light themes)
│   │   ├── layout.tsx        # Root layout with footer
│   │   └── page.tsx          # Main SPA (auth + dashboard + projections)
│   └── lib/
│       └── db.ts             # Database adapter (Supabase / localStorage)
├── .env.local                # (not committed) Supabase credentials
├── next.config.ts
├── tsconfig.json
└── package.json
```

---

## 🌐 Deployment (Vercel)

1. Push to GitHub
2. Import the repository in [vercel.com](https://vercel.com)
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy → done!

The app also works without env vars in **Demo Mode**.

---

## 👤 Author

**@jgarciarf2**

| | |
|---|---|
| 📞 | [+57 302 321 7019](tel:+573023217019) |
| ✉️ | [jgarciarf216@gmail.com](mailto:jgarciarf216@gmail.com) |
| 🐙 | [github.com/jgarciarf2](https://github.com/jgarciarf2) |
| 🌐 | [jgarcia.github.io](https://jgarcia.github.io) |

---

> *Built with ❤️ and Next.js. Powered by @jgarciarf2*
