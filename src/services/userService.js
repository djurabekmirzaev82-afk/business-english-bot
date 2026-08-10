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

async function promoteToAdmin(userId) {
  const { rows } = await pool.query(
    "UPDATE users SET role = 'admin', updated_at = now() WHERE id = $1 RETURNING *",
    [userId]
  );
  return rows[0];
}

/**
 * Returns aggregate stats for the /admin dashboard: total users, new users
 * today/this week, and the most recently joined users.
 */
async function getAdminStats() {
  const totals = await pool.query(`
    SELECT
      COUNT(*)::int AS total_users,
      COUNT(*) FILTER (WHERE created_at >= now() - interval '1 day')::int AS new_today,
      COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS new_this_week
    FROM users
  `);

  const recent = await pool.query(
    `SELECT telegram_id, username, first_name, last_name, cefr_level, created_at
     FROM users
     ORDER BY created_at DESC
     LIMIT 10`
  );

  const testStats = await pool.query(
    `SELECT COUNT(*)::int AS total_attempts FROM test_attempts WHERE status = 'completed'`
  );

  return {
    ...totals.rows[0],
    totalAttempts: testStats.rows[0].total_attempts,
    recentUsers: recent.rows,
  };
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
  promoteToAdmin,
  getAdminStats,
  getCabinetSummary,
};
