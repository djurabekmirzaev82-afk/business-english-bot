const fs = require('fs');
const path = require('path');
const pool = require('./pool');

async function seed() {
  const questionsPath = path.join(__dirname, '..', 'data', 'questions.json');
  const questions = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));

  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM test_questions');
  if (rows[0].count > 0) {
    console.log(`test_questions already has ${rows[0].count} rows. Skipping seed (delete rows manually to reseed).`);
    await pool.end();
    return;
  }

  console.log(`Seeding ${questions.length} placement test questions...`);
  for (const q of questions) {
    await pool.query(
      `INSERT INTO test_questions (level, skill, question_text, options, correct_option, order_index)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [q.level, q.skill, q.question_text, JSON.stringify(q.options), q.correct_option, q.order_index]
    );
  }
  console.log('Seed complete.');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
