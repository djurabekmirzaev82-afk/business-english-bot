const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../../db/pool');
const config = require('../../config');

const router = express.Router();

router.use((req, res, next) => {
  if (!config.jwtSecret) {
    return res.status(503).json({ error: "Web login hali sozlanmagan (JWT_SECRET .env'da yo'q)." });
  }
  next();
});

router.post('/register', async (req, res) => {
  const { fullName, email, password } = req.body;
  if (!fullName || !email || !password) {
    return res.status(400).json({ error: 'Ism, email va parol talab qilinadi.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Parol kamida 6 belgidan iborat bo\'lishi kerak.' });
  }
  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Bu email bilan foydalanuvchi allaqachon mavjud.' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (full_name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, full_name, email, cefr_level, role`,
      [fullName, email, passwordHash]
    );
    const user = rows[0];
    await pool.query(
      `INSERT INTO streaks (user_id, current_streak, longest_streak) VALUES ($1, 0, 0)
       ON CONFLICT (user_id) DO NOTHING`,
      [user.id]
    );
    const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: '30d' });
    res.status(201).json({ token, user });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ error: 'Server xatoligi. Qayta urinib ko\'ring.' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email va parol talab qilinadi.' });
  }
  try {
    const { rows } = await pool.query(
      'SELECT id, full_name, email, password_hash, cefr_level, role FROM users WHERE email = $1',
      [email]
    );
    const user = rows[0];
    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'Email yoki parol noto\'g\'ri.' });
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Email yoki parol noto\'g\'ri.' });
    }
    delete user.password_hash;
    const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: '30d' });
    res.json({ token, user });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Server xatoligi. Qayta urinib ko\'ring.' });
  }
});

module.exports = router;
