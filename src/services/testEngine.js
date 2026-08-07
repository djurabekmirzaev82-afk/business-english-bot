const pool = require('../db/pool');

/**
 * CEFR bands based on total correct answers out of the fixed 20-question test
 * (4 questions per level, ordered A1 -> C1 by difficulty).
 */
const LEVEL_BANDS = [
  { min: 0, max: 4, level: 'A1' },
  { min: 5, max: 8, level: 'A2' },
  { min: 9, max: 12, level: 'B1' },
  { min: 13, max: 16, level: 'B2' },
  { min: 17, max: 20, level: 'C1' },
];

function scoreToLevel(correct) {
  const band = LEVEL_BANDS.find((b) => correct >= b.min && correct <= b.max);
  return band ? band.level : 'A1';
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
  const level = scoreToLevel(correct);

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
