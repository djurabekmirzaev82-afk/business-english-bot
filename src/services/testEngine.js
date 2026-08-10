const pool = require('../db/pool');

/**
 * CEFR bands for the 20-question placement test (A2 floor — no A1 content —
 * up to C2 ceiling). Distribution: Q1-5 A2, Q6-10 B1, Q11-15 B2, Q16-18 C1, Q19-20 C2.
 * C2 is only awarded if BOTH C2-level questions were answered correctly — otherwise
 * the result is capped at C1, since 2 questions alone aren't reliable enough to
 * confidently certify C2 on their own.
 */
const LEVEL_BANDS = [
  { min: 0, max: 4, level: 'A2' },
  { min: 5, max: 9, level: 'B1' },
  { min: 10, max: 14, level: 'B2' },
  { min: 15, max: 17, level: 'C1' },
  { min: 18, max: 20, level: 'C2' }, // provisional — see the C2 gate in finishAttempt
];

function scoreToLevel(correct) {
  const band = LEVEL_BANDS.find((b) => correct >= b.min && correct <= b.max);
  return band ? band.level : 'A2';
}

async function getAllQuestionsOrdered() {
  const { rows } = await pool.query(
    `SELECT id, level, skill, question_text, options, correct_option, order_index
     FROM test_questions
     WHERE is_active = true
     ORDER BY order_index ASC`
  );
  return rows;
}

async function startAttempt(userId, totalQuestions) {
  const { rows } = await pool.query(
    `INSERT INTO test_attempts (user_id, total_questions, status)
     VALUES ($1, $2, 'in_progress')
     RETURNING id`,
    [userId, totalQuestions]
  );
  return rows[0].id;
}

async function recordAnswer(attemptId, question, selectedOption) {
  const isCorrect = selectedOption === question.correct_option;
  await pool.query(
    `INSERT INTO test_answers (attempt_id, question_id, selected_option, is_correct)
     VALUES ($1, $2, $3, $4)`,
    [attemptId, question.id, selectedOption, isCorrect]
  );
  return isCorrect;
}

async function finishAttempt(attemptId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS correct FROM test_answers WHERE attempt_id = $1 AND is_correct = true`,
    [attemptId]
  );
  const correct = rows[0].correct;
  let level = scoreToLevel(correct);

  // C2 gate: only confirm C2 if BOTH C2-level questions were answered correctly.
  if (level === 'C2') {
    const { rows: c2Rows } = await pool.query(
      `SELECT COUNT(*)::int AS c2_correct
       FROM test_answers ta
       JOIN test_questions tq ON tq.id = ta.question_id
       WHERE ta.attempt_id = $1 AND tq.level = 'C2' AND ta.is_correct = true`,
      [attemptId]
    );
    if (c2Rows[0].c2_correct < 2) {
      level = 'C1'; // not enough evidence for C2 — cap the result at C1
    }
  }

  await pool.query(
    `UPDATE test_attempts
     SET finished_at = now(), correct_answers = $1, result_level = $2, status = 'completed'
     WHERE id = $3`,
    [correct, level, attemptId]
  );

  return { correct, level };
}

module.exports = {
  getAllQuestionsOrdered,
  startAttempt,
  recordAnswer,
  finishAttempt,
  scoreToLevel,
};
