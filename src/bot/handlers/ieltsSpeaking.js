const { Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');
const aiTutor = require('../../services/aiTutor');

const topics = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'ieltsSpeakingTopics.json'), 'utf8')
);

function topicKeyboard() {
  const buttons = topics.map((t) => [Markup.button.callback(t.theme, `ispeak:${t.id}`)]);
  return Markup.inlineKeyboard(buttons);
}

const endKeyboard = Markup.keyboard([['🛑 Suhbatni tugatish']]).resize();

async function showIeltsSpeakingMenu(ctx) {
  await ctx.reply(
    '🎓 IELTS Speaking (Part 1 → Part 2 → Part 3)\n\n' +
      "Mavzuni tanlang. Har bir Part barcha savollari bilan bitta karta sifatida ko'rsatiladi — " +
      "shundan so'ng faqat 🎤 mikrofonni bosib, barcha savollarga ketma-ket gapirib javob bering " +
      "(yoki xohlasangiz matn yozing).",
    { parse_mode: 'Markdown', ...topicKeyboard() }
  );
}

async function startTopic(ctx) {
  const topicId = ctx.match[1];
  const topic = topics.find((t) => t.id === topicId);
  if (!topic) {
    await ctx.answerCbQuery('Mavzu topilmadi.');
    return;
  }
  await ctx.answerCbQuery();

  if (!process.env.GEMINI_API_KEY) {
    await ctx.reply(
      "⚠️ AI Tutor hali sozlanmagan (GEMINI_API_KEY yo'q). Administrator .env faylga API kalitni qo'shishi kerak."
    );
    return;
  }

  ctx.session.pendingWriting = null;
  ctx.session.pendingSpeaking = null;
  ctx.session.ieltsSpeaking = {
    topicId,
    stage: 'part1',
    transcript: [], // { part, answer, pronunciationNote? }
  };

  await ctx.reply(`🎬 Mavzu: *${topic.theme}*`, { parse_mode: 'Markdown', ...endKeyboard });
  await sendPart1Card(ctx, topic);
}

async function sendPart1Card(ctx, topic) {
  const questionsList = topic.part1Questions.map((q, i) => `${i + 1}) ${q}`).join('\n');
  await ctx.reply(
    `🗂 *Part 1*\n\n${questionsList}\n\n` +
      "🎤 Endi mikrofonni bosib, shu savollarning barchasiga ketma-ket gapirib javob bering " +
      "(yoki matn yozing).",
    { parse_mode: 'Markdown' }
  );
}

async function sendPart2Card(ctx, topic) {
  const state = ctx.session.ieltsSpeaking;
  state.stage = 'part2';
  const bullets = topic.part2.bulletPoints.map((b) => `— ${b}`).join('\n');
  await ctx.reply(
    `🗂 *Part 2* — Cue Card\n\n` +
      `*${topic.part2.cueCardTitle}*\n\n` +
      `Quyidagilarni aytib bering:\n${bullets}\n\n` +
      "🎤 Real imtihonda 1 daqiqa tayyorlanib, 1-2 daqiqa gapirasiz. Mikrofonni bosib javob bering " +
      "(yoki matn yozing, kamida 100 so'z tavsiya etiladi).",
    { parse_mode: 'Markdown' }
  );
}

async function sendPart3Card(ctx, topic) {
  const state = ctx.session.ieltsSpeaking;
  state.stage = 'part3';
  const questionsList = topic.part3Questions.map((q, i) => `${i + 1}) ${q}`).join('\n');
  await ctx.reply(
    `🗂 *Part 3*\n\n${questionsList}\n\n` +
      "🎤 Mikrofonni bosib, shu savollarning barchasiga ketma-ket gapirib javob bering (yoki matn yozing).",
    { parse_mode: 'Markdown' }
  );
}

/**
 * Central place that records one part's full answer (text or transcribed-from-audio)
 * and advances the flow to the next card. Shared by both the text and voice/audio paths.
 */
async function recordAnswerAndAdvance(ctx, topic, answerText, pronunciationNote) {
  const state = ctx.session.ieltsSpeaking;

  if (state.stage === 'part1') {
    state.transcript.push({ part: 'Part 1', answer: answerText, pronunciationNote });
    await sendPart2Card(ctx, topic);
    return;
  }

  if (state.stage === 'part2') {
    state.transcript.push({ part: 'Part 2', answer: answerText, pronunciationNote });
    await sendPart3Card(ctx, topic);
    return;
  }

  if (state.stage === 'part3') {
    state.transcript.push({ part: 'Part 3', answer: answerText, pronunciationNote });
    await finishSession(ctx, topic);
    return;
  }
}

