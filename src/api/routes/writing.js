const express = require('express');
const fs = require('fs');
const path = require('path');
const pool = require('../../db/pool');
const { requireAuth } = require('../middleware/auth');
const aiTutor = require('../../services/aiTutor');

const router = express.Router();

const lessons = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'writingLessons.json'), 'utf8')
);

router.get('/lessons', requireAuth, (req, res) => {
  res.json(lessons.map(({ id, title, category, task }) => ({ id, title, category, task })));
});

router.get('/lessons/:id', requireAuth, (req, res) => {
  const lesson = lessons.find((l) => l.id === req.params.id);
  if (!lesson) return res.status(404).json({ error: 'Mavzu topilmadi.' });
  res.json(lesson);
});

router.post('/check', requireAuth, async (req, res) => {
  const { lessonId, text } = req.body;
  const lesson = lessons.find((l) => l.id === lessonId);
  if (!lesson) return res.status(400).json({ error: 'Mavzu topilmadi.' });
  if (!text || text.trim().length < 15) {
    return res.status(400).json({ error: 'Matn juda qisqa.' });
  }

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const criteriaWithWordCount =
    `${lesson.lesson}\n\nRequired word count for this task: ${lesson.wordCountMin}-${lesson.wordCountMax} words. ` +
    `The student's submission has ${wordCount} words — factor this into your BALL score if it is outside the range.`;

  try {
    const feedback = await aiTutor.checkWriting(
      `${lesson.task} — ${lesson.title}`,
      text,
      criteriaWithWordCount
    );
    await pool.query(
      `INSERT INTO xp_events (user_id, module, amount, reason) VALUES ($1, 'writing', 15, $2)`,
      [req.userId, lesson.title]
    );
    res.json({ feedback, wordCount });
  } catch (err) {
    if (err.code === 'AI_NOT_CONFIGURED') {
      return res.status(503).json({ error: "AI hali sozlanmagan (GEMINI_API_KEY yo'q)." });
    }
    console.error('Writing check failed:', err.message);
    res.status(500).json({ error: 'Texnik xatolik. Qayta urinib ko\'ring.' });
  }
});

module.exports = router;
