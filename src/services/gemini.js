const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ESLATMA: bu yerga sizning botingizda ishlatilgan aniq promptlarni ko'chirib
// qo'yish kerak (Writing baholash, Speaking transkripsiya baholash va h.k.).
// Hozircha umumiy namuna keltirilgan.

async function getWritingFeedback(text, level) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const prompt = `Siz Multilevel imtihoni bo'yicha ingliz tili baholovchisisiz.
Talaba darajasi: ${level}.
Quyidagi Writing javobini grammatika, leksika, coherence va task achievement bo'yicha bahola.
O'zbek tilida qisqa, aniq fikr-mulohaza ber va CEFR darajasini taxmin qil.

Matn: """${text}"""`;

  const result = await model.generateContent(prompt, {
    // Eslatma: audio/uzun matnlar uchun token limitini oshirish kerak bo'lgan,
    // bu muammo botingizda ham uchragan edi.
    generationConfig: { maxOutputTokens: 1024 },
  });
  return result.response.text();
}

module.exports = { getWritingFeedback };
