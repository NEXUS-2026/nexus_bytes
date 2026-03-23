-- migrations/003_borrower_kyc.sql
-- Optional borrower KYC workflow and admin review queue.

CREATE TABLE IF NOT EXISTS borrower_kyc_submissions (
  id                 SERIAL PRIMARY KEY,
  user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_type      VARCHAR(50) NOT NULL,
  document_number    VARCHAR(120) NOT NULL,
  document_ipfs_hash TEXT,
  notes              TEXT,
  status             VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  review_note        TEXT,
  reviewed_by        INTEGER REFERENCES users(id),
  reviewed_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kyc_user       ON borrower_kyc_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_status     ON borrower_kyc_submissions(status);
CREATE INDEX IF NOT EXISTS idx_kyc_created_at ON borrower_kyc_submissions(created_at);
