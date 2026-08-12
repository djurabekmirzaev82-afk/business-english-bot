const express = require("express");
const pool = require("../db/pool");
const { requireAuth } = require("../middleware/auth");
const { getWritingFeedback } = require("../services/gemini");

const router = express.Router();

router.post("/submit", requireAuth, async (req, res) => {
  const { text, level, topic } = req.body;
  if (!text) {
    return res.status(400).json({ error: "Matn talab qilinadi." });
  }
  try {
    const feedback = await getWritingFeedback(text, level || "B1");
    await pool.query(
      `INSERT INTO module_attempts (user_id, module, topic, feedback) VALUES ($1, 'writing', $2, $3)`,
      [req.userId, topic || null, feedback]
    );
    res.json({ feedback });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI baholashda xatolik yuz berdi. Qayta urinib ko'ring." });
  }
});

module.exports = router;
