const config = require('../config');

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001'; // fast + cost-effective, good enough for feedback/roleplay

function assertConfigured() {
  if (!config.anthropicApiKey) {
    const err = new Error('ANTHROPIC_API_KEY sozlanmagan. .env fayliga API kalitni qo\'shing.');
    err.code = 'AI_NOT_CONFIGURED';
    throw err;
  }
}

async function callClaude(messages, system, maxTokens = 700) {
  assertConfigured();

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API xatosi (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const textBlock = data.content.find((b) => b.type === 'text');
  return textBlock ? textBlock.text : '';
}

/**
 * Checks a piece of business writing (letter, essay, etc.) and returns
 * structured feedback in Uzbek: score, strengths, corrections, improved version.
 * `criteria` (optional) is the specific structure/rules the student was taught,
 * so the AI checks against that lesson's requirements rather than generically.
 */
async function checkWriting(taskType, userText, criteria) {
  const system =
    'You are a strict but encouraging Business English writing coach for adult students in Uzbekistan. ' +
    'You will receive a piece of writing for a specific task type, and optionally the specific structure/rules ' +
    "the student was just taught for this task type. Check whether the student's writing follows that structure " +
    'and check their grammar, vocabulary, and coherence. Respond ONLY in Uzbek (except for quoting the ' +
    "student's original English text and corrected English text, which stay in English). " +
    'Structure your response exactly like this, with these exact section headers:\n\n' +
    'BALL: <0-100 raqam>\n\n' +
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

  return callClaude([{ role: 'user', content: userMessage }], system, 900);
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

  return callClaude(history, system, 300);
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

  return callClaude(summaryPrompt, system, 500);
}

module.exports = { checkWriting, roleplayReply, roleplaySummary };
