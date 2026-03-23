-- migrations/002_lender_verifier_upgrade.sql
-- Run after 001_init.sql for existing environments.

ALTER TABLE loans ADD COLUMN IF NOT EXISTS lender_id INTEGER REFERENCES users(id);
ALTER TABLE loans ADD COLUMN IF NOT EXISTS lender_note TEXT;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS repaid_at TIMESTAMPTZ;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS verification_audit_logs (
  id              SERIAL PRIMARY KEY,
  activity_id     INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  verifier_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action          VARCHAR(20) NOT NULL,
  old_status      VARCHAR(20),
  new_status      VARCHAR(20),
  rejection_note  TEXT,
  decision_note   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_hash   ON activities(data_hash);
CREATE INDEX IF NOT EXISTS idx_loans_lender      ON loans(lender_id);
CREATE INDEX IF NOT EXISTS idx_loans_status      ON loans(status);
CREATE INDEX IF NOT EXISTS idx_verification_audit_activity ON verification_audit_logs(activity_id);
CREATE INDEX IF NOT EXISTS idx_verification_audit_verifier ON verification_audit_logs(verifier_id);
