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
      "Mavzuni tanlang. Har bir savolga **matn yozib** yoki **ovozli xabar (🎤) yuborib** javob berishingiz mumkin " +
      "— ovozli javob yuborsangiz, AI talaffuzingizni ham baholaydi!\n\n" +
      "Avval qisqa savollar (Part 1), so'ng Cue Card bo'yicha 1-2 daqiqalik nutq (Part 2), " +
      "oxirida chuqurroq muhokama savollari (Part 3) beriladi.",
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
    p1Index: 0,
    transcript: [], // { part, question, answer, pronunciationNote? }
  };

  await ctx.reply(
    `🎬 Mavzu: *${topic.theme}*\n\n*Part 1* — qisqa savollar boshlandi.\n` +
      "Javobingizni matn yoki ovozli xabar (🎤) sifatida yuboring.",
    { parse_mode: 'Markdown', ...endKeyboard }
  );
  await sendPart1Question(ctx, topic);
}

async function sendPart1Question(ctx, topic) {
  const state = ctx.session.ieltsSpeaking;
  const q = topic.part1Questions[state.p1Index];
  await ctx.reply(`❓ ${q}`);
}

async function sendPart2CueCard(ctx, topic) {
  const state = ctx.session.ieltsSpeaking;
  state.stage = 'part2';
  const bullets = topic.part2.bulletPoints.map((b) => `— ${b}`).join('\n');
  await ctx.reply(
    `🎬 *Part 2* — Cue Card\n\n` +
      `*${topic.part2.cueCardTitle}*\n\n` +
      `Quyidagilarni aytib bering:\n${bullets}\n\n` +
      "Real imtihonda 1 daqiqa tayyorlanib, 1-2 daqiqa gapirasiz. Javobingizni matn yoki ovozli xabar " +
      "sifatida yuboring (kamida 100 so'z / ~1 daqiqa tavsiya etiladi).",
    { parse_mode: 'Markdown' }
  );
}

async function sendPart3Questions(ctx, topic) {
  const state = ctx.session.ieltsSpeaking;
  state.stage = 'part3';
  state.p3Index = 0;
  await ctx.reply("🎬 *Part 3* — chuqurroq muhokama savollari boshlandi.", { parse_mode: 'Markdown' });
  await sendPart3Question(ctx, topic);
}

async function sendPart3Question(ctx, topic) {
  const state = ctx.session.ieltsSpeaking;
  const q = topic.part3Questions[state.p3Index];
  await ctx.reply(`❓ ${q}`);
}

/**
 * Central place that records one answer (text or transcribed-from-audio) and
 * advances the flow to the next question/stage. Shared by both the text and
 * voice/audio input paths.
 */
async function recordAnswerAndAdvance(ctx, topic, answerText, pronunciationNote) {
  const state = ctx.session.ieltsSpeaking;

  if (state.stage === 'part1') {
    const q = topic.part1Questions[state.p1Index];
    state.transcript.push({ part: 'Part 1', question: q, answer: answerText, pronunciationNote });

    const nextIdx = state.p1Index + 1;
    if (nextIdx >= topic.part1Questions.length) {
      await sendPart2CueCard(ctx, topic);
    } else {
      state.p1Index = nextIdx;
      await sendPart1Question(ctx, topic);
    }
    return;
  }

  if (state.stage === 'part2') {
    state.transcript.push({ part: 'Part 2', question: topic.part2.cueCardTitle, answer: answerText, pronunciationNote });
    await sendPart3Questions(ctx, topic);
    return;
  }

  if (state.stage === 'part3') {
    const q = topic.part3Questions[state.p3Index];
    state.transcript.push({ part: 'Part 3', question: q, answer: answerText, pronunciationNote });

    const nextIdx = state.p3Index + 1;
    if (nextIdx >= topic.part3Questions.length) {
      await finishSession(ctx, topic);
    } else {
      state.p3Index = nextIdx;
      await sendPart3Question(ctx, topic);
    }
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
      let block = `[${t.part}] Q: ${t.question}\nA: ${t.answer}`;
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
