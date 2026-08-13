const express = require('express');
const fs = require('fs');
const path = require('path');
const pool = require('../../db/pool');
const { requireAuth } = require('../middleware/auth');
const aiTutor = require('../../services/aiTutor');

const router = express.Router();

const categories = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'writingLessons.json'), 'utf8')
);

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

router.get('/lessons', requireAuth, (req, res) => {
  res.json(categories.map(({ id, title, category, task, wordCountMin, wordCountMax }) => ({
    id, title, category, task, wordCountMin, wordCountMax,
  })));
});

// Har chaqirilganda category ichidan TASODIFIY bitta vazifa qaytaradi —
// shu bilan foydalanuvchi har kirganda boshqa-boshqa mashq ko'radi.
router.get('/lessons/:id', requireAuth, (req, res) => {
  const cat = categories.find((c) => c.id === req.params.id);
  if (!cat) return res.status(404).json({ error: 'Mavzu topilmadi.' });
  const prompt = pickRandom(cat.prompts);
  const isStructured = typeof prompt === 'object';
  res.json({
    id: cat.id,
    title: cat.title,
    category: cat.category,
    wordCountMin: cat.wordCountMin,
    wordCountMax: cat.wordCountMax,
    lesson: cat.lesson,
    taskPrompt: isStructured ? prompt.text : prompt,
    chart: isStructured ? prompt.chart : undefined,
    steps: isStructured ? prompt.steps : undefined,
  });
});

router.post('/check', requireAuth, async (req, res) => {
  const { lessonId, text, taskPrompt, chart, steps } = req.body;
  const cat = categories.find((c) => c.id === lessonId);
  if (!cat) return res.status(400).json({ error: 'Mavzu topilmadi.' });
  if (!text || text.trim().length < 15) {
    return res.status(400).json({ error: 'Matn juda qisqa.' });
  }

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  let dataContext = '';
  if (chart) {
    dataContext = `\n\nUnderlying chart data the student was asked to describe (use this to verify accuracy):\nTitle: ${chart.title}\nType: ${chart.type}\nCategories: ${chart.categories.join(', ')}\n${chart.series.map((s) => `${s.name}: ${s.data.join(', ')}`).join('\n')}`;
  } else if (steps) {
    dataContext = `\n\nUnderlying process steps the student was asked to describe (use this to verify accuracy and completeness):\n${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
  }

  const criteriaWithWordCount =
    `${cat.lesson}\n\nTask given to student: ${taskPrompt || ''}${dataContext}\n\n` +
    `Required word count for this task: ${cat.wordCountMin}-${cat.wordCountMax} words. ` +
    `The student's submission has ${wordCount} words — factor this into your BALL score if it is outside the range.`;

  // IELTS Academic Task 1 (grafik/jarayon) — IELTS Band shkalasi (0-9).
  // Multilevel (xat/insho) — O'zbekiston rasmiy Multilevel imtihoni shkalasi (0-75).
  const scoreFormat = cat.category.startsWith('academic_task1') ? 'ieltsBand' : 'multilevel75';

  try {
    const feedback = await aiTutor.checkWriting(
      `${cat.task} — ${cat.title}`,
      text,
      criteriaWithWordCount,
      scoreFormat
    );
    await pool.query(
      `INSERT INTO xp_events (user_id, module, amount, reason) VALUES ($1, 'writing', 15, $2)`,
      [req.userId, cat.title]
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