/**
 * Called from the generic text handler when ctx.session.ieltsSpeaking is set
 * and the user sent a plain text message.
 */
async function handleAnswer(ctx) {
  const state = ctx.session.ieltsSpeaking;
  const topic = topics.find((t) => t.id === state.topicId);
  await recordAnswerAndAdvance(ctx, topic, ctx.message.text, null);
}

/**
 * Called when the user sends a voice note or an audio file while an IELTS
 * Speaking session is active. Downloads the file from Telegram, sends it to
 * Gemini for transcription + a pronunciation note, then records the answer.
 */
async function handleAudioAnswer(ctx) {
  const state = ctx.session.ieltsSpeaking;
  const topic = topics.find((t) => t.id === state.topicId);

  const voice = ctx.message.voice;
  const audio = ctx.message.audio;
  const fileId = voice ? voice.file_id : audio ? audio.file_id : null;
  const mimeType = voice ? 'audio/ogg' : audio && audio.mime_type ? audio.mime_type : 'audio/mpeg';

  if (!fileId) {
    await ctx.reply("Bu fayl turini qabul qila olmadim. Iltimos, ovozli xabar (🎤) yoki audio fayl yuboring.");
    return;
  }

  await ctx.reply('⏳ Audio tinglanmoqda va tahlil qilinmoqda...');

  try {
    const fileLink = await ctx.telegram.getFileLink(fileId);
    const response = await fetch(fileLink.href || fileLink.toString());
    const arrayBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');

    const { transcript, pronunciationNote } = await aiTutor.transcribeAndAssessPronunciation(base64Audio, mimeType);

    await ctx.reply(`📝 Eshitilgan javob:\n"${transcript}"`);
    await recordAnswerAndAdvance(ctx, topic, transcript, pronunciationNote);
  } catch (err) {
    console.error('Audio answer processing failed:', err.message);
    await ctx.reply("Audio bilan ishlashda texnik xatolik yuz berdi. Iltimos, matn bilan javob berib ko'ring.");
  }
}

async function finishSession(ctx, topic) {
  const { mainMenu } = require('../keyboards');
  const state = ctx.session.ieltsSpeaking;

  await ctx.reply('⏳ AI javoblaringizni baholamoqda, biroz kuting...', Markup.removeKeyboard());

  const transcriptText = state.transcript
    .map((t) => {
      let questionsContext = '';
      if (t.part === 'Part 1') questionsContext = `Questions asked: ${topic.part1Questions.join(' / ')}\n`;
      if (t.part === 'Part 2') questionsContext = `Cue card: ${topic.part2.cueCardTitle}\n`;
      if (t.part === 'Part 3') questionsContext = `Questions asked: ${topic.part3Questions.join(' / ')}\n`;

      let block = `[${t.part}]\n${questionsContext}Student's combined answer: ${t.answer}`;
      if (t.pronunciationNote) block += `\n(Pronunciation note for this answer: ${t.pronunciationNote})`;
      return block;
    })
    .join('\n\n');

  const anyAudioProvided = state.transcript.some((t) => t.pronunciationNote);

  try {
    const feedback = await aiTutor.checkIeltsSpeaking(topic.theme, transcriptText, anyAudioProvided);
    await ctx.reply(feedback, mainMenu);
  } catch (err) {
    console.error('IELTS Speaking check failed:', err.message);
    await ctx.reply('Texnik xatolik yuz berdi. Sessiya yakunlandi.', mainMenu);
  } finally {
    ctx.session.ieltsSpeaking = null;
  }
}

/** Allows ending early via the "🛑 Suhbatni tugatish" button (reused from free-roleplay Speaking Club). */
async function endEarly(ctx) {
  const { mainMenu } = require('../keyboards');
  if (!ctx.session.ieltsSpeaking) return false; // let the other handler (free roleplay) deal with it
  await ctx.reply("IELTS Speaking mashqi bekor qilindi.", mainMenu);
  ctx.session.ieltsSpeaking = null;
  return true;
}

module.exports = { showIeltsSpeakingMenu, startTopic, handleAnswer, handleAudioAnswer, endEarly };
