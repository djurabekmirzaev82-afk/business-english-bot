const { Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');
const audioTutor = require('../../services/audioTutor');

const content = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'listeningPart5.json'), 'utf8'));
const explanations = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'listeningPartExplanations.json'), 'utf8')
);

function mcKeyboard(extractIdx, qIdx, options) {
  const buttons = options.map((opt, i) => [Markup.button.callback(opt, `lpart5:${extractIdx}:${qIdx}:${i}`)]);
  return Markup.inlineKeyboard(buttons);
}

async function startListeningPart5(ctx) {
  await ctx.answerCbQuery();
  const exp = explanations.part5;
  await ctx.reply(`${exp.title}\n\n${exp.explanation}`, { parse_mode: 'Markdown' });

  if (!process.env.GEMINI_API_KEY) {
    await ctx.reply("⚠️ AI Tutor hali sozlanmagan (GEMINI_API_KEY yo'q). Administrator .env faylga API kalitni qo'shishi kerak.");
    return;
  }

  ctx.session.listeningPart5 = { extractIndex: 0, qIndex: 0, correct: 0 };
  await playExtractAndAsk(ctx);
}

async function playExtractAndAsk(ctx) {
  const state = ctx.session.listeningPart5;
  const extract = content.extracts[state.extractIndex];

  await ctx.reply(`🎙 ${extract.label}`);
  await ctx.reply('⏳ Audio tayyorlanmoqda...');

  try {
    let audioBuffer;
    if (extract.isDialogue) {
      audioBuffer = await audioTutor.generateDialogueSpeech(extract.script, 'A', 'Kore', 'B', 'Puck');
    } else {
      audioBuffer = await audioTutor.generateSpeech(extract.script);
    }
    await ctx.replyWithAudio({
      source: audioBuffer,
      filename: `listening_part5_extract${extract.extractNumber}.wav`,
    });
  } catch (err) {
    console.error('Listening Part 5 audio generation failed:', err.message);
    await ctx.reply("Audio yaratishda texnik xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring.");
    return;
  }

  await sendQuestion(ctx);
}

async function sendQuestion(ctx) {
  const state = ctx.session.listeningPart5;
  const extract = content.extracts[state.extractIndex];
  const q = extract.questions[state.qIndex];
  await ctx.reply(`❓ ${q.number}) ${q.q}`, mcKeyboard(state.extractIndex, state.qIndex, q.options));
}

async function handleAnswer(ctx) {
  const extractIdx = parseInt(ctx.match[1], 10);
  const qIdx = parseInt(ctx.match[2], 10);
  const selected = parseInt(ctx.match[3], 10);

  const state = ctx.session.listeningPart5;
  if (!state) {
    await ctx.answerCbQuery('Sessiya topilmadi.');
    return;
  }
  const extract = content.extracts[extractIdx];
  const q = extract.questions[qIdx];

  const isCorrect = selected === q.correct;
  if (isCorrect) state.correct += 1;

  await ctx.answerCbQuery(isCorrect ? "✅ To'g'ri!" : `❌ Noto'g'ri. To'g'ri javob: ${q.options[q.correct]}`);
  await ctx.editMessageReplyMarkup(undefined).catch(() => {});

  const nextQIdx = qIdx + 1;
  if (nextQIdx < extract.questions.length) {
    state.qIndex = nextQIdx;
    await sendQuestion(ctx);
    return;
  }

  const nextExtractIdx = extractIdx + 1;
  if (nextExtractIdx >= content.extracts.length) {
    const { mainMenu } = require('../keyboards');
    const total = content.extracts.reduce((sum, e) => sum + e.questions.length, 0);
    await ctx.reply(`🏆 Part 5 (Listening) yakunlandi!\n\n📊 Natija: ${state.correct}/${total}`, mainMenu);
    ctx.session.listeningPart5 = null;
    return;
  }

  state.extractIndex = nextExtractIdx;
  state.qIndex = 0;
  await playExtractAndAsk(ctx);
}

module.exports = { startListeningPart5, handleAnswer };
