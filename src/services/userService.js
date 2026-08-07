const pool = require('../db/pool');

/**
 * Finds a user by their Telegram ID, creating a new row on first contact.
 * Also refreshes name/username in case they changed in Telegram.
 */
async function findOrCreateUser(ctx) {
  const from = ctx.from;
  const { rows } = await pool.query(
    `INSERT INTO users (telegram_id, username, first_name, last_name)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (telegram_id)
     DO UPDATE SET
       username = EXCLUDED.username,
       first_name = EXCLUDED.first_name,
       last_name = EXCLUDED.last_name,
       updated_at = now()
     RETURNING *`,
    [from.id, from.username || null, from.first_name || null, from.last_name || null]
  );
  return rows[0];
}

async function getUserByTelegramId(telegramId) {
  const { rows } = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);
  return rows[0] || null;
}

async function setUserLevel(userId, level) {
  await pool.query('UPDATE users SET cefr_level = $1, updated_at = now() WHERE id = $2', [level, userId]);
}

async function setLanguage(userId, language) {
  await pool.query('UPDATE users SET language = $1, updated_at = now() WHERE id = $2', [language, userId]);
}

/**
 * Returns cabinet data: profile + most recent completed placement attempt + attempt history count.
 */
async function getCabinetSummary(userId) {
  const attempts = await pool.query(
    `SELECT id, finished_at, total_questions, correct_answers, result_level
     FROM test_attempts
     WHERE user_id = $1 AND status = 'completed'
     ORDER BY finished_at DESC`,
    [userId]
  );
  return {
    latestAttempt: attempts.rows[0] || null,
    attemptCount: attempts.rows.length,
    history: attempts.rows,
  };
}

module.exports = {
  findOrCreateUser,
  getUserByTelegramId,
  setUserLevel,
  setLanguage,
  getCabinetSummary,
};
