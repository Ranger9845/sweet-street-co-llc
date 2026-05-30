-- ============================================================
-- Sweet Street Co — Supabase Schema
-- Paste this entire file into the Supabase SQL Editor and run it.
-- It is safe to re-run (uses IF NOT EXISTS / ON CONFLICT DO NOTHING).
-- ============================================================

-- ── settings ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  id                         integer PRIMARY KEY DEFAULT 1,
  shop_name                  text    DEFAULT 'Sweet Street Co',
  site_description           text,
  ready_message              text,
  owner_password             text    DEFAULT 'owner123',
  is_open                    boolean DEFAULT true,
  announcement_enabled       boolean DEFAULT false,
  announcement_text          text,
  open_mode                  text    DEFAULT 'auto',
  happy_hour_enabled         boolean DEFAULT false,
  happy_hour_start           text    DEFAULT '14:00',
  happy_hour_end             text    DEFAULT '17:00',
  happy_hour_discount_type   text    DEFAULT 'percent',
  happy_hour_discount_value  numeric DEFAULT 50,
  pos_accent_color           text,
  pos_bg_color               text,
  pos_card_color             text,
  pos_foreground_color       text,
  pos_muted_color            text,
  pos_border_color           text,
  pos_header_text            text,
  pos_button_radius          text,
  dev_notification_enabled   boolean DEFAULT false,
  dev_notification_title     text,
  dev_notification_body      text,
  dev_notification_max_shows integer DEFAULT 3,
  dev_notification_version   text,
  dev_notification_cta_label text,
  dev_notification_cta_url   text,
  CONSTRAINT settings_single_row CHECK (id = 1)
);

-- Ensure the single settings row exists
INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ── menu_items ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS menu_items (
  id              bigserial PRIMARY KEY,
  name            text      NOT NULL,
  size_prices     jsonb     DEFAULT '{}',
  size_prep_steps jsonb     DEFAULT '{}',
  size_ingredients jsonb    DEFAULT '{}',
  modifier_ids    integer[] DEFAULT '{}',
  pos_category_id integer,
  pos_sort_order  integer   DEFAULT 0,
  pos_hidden      boolean   DEFAULT false,
  available       boolean   DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- ── modifiers ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS modifiers (
  id    bigserial PRIMARY KEY,
  name  text    NOT NULL,
  price numeric DEFAULT 0
);

-- ── pos_categories ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pos_categories (
  id               bigserial PRIMARY KEY,
  name             text    NOT NULL,
  emoji            text,
  color            text,
  background_color text,
  sort_order       integer DEFAULT 0,
  available        boolean DEFAULT true
);

-- ── orders ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id                        bigserial PRIMARY KEY,
  customer_name             text,
  customer_email            text,
  customer_phone            text,
  customer_sms_consent      boolean     DEFAULT false,
  notes                     text,
  discount_code             text,
  discount_amount           numeric     DEFAULT 0,
  total_amount              numeric     DEFAULT 0,
  status                    text        DEFAULT 'pending',
  source                    text        DEFAULT 'web',
  clerk_user_id             text,
  scheduled_for             timestamptz,
  paid_at                   timestamptz,
  customer_ready_notified_at timestamptz,
  items                     jsonb       DEFAULT '[]',
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_status_idx      ON orders (status);
CREATE INDEX IF NOT EXISTS orders_clerk_user_idx  ON orders (clerk_user_id);
CREATE INDEX IF NOT EXISTS orders_created_at_idx  ON orders (created_at DESC);

-- ── discount_codes ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS discount_codes (
  id              bigserial PRIMARY KEY,
  code            text    NOT NULL UNIQUE,
  school_name     text,
  discount_type   text    DEFAULT 'percent',
  discount_amount numeric DEFAULT 0,
  active          boolean DEFAULT true
);

-- ── rewards ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rewards (
  id             bigserial PRIMARY KEY,
  name           text    NOT NULL,
  description    text,
  points_cost    integer DEFAULT 100,
  discount_type  text    DEFAULT 'dollar',
  discount_value numeric DEFAULT 5,
  active         boolean DEFAULT true
);

-- ── points_ledger ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS points_ledger (
  id            bigserial PRIMARY KEY,
  clerk_user_id text        NOT NULL,
  points        integer     NOT NULL,
  type          text        DEFAULT 'earn',
  description   text,
  order_id      bigint REFERENCES orders (id) ON DELETE SET NULL,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS points_ledger_user_idx ON points_ledger (clerk_user_id);

-- ── favorites ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS favorites (
  clerk_user_id text    NOT NULL,
  menu_item_id  bigint  NOT NULL REFERENCES menu_items (id) ON DELETE CASCADE,
  PRIMARY KEY (clerk_user_id, menu_item_id)
);

-- ── reviews ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id            bigserial PRIMARY KEY,
  reviewer_name text,
  rating        integer,
  comment       text,
  approved      boolean     DEFAULT false,
  created_at    timestamptz DEFAULT now()
);

-- ── live_carts ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS live_carts (
  device_id     text PRIMARY KEY,
  customer_name text,
  items         jsonb       DEFAULT '[]',
  subtotal      numeric     DEFAULT 0,
  updated_at    timestamptz DEFAULT now()
);

-- ============================================================
-- Done! All tables created.
-- ============================================================
