const express = require('express');
const fs = require('fs');
const path = require('path');
const pool = require('../../db/pool');
const { requireAuth } = require('../middleware/auth');
const aiTutor = require('../../services/aiTutor');

const router = express.Router();

const topics = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'ieltsSpeakingTopics.json'), 'utf8')
);

router.get('/topics', requireAuth, (req, res) => {
  res.json(topics.map(({ id, theme }) => ({ id, theme })));
});

router.get('/topics/:id', requireAuth, (req, res) => {
  const topic = topics.find((t) => t.id === req.params.id);
  if (!topic) return res.status(404).json({ error: 'Mavzu topilmadi.' });
  res.json(topic);
});

/**
 * body: {
 *   topicId,
 *   answers: { part1: "...", part2: "...", part3: "..." }  // combined text per part
 * }
 * Mirrors the bot's finishSession(): builds the same transcript format and calls
 * the same aiTutor.checkIeltsSpeaking() used by the Telegram bot, so scoring is
 * identical across both surfaces. Audio/pronunciation scoring is not wired up
 * for the web yet (text-only), same as a text-only bot session.
 */
router.post('/submit', requireAuth, async (req, res) => {
  const { topicId, answers } = req.body;
  const topic = topics.find((t) => t.id === topicId);
  if (!topic) return res.status(400).json({ error: 'Mavzu topilmadi.' });
  if (!answers || !answers.part1 || !answers.part2 || !answers.part3) {
    return res.status(400).json({ error: "Barcha uch qism (Part 1, 2, 3) uchun javob talab qilinadi." });
  }

  const transcriptText = [
    `[Part 1]\nQuestions asked: ${topic.part1Questions.join(' / ')}\nStudent's combined answer: ${answers.part1}`,
    `[Part 2]\nCue card: ${topic.part2.cueCardTitle}\nStudent's combined answer: ${answers.part2}`,
    `[Part 3]\nQuestions asked: ${topic.part3Questions.join(' / ')}\nStudent's combined answer: ${answers.part3}`,
  ].join('\n\n');

  try {
    const feedback = await aiTutor.checkIeltsSpeaking(topic.theme, transcriptText, false);
    await pool.query(
      `INSERT INTO xp_events (user_id, module, amount, reason) VALUES ($1, 'speaking', 20, $2)`,
      [req.userId, topic.theme]
    );
    res.json({ feedback });
  } catch (err) {
    if (err.code === 'AI_NOT_CONFIGURED') {
      return res.status(503).json({ error: "AI hali sozlanmagan (GEMINI_API_KEY yo'q)." });
    }
    console.error('Speaking check failed:', err.message);
    res.status(500).json({ error: "Texnik xatolik. Qayta urinib ko'ring." });
  }
});

module.exports = router;
