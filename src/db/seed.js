const fs = require('fs');
const path = require('path');
const pool = require('./pool');

/**
 * Upserts placement-test questions by order_index: updates the question in place
 * if that slot already exists (safe to re-run after content changes, and doesn't
 * break existing test_attempts/test_answers rows that reference old question ids),
 * or inserts it if it's new.
 */
async function seed() {
  const questionsPath = path.join(__dirname, '..', 'data', 'questions.json');
  const questions = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));

  console.log(`Upserting ${questions.length} placement test questions (by order_index)...`);
  for (const q of questions) {
    const { rows } = await pool.query('SELECT id FROM test_questions WHERE order_index = $1', [q.order_index]);
    if (rows.length > 0) {
      await pool.query(
        `UPDATE test_questions
         SET level = $1, skill = $2, question_text = $3, options = $4, correct_option = $5, is_active = true
         WHERE order_index = $6`,
        [q.level, q.skill, q.question_text, JSON.stringify(q.options), q.correct_option, q.order_index]
      );
    } else {
      await pool.query(
        `INSERT INTO test_questions (level, skill, question_text, options, correct_option, order_index)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [q.level, q.skill, q.question_text, JSON.stringify(q.options), q.correct_option, q.order_index]
      );
    }
  }

  // Deactivate any leftover old questions beyond the current question count
  // (e.g. if a previous version had more questions than the new one).
  const maxOrderIndex = Math.max(...questions.map((q) => q.order_index));
  await pool.query('UPDATE test_questions SET is_active = false WHERE order_index > $1', [maxOrderIndex]);

  console.log('Seed complete.');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
