-- Business English in Surkhandarya Region — MVP schema
-- Scope: users, student cabinet, placement test (questions, attempts, answers)

CREATE TABLE IF NOT EXISTS users (
    id                SERIAL PRIMARY KEY,
    telegram_id       BIGINT UNIQUE NOT NULL,
    username          TEXT,
    first_name        TEXT,
    last_name         TEXT,
    phone             TEXT,
    language          TEXT NOT NULL DEFAULT 'uz' CHECK (language IN ('uz', 'ru', 'en')),
    cefr_level        TEXT CHECK (cefr_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
    role              TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'teacher', 'admin')),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
