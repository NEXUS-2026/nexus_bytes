-- migrations/004_role_access_approval.sql
-- Role onboarding approval for verifier/lender accounts.

ALTER TABLE users ADD COLUMN IF NOT EXISTS access_status VARCHAR(20) NOT NULL DEFAULT 'approved';
ALTER TABLE users ADD COLUMN IF NOT EXISTS access_review_note TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS access_reviewed_by INTEGER REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS access_reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_role_access ON users(role, access_status);

-- Existing verifier/lender users should be pending unless previously reviewed.
UPDATE users
SET access_status = 'pending'
WHERE role IN ('verifier', 'lender')
  AND (access_status IS NULL OR access_status = 'approved')
  AND email NOT IN ('verifier@demo.com', 'lender@demo.com');

-- Keep seeded/system admin and known demo roles approved.
UPDATE users
SET access_status = 'approved'
WHERE role IN ('admin', 'borrower')
   OR email IN ('admin@demo.com', 'verifier@demo.com', 'lender@demo.com');
