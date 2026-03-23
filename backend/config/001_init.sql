-- migrations/001_init.sql
-- Run: psql $DATABASE_URL -f migrations/001_init.sql

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id              SERIAL PRIMARY KEY,
  email           VARCHAR(255) UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  full_name       VARCHAR(255),
  phone           VARCHAR(30),
  alternate_phone VARCHAR(30),
  address_line1   VARCHAR(255),
  address_line2   VARCHAR(255),
  city            VARCHAR(100),
  state           VARCHAR(100),
  country         VARCHAR(100),
  pincode         VARCHAR(20),
  organization_name VARCHAR(255),
  government_id   VARCHAR(120),
  email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at   TIMESTAMPTZ,
  wallet_address  VARCHAR(42),               -- Ethereum address (0x...)
  role            VARCHAR(20) NOT NULL DEFAULT 'borrower',
                              -- borrower | verifier | lender | admin
  access_status   VARCHAR(20) NOT NULL DEFAULT 'approved', -- pending | approved | rejected
  access_review_note TEXT,
  access_reviewed_by INTEGER REFERENCES users(id),
  access_reviewed_at TIMESTAMPTZ,
  kyc_status      VARCHAR(20) DEFAULT 'pending', -- pending | approved | rejected
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Activities table
CREATE TABLE IF NOT EXISTS activities (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  category        VARCHAR(50) NOT NULL,  -- health | education | sustainability
  ipfs_hash       TEXT,                  -- IPFS CID of uploaded document
  data_hash       VARCHAR(66),           -- keccak256 hex for blockchain
  status          VARCHAR(20) DEFAULT 'pending', -- pending | verified | rejected
  verified_by     INTEGER REFERENCES users(id),
  verified_at     TIMESTAMPTZ,
  blockchain_tx   VARCHAR(66),           -- tx hash after on-chain storage
  on_chain_id     INTEGER,               -- activityId from smart contract
  rejection_note  TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Impact Score cache table (synced from blockchain)
CREATE TABLE IF NOT EXISTS impact_scores (
  user_id         INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  score           INTEGER DEFAULT 0,
  last_synced_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Email verification codes
CREATE TABLE IF NOT EXISTS email_verification_codes (
  id              SERIAL PRIMARY KEY,
  email           VARCHAR(255) NOT NULL,
  code_hash       VARCHAR(128) NOT NULL,
  attempts        INTEGER NOT NULL DEFAULT 0,
  expires_at      TIMESTAMPTZ NOT NULL,
  consumed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Loans table
CREATE TABLE IF NOT EXISTS loans (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lender_id       INTEGER REFERENCES users(id),
  amount          DECIMAL(12, 2) NOT NULL,        -- requested in USD
  approved_amount DECIMAL(12, 2),
  interest_rate   DECIMAL(6, 2),                  -- percent
  duration_days   INTEGER,
  status          VARCHAR(20) DEFAULT 'pending',  -- pending|approved|rejected|repaid
  tier            VARCHAR(10),                    -- low|medium|high
  score_at_apply  INTEGER,
  lender_note     TEXT,
  blockchain_loan_id INTEGER,
  blockchain_tx   VARCHAR(66),
  applied_at      TIMESTAMPTZ DEFAULT NOW(),
  decided_at      TIMESTAMPTZ,
  repaid_at       TIMESTAMPTZ,
  due_date        TIMESTAMPTZ,
  rejection_reason TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Verifier decision audit trail
CREATE TABLE IF NOT EXISTS verification_audit_logs (
  id              SERIAL PRIMARY KEY,
  activity_id     INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  verifier_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action          VARCHAR(20) NOT NULL, -- approve | reject
  old_status      VARCHAR(20),
  new_status      VARCHAR(20),
  rejection_note  TEXT,
  decision_note   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
ALTER TABLE users ADD COLUMN IF NOT EXISTS access_status VARCHAR(20) NOT NULL DEFAULT 'approved';
ALTER TABLE users ADD COLUMN IF NOT EXISTS access_review_note TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS access_reviewed_by INTEGER REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS access_reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_activities_user   ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_status ON activities(status);
CREATE INDEX IF NOT EXISTS idx_activities_hash   ON activities(data_hash);
CREATE INDEX IF NOT EXISTS idx_loans_user        ON loans(user_id);
CREATE INDEX IF NOT EXISTS idx_loans_lender      ON loans(lender_id);
CREATE INDEX IF NOT EXISTS idx_loans_status      ON loans(status);
CREATE INDEX IF NOT EXISTS idx_users_wallet      ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_role_access ON users(role, access_status);
CREATE INDEX IF NOT EXISTS idx_verification_audit_activity ON verification_audit_logs(activity_id);
CREATE INDEX IF NOT EXISTS idx_verification_audit_verifier ON verification_audit_logs(verifier_id);

-- Compatibility layer for existing databases where the loans table already exists.
ALTER TABLE loans ADD COLUMN IF NOT EXISTS lender_id INTEGER REFERENCES users(id);
ALTER TABLE loans ADD COLUMN IF NOT EXISTS lender_note TEXT;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS repaid_at TIMESTAMPTZ;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS alternate_phone VARCHAR(30);
ALTER TABLE users ADD COLUMN IF NOT EXISTS address_line1 VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS address_line2 VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS state VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS pincode VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS government_id VARCHAR(120);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_email_verification_email ON email_verification_codes(email);
CREATE INDEX IF NOT EXISTS idx_email_verification_expiry ON email_verification_codes(expires_at);

-- Trigger: updated_at
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS users_updated_at ON users;
DROP TRIGGER IF EXISTS activities_updated_at ON activities;
DROP TRIGGER IF EXISTS loans_updated_at ON loans;

CREATE TRIGGER users_updated_at      BEFORE UPDATE ON users      FOR EACH ROW EXECUTE PROCEDURE update_timestamp();
CREATE TRIGGER activities_updated_at BEFORE UPDATE ON activities FOR EACH ROW EXECUTE PROCEDURE update_timestamp();
CREATE TRIGGER loans_updated_at      BEFORE UPDATE ON loans      FOR EACH ROW EXECUTE PROCEDURE update_timestamp();
