const express = require('express');
const pool = require('../../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/me', requireAuth, async (req, res) => {
  const xpRes = await pool.query(
    'SELECT COALESCE(SUM(amount), 0)::int AS total_xp FROM xp_events WHERE user_id = $1',
    [req.userId]
  );
  const streakRes = await pool.query(
    'SELECT current_streak, longest_streak FROM streaks WHERE user_id = $1',
    [req.userId]
  );
  const userRes = await pool.query(
    'SELECT full_name, email, cefr_level FROM users WHERE id = $1',
    [req.userId]
  );
  res.json({
    xp: xpRes.rows[0].total_xp,
    streak: streakRes.rows[0] || { current_streak: 0, longest_streak: 0 },
    user: userRes.rows[0],
  });
});

router.post('/xp', requireAuth, async (req, res) => {
  const { module, amount, reason } = req.body;
  if (!module || !amount) {
    return res.status(400).json({ error: 'module va amount talab qilinadi.' });
  }
  await pool.query(
    'INSERT INTO xp_events (user_id, module, amount, reason) VALUES ($1, $2, $3, $4)',
    [req.userId, module, amount, reason || null]
  );

  const today = new Date().toISOString().slice(0, 10);
  const { rows } = await pool.query('SELECT * FROM streaks WHERE user_id = $1', [req.userId]);
  const s = rows[0];
  let newStreak = 1;
  if (s && s.last_activity_date) {
    const diffDays = Math.round(
      (new Date(today) - new Date(s.last_activity_date)) / (1000 * 60 * 60 * 24)
    );
    if (diffDays === 0) newStreak = s.current_streak;
    else if (diffDays === 1) newStreak = s.current_streak + 1;
  }
  const longest = Math.max(newStreak, s ? s.longest_streak : 0);
  await pool.query(
    `INSERT INTO streaks (user_id, current_streak, longest_streak, last_activity_date)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id)
     DO UPDATE SET current_streak = $2, longest_streak = $3, last_activity_date = $4`,
    [req.userId, newStreak, longest, today]
  );

  res.json({ ok: true, streak: newStreak });
});

router.get('/leaderboard', requireAuth, async (req, res) => {
  const { rows } = await pool.query(`
    SELECT COALESCE(u.full_name, u.first_name, 'Foydalanuvchi') AS name,
           COALESCE(SUM(x.amount), 0)::int AS total_xp
    FROM users u
    LEFT JOIN xp_events x ON x.user_id = u.id
    GROUP BY u.id
    ORDER BY total_xp DESC
    LIMIT 20
  `);
  res.json(rows);
});

module.exports = router;
