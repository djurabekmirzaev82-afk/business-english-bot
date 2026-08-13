const config = require('../config');

// "gemini-flash-latest" is Google's stable alias that always points to the
// current recommended Flash model — avoids needing to update this string
// every time Google releases a new model version.
const MODEL = 'gemini-flash-latest';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

function assertConfigured() {
  if (!config.geminiApiKey) {
    const err = new Error('GEMINI_API_KEY sozlanmagan. .env fayliga API kalitni qo\'shing.');
    err.code = 'AI_NOT_CONFIGURED';
    throw err;
  }
}

/**
 * `messages` uses the same shape as before ({role: 'user'|'assistant', content: string}[])
 * so callers (writing.js, speaking.js) don't need to change. This function converts
 * that shape into Gemini's contents[]/parts[] format, mapping 'assistant' -> 'model'.
 */
async function callGemini(messages, systemInstruction, maxOutputTokens = 900) {
  assertConfigured();

  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const body = {
    contents,
    generationConfig: { maxOutputTokens, temperature: 0.7 },
  };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const response = await fetch(`${API_URL}?key=${config.geminiApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API xatosi (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const candidate = data.candidates && data.candidates[0];
  const text = candidate?.content?.parts?.map((p) => p.text).join('') || '';
  return text;
}

/**
 * Checks a piece of business writing (letter, essay, etc.) and returns
 * structured feedback in Uzbek: score, strengths, corrections, improved version.
 * `criteria` (optional) is the specific structure/rules the student was taught,
 * so the AI checks against that lesson's requirements rather than generically.
 */
/**
 * Checks a piece of business writing (letter, essay, etc.) and returns
 * structured feedback in Uzbek: score, strengths, corrections, improved version.
 * `criteria` (optional) is the specific structure/rules the student was taught,
 * so the AI checks against that lesson's requirements rather than generically.
 * `scoreFormat`:
 *   'multilevel75' (default) — O'zbekiston Multilevel imtihonining rasmiy shkalasi:
 *      har bir bo'lim (shu jumladan Writing) uchun maksimal 75 ball.
 *   'ieltsBand' — IELTS Academic Task 1 (grafik/jarayon tasviri) uchun, 0-9 band shkalasi,
 *      chunki bu topshiriq Multilevel emas, aynan IELTS formatiga xos.
 */
async function checkWriting(taskType, userText, criteria, scoreFormat = 'multilevel75') {
  const scoreLine =
    scoreFormat === 'ieltsBand'
      ? "BALL (IELTS Band): <0-9 oralig'ida, masalan 6.5 — IELTS Task 1 band descriptorlariga ko'ra>"
      : "BALL: <0-75 raqam — O'zbekiston Multilevel imtihonining rasmiy Writing bo'limi shkalasi bo'yicha>";

  const system =
    'You are a strict but encouraging Business English writing coach for adult students in Uzbekistan. ' +
    'You will receive a piece of writing for a specific task type, and optionally the specific structure/rules ' +
    "the student was just taught for this task type. Check whether the student's writing follows that structure " +
    'and check their grammar, vocabulary, and coherence. Respond ONLY in Uzbek (except for quoting the ' +
    "student's original English text and corrected English text, which stay in English). " +
    'Structure your response exactly like this, with these exact section headers:\n\n' +
    `${scoreLine}\n\n` +
    'KUCHLI TOMONLAR:\n- ...\n\n' +
    "TUZATISHLAR KERAK BO'LGAN JOYLAR:\n- ...\n\n" +
    "TALAB QILINGAN TUZILMAGA MOSLIGI:\n- ...\n\n" +
    'TAKOMILLASHTIRILGAN VARIANT:\n<yaxshilangan matn, ingliz tilida>\n\n' +
    'Keep feedback concrete and specific to the actual text, not generic.';

  const criteriaBlock = criteria
    ? `\n\nThe structure/rules the student was taught for this task:\n"""\n${criteria}\n"""\n`
    : '';

  const userMessage =
    `Task type: ${taskType}${criteriaBlock}\n\nStudent's text:\n"""\n${userText}\n"""\n\n` +
    'Please evaluate this according to the format above.';

  return callGemini([{ role: 'user', content: userMessage }], system, 900);
}

/**
 * Continues a business-English roleplay conversation. `history` is an array of
 * {role: 'user'|'assistant', content: string}. Returns the AI counterpart's next reply.
 */
async function roleplayReply(scenario, history) {
  const system =
    `You are roleplaying as a business counterpart in a "${scenario}" scenario to help an adult student in ` +
    "Uzbekistan practice spoken Business English. Stay in character, keep replies natural and conversational " +
    '(2-4 sentences), and gently move the conversation forward. Respond ONLY in English — this is a speaking ' +
    'practice exercise, not a translation task. Do not break character or add meta-commentary.';

  return callGemini(history, system, 300);
}

/**
 * Produces a short Uzbek-language feedback summary at the end of a roleplay session.
 */
async function roleplaySummary(scenario, history) {
  const system =
    `You just roleplayed a "${scenario}" business scenario with a student. Based on the conversation, give ` +
    'a short feedback summary IN UZBEK covering: (1) umumiy taassurot, (2) yaxshi ishlatilgan iboralar, ' +
    "(3) yaxshilash mumkin bo'lgan joylar. Keep it under 150 words total. Use these exact headers: " +
    "UMUMIY TAASSUROT:, YAXSHI JIHATLAR:, YAXSHILASH MUMKIN:";

  const summaryPrompt = [
    ...history,
    { role: 'user', content: '[Please provide the feedback summary now, in Uzbek, following the format above.]' },
  ];

  return callGemini(summaryPrompt, system, 500);
}

/**
 * Evaluates a full IELTS-style Speaking attempt (Part 1 + Part 2 + Part 3 answers,
 * given as one combined transcript) using IELTS Speaking band descriptors.
 * `hasAudioNotes` — if true, per-answer pronunciation notes (from actual audio) are
 * included in the transcript, so Pronunciation IS assessed as a full criterion.
 * If false (text-only session), Pronunciation is explicitly noted as not assessable.
 */
async function checkIeltsSpeaking(theme, transcript, hasAudioNotes) {
  const pronunciationInstruction = hasAudioNotes
    ? 'The transcript includes pronunciation notes taken from the student\'s actual audio for each answer. ' +
      'Use these to assess Pronunciation as a full fourth criterion, alongside Fluency & Coherence, Lexical ' +
      'Resource, and Grammatical Range & Accuracy — all four official IELTS Speaking criteria.'
    : 'No audio was provided (text-only session), so Pronunciation cannot be assessed — explicitly note this ' +
      'and assess only the three text-assessable criteria: Fluency & Coherence, Lexical Resource, and ' +
      'Grammatical Range & Accuracy.';

  const system =
    'You are an IELTS Speaking examiner giving feedback to a student in Uzbekistan. You will receive a full ' +
    'transcript of a student\'s answers across Part 1 (short interview questions), Part 2 (a 1-2 minute cue-card ' +
    `talk), and Part 3 (discussion questions) on the same theme. ${pronunciationInstruction} ` +
    'Respond ONLY in Uzbek (keep the student\'s own English quotes and any corrected English in English). ' +
    'Structure your response exactly like this:\n\n' +
    'TAXMINIY BALL (Band): <masalan 5.5-6.0 oralig\'ida>\n\n' +
    'FLUENCY & COHERENCE:\n- ...\n\n' +
    'LEXICAL RESOURCE (so\'z boyligi):\n- ...\n\n' +
    'GRAMMATICAL RANGE & ACCURACY:\n- ...\n\n' +
    'PRONUNCIATION:\n- ... (yoki "Matn orqali baholanmaydi" agar audio berilmagan bo\'lsa)\n\n' +
    "YAXSHILASH BO'YICHA TAVSIYALAR:\n- ...\n\n" +
    'Be specific to what the student actually said, not generic.';

  const userMessage = `Theme: ${theme}\n\nFull transcript:\n"""\n${transcript}\n"""\n\nPlease evaluate according to the format above.`;

  return callGemini([{ role: 'user', content: userMessage }], system, 1300);
}

/**
 * Transcribes a spoken audio answer AND gives a short pronunciation note, in one call.
 * `audioBase64` is raw base64 audio data (no data: prefix), `mimeType` e.g. 'audio/ogg' (Telegram voice notes) or 'audio/mpeg' (mp3 uploads).
 * Returns { transcript, pronunciationNote }.
 */
async function transcribeAndAssessPronunciation(audioBase64, mimeType) {
  assertConfigured();

  const prompt =
    'This is a spoken answer from an English learner practicing IELTS Speaking. Respond with EXACTLY two labelled ' +
    'sections, nothing else:\n\n' +
    'TRANSCRIPT:\n<write out exactly what the speaker said, in English>\n\n' +
    'PRONUNCIATION:\n<1-2 sentences IN UZBEK on pronunciation quality — clarity, intonation, word stress, any ' +
    'notable mispronunciations you can hear. Be specific and encouraging, not generic.>';

  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }, { inlineData: { mimeType, data: audioBase64 } }],
      },
    ],
    generationConfig: { maxOutputTokens: 2000, temperature: 0.4 },
  };

  const response = await fetch(`${API_URL}?key=${config.geminiApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API xatosi (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text).join('') || '';

  const transcriptMatch = text.match(/TRANSCRIPT:\s*([\s\S]*?)(?=PRONUNCIATION:|$)/i);
  const pronunciationMatch = text.match(/PRONUNCIATION:\s*([\s\S]*)/i);

  return {
    transcript: transcriptMatch ? transcriptMatch[1].trim() : text.trim(),
    pronunciationNote: pronunciationMatch ? pronunciationMatch[1].trim() : '',
  };
}

module.exports = { checkWriting, roleplayReply, roleplaySummary, checkIeltsSpeaking, transcribeAndAssessPronunciation };
