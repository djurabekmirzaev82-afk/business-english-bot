-- Business English in Surkhandarya Region — MVP schema
-- Scope: users, student cabinet, placement test (questions, attempts, answers)
--
-- NOTE: telegram_id was widened to nullable so the SAME users table can hold
-- both Telegram-bot users (telegram_id set, no password) and web-app users
-- (email + password_hash set, telegram_id null). A user who signs up on the
-- web and later opens the bot (or vice versa) can eventually be linked by
-- matching phone/email — not automated yet, but the schema allows it.

CREATE TABLE IF NOT EXISTS users (
    id                SERIAL PRIMARY KEY,
    telegram_id       BIGINT UNIQUE,
    email             TEXT UNIQUE,
    password_hash     TEXT,
    full_name         TEXT,
    username          TEXT,
    first_name        TEXT,
    last_name         TEXT,
    phone             TEXT,
    language          TEXT NOT NULL DEFAULT 'uz' CHECK (language IN ('uz', 'ru', 'en')),
    cefr_level        TEXT CHECK (cefr_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
    role              TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'teacher', 'admin')),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT users_identity_present CHECK (telegram_id IS NOT NULL OR email IS NOT NULL)
);

-- Gamification (used by the web app; the bot can adopt these later too)
CREATE TABLE IF NOT EXISTS xp_events (
    id                SERIAL PRIMARY KEY,
    user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module            TEXT NOT NULL,   -- speaking | writing | reading | listening | business
    amount            INTEGER NOT NULL,
    reason            TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS streaks (
    user_id             INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    current_streak      INTEGER NOT NULL DEFAULT 0,
    longest_streak       INTEGER NOT NULL DEFAULT 0,
    last_activity_date    DATE
);

CREATE INDEX IF NOT EXISTS idx_xp_events_user ON xp_events(user_id);

CREATE TABLE IF NOT EXISTS test_questions (
    id                SERIAL PRIMARY KEY,
    level             TEXT NOT NULL CHECK (level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
    skill             TEXT NOT NULL DEFAULT 'grammar' CHECK (skill IN ('grammar', 'vocabulary', 'reading')),
    question_text     TEXT NOT NULL,
    options           JSONB NOT NULL,      -- e.g. ["go", "goes", "going", "gone"]
    correct_option    INTEGER NOT NULL,    -- 0-based index into options
    order_index       INTEGER NOT NULL DEFAULT 0,
    is_active         BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS test_attempts (
    id                SERIAL PRIMARY KEY,
    user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at       TIMESTAMPTZ,
    total_questions   INTEGER NOT NULL DEFAULT 0,
    correct_answers   INTEGER NOT NULL DEFAULT 0,
    result_level      TEXT CHECK (result_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
    status            TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned'))
);

CREATE TABLE IF NOT EXISTS test_answers (
    id                SERIAL PRIMARY KEY,
    attempt_id        INTEGER NOT NULL REFERENCES test_attempts(id) ON DELETE CASCADE,
    question_id       INTEGER NOT NULL REFERENCES test_questions(id),
    selected_option   INTEGER NOT NULL,
    is_correct        BOOLEAN NOT NULL,
    answered_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_test_questions_level ON test_questions(level);
CREATE INDEX IF NOT EXISTS idx_test_attempts_user ON test_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_test_answers_attempt ON test_answers(attempt_id);

-- Migration fix: earlier deployments created these CHECK constraints without 'C2'.
-- Safely widen them here so existing databases (not just brand-new ones) accept C2.
ALTER TABLE test_questions DROP CONSTRAINT IF EXISTS test_questions_level_check;
ALTER TABLE test_questions ADD CONSTRAINT test_questions_level_check
    CHECK (level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));

ALTER TABLE test_attempts DROP CONSTRAINT IF EXISTS test_attempts_result_level_check;
ALTER TABLE test_attempts ADD CONSTRAINT test_attempts_result_level_check
    CHECK (result_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));

-- Migration fix: if this database was created before the web app (email/password_hash,
-- nullable telegram_id) was added, bring an existing `users` table up to date safely.
-- These are no-ops on a brand-new database created straight from the CREATE TABLE above.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE users ALTER COLUMN telegram_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_email_key'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
  END IF;
END $$;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_identity_present;
ALTER TABLE users ADD CONSTRAINT users_identity_present
    CHECK (telegram_id IS NOT NULL OR email IS NOT NULL);
