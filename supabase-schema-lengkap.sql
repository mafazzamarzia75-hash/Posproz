-- ============================================
-- POSPro Offline-First Database Schema (LENGKAP)
-- Idempotent — aman dijalankan ulang tanpa error
-- Mencakup SEMUA entitas yang disinkronkan ke Supabase
-- ============================================

-- 1. TABEL (CREATE TABLE IF NOT EXISTS)

-- Products (Produk)
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT,
  category TEXT DEFAULT 'Umum',
  price_retail NUMERIC DEFAULT 0,
  price_wholesale NUMERIC DEFAULT 0,
  price_cost NUMERIC DEFAULT 0,
  stock NUMERIC DEFAULT 0,
  min_stock NUMERIC DEFAULT 0,
  description TEXT,
  barcode TEXT,
  image_url TEXT,
  supplier_id TEXT,
  supplier_name TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categories (Kategori Produk)
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customers (Pelanggan)
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  total_spent NUMERIC DEFAULT 0,
  total_transactions NUMERIC DEFAULT 0,
  last_transaction TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Suppliers (Pemasok)
CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  contact_person TEXT,
  npwp TEXT,
  notes TEXT,
  product_count NUMERIC DEFAULT 0,
  total_purchases NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Debts (Hutang & Piutang)
CREATE TABLE IF NOT EXISTS debts (
  id TEXT PRIMARY KEY,
  type TEXT DEFAULT 'receivable',
  customer_id TEXT,
  customer_name TEXT DEFAULT '',
  supplier_id TEXT,
  supplier_name TEXT DEFAULT '',
  amount NUMERIC DEFAULT 0,
  paid_amount NUMERIC DEFAULT 0,
  description TEXT DEFAULT '',
  due_date TIMESTAMPTZ,
  status TEXT DEFAULT 'unpaid',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Discounts (Diskon & Promo)
CREATE TABLE IF NOT EXISTS discounts (
  id TEXT PRIMARY KEY,
  code TEXT,
  name TEXT DEFAULT '',
  type TEXT DEFAULT 'percentage',
  value NUMERIC DEFAULT 0,
  min_purchase NUMERIC DEFAULT 0,
  max_discount NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  usage_limit NUMERIC DEFAULT 0,
  usage_count NUMERIC DEFAULT 0,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Restocks (Riwayat Restock / Masuk Barang)
CREATE TABLE IF NOT EXISTS restocks (
  id TEXT PRIMARY KEY,
  product_id TEXT,
  product_name TEXT DEFAULT '',
  product_sku TEXT DEFAULT '',
  qty NUMERIC DEFAULT 0,
  price_buy NUMERIC DEFAULT 0,
  total_cost NUMERIC DEFAULT 0,
  stock_before NUMERIC DEFAULT 0,
  stock_after NUMERIC DEFAULT 0,
  supplier_id TEXT,
  supplier_name TEXT DEFAULT '',
  invoice_number TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Returs (Retur Barang)
CREATE TABLE IF NOT EXISTS returs (
  id TEXT PRIMARY KEY,
  type TEXT DEFAULT 'sale_return',
  product_id TEXT,
  product_name TEXT DEFAULT '',
  product_sku TEXT DEFAULT '',
  qty NUMERIC DEFAULT 0,
  price NUMERIC DEFAULT 0,
  total_refund NUMERIC DEFAULT 0,
  reason TEXT DEFAULT '',
  customer_name TEXT DEFAULT '',
  transaction_id TEXT,
  supplier_name TEXT DEFAULT '',
  supplier_id TEXT,
  invoice_number TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expenses (Pengeluaran)
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  name TEXT DEFAULT '',
  amount NUMERIC DEFAULT 0,
  category TEXT DEFAULT 'Lainnya',
  date TIMESTAMPTZ,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users (Akun Pengguna)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE,
  password TEXT,
  name TEXT DEFAULT '',
  role TEXT DEFAULT 'kasir',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sales (Transaksi Penjualan — dipakai indexdbTransaksi)
CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  total NUMERIC DEFAULT 0,
  subtotal NUMERIC DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  items JSONB DEFAULT '[]',
  customer_name TEXT DEFAULT '',
  payment_method TEXT DEFAULT 'cash',
  paid_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions (Transaksi — dipakai OfflineFirst/Dexie)
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  transaction_type TEXT DEFAULT 'penjualan',
  transaction_date TIMESTAMPTZ DEFAULT NOW(),
  customer_id TEXT,
  supplier_id TEXT,
  items JSONB DEFAULT '[]',
  total_amount NUMERIC DEFAULT 0,
  paid_amount NUMERIC DEFAULT 0,
  payment_method TEXT DEFAULT 'tunai',
  notes TEXT,
  cashier_id TEXT,
  is_draft BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PASTIKAN KOLOM PENTING ADA (aman jika tabel dari skema lama)
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_retail NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_wholesale NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_cost NUMERIC DEFAULT 0;

-- 3. AKTIFKAN RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE restocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE returs ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- 4. POLICY IDEMPOTENT (DO block cek pg_policies — TIDAK error jika sudah ada)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['products','customers','suppliers','transactions','categories','debts','discounts','restocks','returs','expenses','users','sales']
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = tbl AND policyname = 'Allow all for anon') THEN
      EXECUTE format('CREATE POLICY "Allow all for anon" ON public.%I FOR ALL USING (true) WITH CHECK (true)', tbl);
    END IF;
  END LOOP;
END $$;

-- 5. INDEX (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_products_updated ON products(updated_at);
CREATE INDEX IF NOT EXISTS idx_customers_updated ON customers(updated_at);
CREATE INDEX IF NOT EXISTS idx_suppliers_updated ON suppliers(updated_at);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_debts_type ON debts(type);
CREATE INDEX IF NOT EXISTS idx_debts_status ON debts(status);
CREATE INDEX IF NOT EXISTS idx_discounts_code ON discounts(code);
CREATE INDEX IF NOT EXISTS idx_restocks_product ON restocks(product_id);
CREATE INDEX IF NOT EXISTS idx_returs_product ON returs(product_id);
CREATE INDEX IF NOT EXISTS idx_returs_type ON returs(type);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);