const express = require("express");
const pool = require("../db/pool");
const { requireAuth } = require("../middleware/auth");
const aiTutor = require("../services/aiTutor");

const router = express.Router();

router.post("/submit", requireAuth, async (req, res) => {
  const { text, level, topic } = req.body;
  if (!text) {
    return res.status(400).json({ error: "Matn talab qilinadi." });
  }
  try {
    const taskType = topic || "General Writing";
    // "level" ni criteria matniga qo'shib beramiz, chunki checkWriting buni
    // alohida parametr sifatida qabul qilmaydi, lekin promptga kiritilishi kerak.
    const criteria = `Talaba taxminiy darajasi: ${level || "B1"}. Shu darajaga mos ravishda baholang.`;
    const feedback = await aiTutor.checkWriting(taskType, text, criteria, "multilevel75");
    await pool.query(
      `INSERT INTO module_attempts (user_id, module, topic, feedback) VALUES ($1, 'writing', $2, $3)`,
      [req.userId, topic || null, feedback]
    );
    res.json({ feedback });
  } catch (err) {
    console.error(err);
    if (err.code === "AI_NOT_CONFIGURED") {
      return res.status(503).json({ error: "AI Tutor hali sozlanmagan." });
    }
    res.status(500).json({ error: "AI baholashda xatolik yuz berdi. Qayta urinib ko'ring." });
  }
});

module.exports = router;
