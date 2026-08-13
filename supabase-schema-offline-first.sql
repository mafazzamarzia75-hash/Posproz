-- ============================================================
-- POSPro Offline-First Database Schema (PostgreSQL / Supabase)
-- Sederhana & Kompatibel
-- ============================================================
-- VERSI: Multi-Device • Multi-Akun • Multi-Cabang
-- ============================================================
-- Tujuan: Skema lengkap untuk sinkronisasi offline-first
--   yang mumpuni untuk multi-device, multi-akun, multi-cabang.
-- ============================================================

-- ============================================================
-- 1. ENUM & CONSTANT
-- ============================================================

-- Role pengguna
CREATE TYPE user_role AS ENUM ('superadmin', 'admin', 'kasir', 'gudang');
CREATE TYPE transaction_type AS ENUM ('penjualan', 'pembelian', 'retur', 'adjustment');
CREATE TYPE debt_status AS ENUM ('unpaid', 'partial', 'paid');
CREATE TYPE debt_type AS ENUM ('receivable', 'payable');

-- ============================================================
-- 2. TABEL MASTER (multi-tenant)
-- ============================================================

-- ------------------------------------------------------------
-- Branches (Cabang / Toko)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS branches (
  id          TEXT PRIMARY KEY,
  code        TEXT UNIQUE,
  name        TEXT NOT NULL,
  address     TEXT,
  city        TEXT,
  phone       TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  is_deleted  BOOLEAN DEFAULT FALSE,
  sync_status TEXT DEFAULT 'synced',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  synced_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- User Branches (Relasi User ↔ Cabang)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_branches (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  branch_id   TEXT NOT NULL,
  role        user_role DEFAULT 'kasir',
  is_active   BOOLEAN DEFAULT TRUE,
  is_deleted  BOOLEAN DEFAULT FALSE,
  sync_status TEXT DEFAULT 'synced',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  synced_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Devices (Registrasi Device)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS devices (
  id            TEXT PRIMARY KEY,
  device_name   TEXT DEFAULT '',
  device_type   TEXT DEFAULT 'desktop',
  branch_id     TEXT DEFAULT '',
  last_sync_at  TIMESTAMPTZ DEFAULT NOW(),
  is_active     BOOLEAN DEFAULT TRUE,
  is_deleted    BOOLEAN DEFAULT FALSE,
  sync_status   TEXT DEFAULT 'synced',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  synced_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Sync Logs
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_logs (
  id           BIGSERIAL PRIMARY KEY,
  table_name   TEXT NOT NULL,
  record_id    TEXT,
  action       TEXT DEFAULT 'upsert',
  device_id    TEXT DEFAULT '',
  branch_id    TEXT DEFAULT '',
  status       TEXT DEFAULT 'success',
  error_message TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. TABEL DATA APLIKASI
-- ============================================================

-- ------------------------------------------------------------
-- Products (Produk)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  sku           TEXT,
  barcode       TEXT,
  category      TEXT DEFAULT 'Umum',
  price_retail  NUMERIC DEFAULT 0,
  price_wholesale NUMERIC DEFAULT 0,
  price_cost    NUMERIC DEFAULT 0,
  stock         NUMERIC DEFAULT 0,
  min_stock     NUMERIC DEFAULT 0,
  supplier_id   TEXT,
  is_deleted    BOOLEAN DEFAULT FALSE,
  sync_status   TEXT DEFAULT 'synced',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  synced_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Customers (Pelanggan)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  phone         TEXT,
  email         TEXT,
  is_deleted    BOOLEAN DEFAULT FALSE,
  sync_status   TEXT DEFAULT 'synced',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  synced_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Suppliers (Pemasok)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS suppliers (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  phone         TEXT,
  is_active     BOOLEAN DEFAULT TRUE,
  is_deleted    BOOLEAN DEFAULT FALSE,
  sync_status   TEXT DEFAULT 'synced',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  synced_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Transactions (Transaksi)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
  id               TEXT PRIMARY KEY,
  transaction_type transaction_type DEFAULT 'penjualan',
  transaction_date TIMESTAMPTZ DEFAULT NOW(),
  customer_id      TEXT,
  supplier_id      TEXT,
  total_amount     NUMERIC DEFAULT 0,
  paid_amount      NUMERIC DEFAULT 0,
  payment_method   TEXT DEFAULT 'tunai',
  notes            TEXT,
  is_draft         BOOLEAN DEFAULT FALSE,
  is_deleted       BOOLEAN DEFAULT FALSE,
  sync_status      TEXT DEFAULT 'synced',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  synced_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Restocks (Riwayat Restock)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS restocks (
  id            TEXT PRIMARY KEY,
  restock_date   TIMESTAMPTZ DEFAULT NOW(),
  supplier_id    TEXT,
  total_amount   NUMERIC DEFAULT 0,
  notes          TEXT,
  is_deleted     BOOLEAN DEFAULT FALSE,
  sync_status    TEXT DEFAULT 'synced',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  synced_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Returs (Retur Barang)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS returs (
  id            TEXT PRIMARY KEY,
  retur_date     TIMESTAMPTZ DEFAULT NOW(),
  retur_type     TEXT DEFAULT 'customer',
  total_amount   NUMERIC DEFAULT 0,
  notes          TEXT,
  is_deleted     BOOLEAN DEFAULT FALSE,
  sync_status    TEXT DEFAULT 'synced',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  synced_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Debts (Hutang & Piutang)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS debts (
  id            TEXT PRIMARY KEY,
  type           debt_type DEFAULT 'receivable',
  customer_id    TEXT,
  supplier_id    TEXT,
  amount         NUMERIC DEFAULT 0,
  paid_amount    NUMERIC DEFAULT 0,
  status         debt_status DEFAULT 'unpaid',
  due_date       TIMESTAMPTZ,
  is_deleted     BOOLEAN DEFAULT FALSE,
  sync_status    TEXT DEFAULT 'synced',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  synced_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. TRIGGER (auto-update updated_at)
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_updated ON products;
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_categories_updated ON categories;
CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_customers_updated ON customers;
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_suppliers_updated ON suppliers;
CREATE TRIGGER trg_suppliers_updated BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_transactions_updated ON transactions;
CREATE TRIGGER trg_transactions_updated BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_restocks_updated ON restocks;
CREATE TRIGGER trg_restocks_updated BEFORE UPDATE ON restocks FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_returs_updated ON returs;
CREATE TRIGGER trg_returs_updated BEFORE UPDATE ON returs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_debts_updated ON debts;
CREATE TRIGGER trg_debts_updated BEFORE UPDATE ON debts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 5. INDEX (performa)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_products_updated ON products(updated_at);
CREATE INDEX IF NOT EXISTS idx_products_deleted ON products(is_deleted);
CREATE INDEX IF NOT EXISTS idx_users_branch ON user_branches(branch_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);

-- ============================================================
-- 6. VERIFIKASI (cek tabel)
-- ============================================================
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
