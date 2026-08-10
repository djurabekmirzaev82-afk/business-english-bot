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
      "Mavzuni tanlang. Avval qisqa savollar (Part 1), so'ng Cue Card bo'yicha 1-2 daqiqalik nutq (Part 2), " +
      "oxirida chuqurroq muhokama savollari (Part 3) beriladi. Oxirida AI IELTS mezonlari bo'yicha baholaydi.",
    topicKeyboard()
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
    transcript: [], // { part, question, answer }
  };

  await ctx.reply(`🎬 Mavzu: *${topic.theme}*\n\n*Part 1* — qisqa savollar boshlandi.`, {
    parse_mode: 'Markdown',
    ...endKeyboard,
  });
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
      "Real imtihonda 1 daqiqa tayyorlanib, 1-2 daqiqa gapirasiz. Shu yerda — javobingizni bitta uzun xabar sifatida yozing (kamida 100 so'z tavsiya etiladi).",
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
 * Called from the generic text handler when ctx.session.ieltsSpeaking is set.
 * Routes the free-text answer based on the current stage (part1 / part2 / part3).
 */
async function handleAnswer(ctx) {
  const state = ctx.session.ieltsSpeaking;
  const topic = topics.find((t) => t.id === state.topicId);
  const userText = ctx.message.text;

  if (state.stage === 'part1') {
    const q = topic.part1Questions[state.p1Index];
    state.transcript.push({ part: 'Part 1', question: q, answer: userText });

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
    state.transcript.push({ part: 'Part 2', question: topic.part2.cueCardTitle, answer: userText });
    await sendPart3Questions(ctx, topic);
    return;
  }

  if (state.stage === 'part3') {
    const q = topic.part3Questions[state.p3Index];
    state.transcript.push({ part: 'Part 3', question: q, answer: userText });

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

async function finishSession(ctx, topic) {
  const { mainMenu } = require('../keyboards');
  const state = ctx.session.ieltsSpeaking;

  await ctx.reply('⏳ AI javoblaringizni baholamoqda, biroz kuting...', Markup.removeKeyboard());

  const transcriptText = state.transcript
    .map((t) => `[${t.part}] Q: ${t.question}\nA: ${t.answer}`)
    .join('\n\n');

  try {
    const feedback = await aiTutor.checkIeltsSpeaking(topic.theme, transcriptText);
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

module.exports = { showIeltsSpeakingMenu, startTopic, handleAnswer, endEarly };
