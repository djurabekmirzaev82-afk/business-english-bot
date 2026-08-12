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

router.post('/transcribe', requireAuth, async (req, res) => {
  const { audioBase64, mimeType } = req.body;
  if (!audioBase64) {
    return res.status(400).json({ error: 'Audio topilmadi.' });
  }
  try {
    const result = await aiTutor.transcribeAndAssessPronunciation(audioBase64, mimeType || 'audio/webm');
    res.json(result);
  } catch (err) {
    if (err.code === 'AI_NOT_CONFIGURED') {
      return res.status(503).json({ error: "AI hali sozlanmagan (GEMINI_API_KEY yo'q)." });
    }
    console.error('Transcribe failed:', err.message);
    res.status(500).json({ error: "Audio tahlilida xatolik. Matn bilan urinib ko'ring." });
  }
});

router.post('/submit', requireAuth, async (req, res) => {
  const { topicId, answers, pronunciationNotes } = req.body;
  const topic = topics.find((t) => t.id === topicId);
  if (!topic) return res.status(400).json({ error: 'Mavzu topilmadi.' });
  if (!answers || !answers.part1 || !answers.part2 || !answers.part3) {
    return res.status(400).json({ error: "Barcha uch qism (Part 1, 2, 3) uchun javob talab qilinadi." });
  }

  const notes = pronunciationNotes || {};
  const anyAudioProvided = Boolean(notes.part1 || notes.part2 || notes.part3);

  function block(label, questionsLine, answerText, note) {
    let b = `[${label}]\n${questionsLine}Student's combined answer: ${answerText}`;
    if (note) b += `\n(Pronunciation note for this answer: ${note})`;
    return b;
  }

  const transcriptText = [
    block('Part 1', `Questions asked: ${topic.part1Questions.join(' / ')}\n`, answers.part1, notes.part1),
    block('Part 2', `Cue card: ${topic.part2.cueCardTitle}\n`, answers.part2, notes.part2),
    block('Part 3', `Questions asked: ${topic.part3Questions.join(' / ')}\n`, answers.part3, notes.part3),
  ].join('\n\n');

  try {
    const feedback = await aiTutor.checkIeltsSpeaking(topic.theme, transcriptText, anyAudioProvided);
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
