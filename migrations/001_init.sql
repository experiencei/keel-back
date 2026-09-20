-- Keel platform — initial schema

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE accounts (
  id                                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name                      TEXT NOT NULL,
  domain                            TEXT NOT NULL,
  plan                              TEXT NOT NULL CHECK (plan IN ('credits', 'usage')),
  status                            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'past_due')),
  stripe_customer_id                TEXT UNIQUE,
  stripe_subscription_id            TEXT UNIQUE, -- only set for the usage-based (metered) plan
  soft_limit_credits                BIGINT NOT NULL DEFAULT 30000,
  hard_limit_credits                BIGINT NOT NULL DEFAULT 0,
  auto_recharge_enabled             BOOLEAN NOT NULL DEFAULT false,
  auto_recharge_threshold_credits   BIGINT NOT NULL DEFAULT 10000,
  auto_recharge_topup_credits       BIGINT NOT NULL DEFAULT 50000,
  created_at                        TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at                      TIMESTAMPTZ
);

CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  email       TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Deliberately simple session store instead of JWTs: a session can be revoked by

CREATE TABLE sessions (
  token       TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);

CREATE TABLE wallets (
  account_id       UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  balance_credits  BIGINT NOT NULL DEFAULT 0,
  granted_credits  BIGINT NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE usage_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id       UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  idempotency_key  TEXT NOT NULL,
  model            TEXT NOT NULL,
  tokens_in        INT NOT NULL,
  tokens_out       INT NOT NULL,
  credits_cost     NUMERIC(12, 4) NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, idempotency_key)
);
CREATE INDEX idx_usage_events_account_created ON usage_events (account_id, created_at DESC);

CREATE TABLE transactions (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id                  UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  type                        TEXT NOT NULL CHECK (type IN ('purchase', 'auto_recharge', 'refund')),
  amount_usd                  NUMERIC(12, 2) NOT NULL,
  credits_added               BIGINT NOT NULL,
  stripe_payment_intent_id    TEXT,
  status                      TEXT NOT NULL DEFAULT 'succeeded',
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE invoices (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id         UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  stripe_invoice_id  TEXT UNIQUE,
  period_start       TIMESTAMPTZ NOT NULL,
  period_end         TIMESTAMPTZ NOT NULL,
  total_usd          NUMERIC(12, 2) NOT NULL,
  status             TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'paid', 'void')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE invoice_line_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  model       TEXT NOT NULL,
  call_count  INT NOT NULL,
  credits     NUMERIC(12, 4) NOT NULL
);

CREATE TABLE webhook_events (
  stripe_event_id  TEXT PRIMARY KEY,
  type             TEXT NOT NULL,
  received_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
