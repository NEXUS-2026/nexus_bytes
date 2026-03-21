-- migrations/001_init.sql
-- Run: psql $DATABASE_URL -f migrations/001_init.sql

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id              SERIAL PRIMARY KEY,
  email           VARCHAR(255) UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  full_name       VARCHAR(255),
  phone           VARCHAR(30),
  wallet_address  VARCHAR(42),               -- Ethereum address (0x...)
  role            VARCHAR(20) NOT NULL DEFAULT 'borrower',
                              -- borrower | verifier | lender | admin
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

-- Loans table
CREATE TABLE IF NOT EXISTS loans (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount          DECIMAL(12, 2) NOT NULL,        -- requested in USD
  approved_amount DECIMAL(12, 2),
  interest_rate   DECIMAL(6, 2),                  -- percent
  duration_days   INTEGER,
  status          VARCHAR(20) DEFAULT 'pending',  -- pending|approved|rejected|repaid
  tier            VARCHAR(10),                    -- low|medium|high
  score_at_apply  INTEGER,
  blockchain_loan_id INTEGER,
  blockchain_tx   VARCHAR(66),
  applied_at      TIMESTAMPTZ DEFAULT NOW(),
  decided_at      TIMESTAMPTZ,
  rejection_reason TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_activities_user   ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_status ON activities(status);
CREATE INDEX IF NOT EXISTS idx_loans_user        ON loans(user_id);
CREATE INDEX IF NOT EXISTS idx_users_wallet      ON users(wallet_address);

-- Trigger: updated_at
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ language 'plpgsql';

CREATE TRIGGER users_updated_at      BEFORE UPDATE ON users      FOR EACH ROW EXECUTE PROCEDURE update_timestamp();
CREATE TRIGGER activities_updated_at BEFORE UPDATE ON activities  FOR EACH ROW EXECUTE PROCEDURE update_timestamp();
CREATE TRIGGER loans_updated_at      BEFORE UPDATE ON loans       FOR EACH ROW EXECUTE PROCEDURE update_timestamp();
