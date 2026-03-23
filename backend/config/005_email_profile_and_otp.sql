-- migrations/005_email_profile_and_otp.sql
-- Adds secure registration support and richer contact profile fields.

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

CREATE TABLE IF NOT EXISTS email_verification_codes (
  id              SERIAL PRIMARY KEY,
  email           VARCHAR(255) NOT NULL,
  code_hash       VARCHAR(128) NOT NULL,
  attempts        INTEGER NOT NULL DEFAULT 0,
  expires_at      TIMESTAMPTZ NOT NULL,
  consumed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_verification_email ON email_verification_codes(email);
CREATE INDEX IF NOT EXISTS idx_email_verification_expiry ON email_verification_codes(expires_at);
