-- ======================================================
-- ชุดคำสั่ง SQL สำหรับการติดตั้งตารางใน Supabase
-- วิธีใช้: คัดลอกทั้งหมดนี้ไปวางในเมนู SQL Editor ของ Supabase แล้วกด Run
-- ======================================================

-- 1. ตารางเก็บข้อมูลผู้ใช้ (gm_users)
CREATE TABLE IF NOT EXISTS gm_users (
    username TEXT PRIMARY KEY,
    name TEXT,
    password TEXT,
    role TEXT DEFAULT 'user',
    banned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. ตารางเก็บข้อมูลบัญชีการเงิน (gm_accounts)
CREATE TABLE IF NOT EXISTS gm_accounts (
    id TEXT PRIMARY KEY,
    username TEXT REFERENCES gm_users(username) ON DELETE CASCADE,
    name TEXT,
    type TEXT,
    balance NUMERIC DEFAULT 0,
    color TEXT,
    initial_balance NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. ตารางเก็บธุรกรรมรายรับ-รายจ่าย (gm_transactions)
CREATE TABLE IF NOT EXISTS gm_transactions (
    id TEXT PRIMARY KEY,
    username TEXT REFERENCES gm_users(username) ON DELETE CASCADE,
    account_id TEXT REFERENCES gm_accounts(id) ON DELETE CASCADE,
    type TEXT, -- 'income' หรือ 'expense'
    title TEXT,
    amount NUMERIC DEFAULT 0,
    category TEXT,
    date DATE,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. ตารางเก็บค่าใช้จ่ายคงที่รายเดือน (gm_fixed_expenses)
CREATE TABLE IF NOT EXISTS gm_fixed_expenses (
    id TEXT PRIMARY KEY,
    username TEXT REFERENCES gm_users(username) ON DELETE CASCADE,
    name TEXT,
    amt NUMERIC DEFAULT 0,
    emoji TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ปิด Row Level Security (RLS) เพื่อให้หน้าเว็บบนเครื่องต่างๆ สามารถดึงข้อมูลผ่าน API คีย์สาธารณะ (Anon Key) ได้ง่ายและสะดวก
ALTER TABLE gm_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE gm_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE gm_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE gm_fixed_expenses DISABLE ROW LEVEL SECURITY;
