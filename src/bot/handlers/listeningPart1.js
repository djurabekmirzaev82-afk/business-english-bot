const { Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');
const audioTutor = require('../../services/audioTutor');

const items = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'listeningPart1.json'), 'utf8'));
const explanations = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'listeningPartExplanations.json'), 'utf8')
);

async function startListeningPart1(ctx) {
  await ctx.answerCbQuery();
  const exp = explanations.part1;
  await ctx.reply(`${exp.title}\n\n${exp.explanation}`, { parse_mode: 'Markdown' });
  await ctx.reply('🎧 8 ta gap eshitasiz. Har biriga eng mos javobni tanlang.');

  ctx.session.listeningPart1 = { index: 0, correct: 0 };
  await sendItem(ctx);
}

async function sendItem(ctx) {
  const state = ctx.session.listeningPart1;
  const item = items[state.index];

  if (!process.env.GEMINI_API_KEY) {
    await ctx.reply("⚠️ AI Tutor hali sozlanmagan (GEMINI_API_KEY yo'q). Administrator .env faylga API kalitni qo'shishi kerak.");
    ctx.session.listeningPart1 = null;
    return;
  }

  await ctx.reply(`⏳ ${item.number}/8 audio tayyorlanmoqda...`);

  try {
    const audioBuffer = await audioTutor.generateSpeech(`Say naturally: ${item.sentence}`);
    await ctx.replyWithAudio({ source: audioBuffer, filename: `listening_${item.number}.wav` });
  } catch (err) {
    console.error('Listening audio generation failed:', err.message);
    await ctx.reply("Audio yaratishda texnik xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring.");
    ctx.session.listeningPart1 = null;
    return;
  }

  const letters = ['A', 'B', 'C'];
  const buttons = item.options.map((opt, i) => [Markup.button.callback(`${letters[i]}) ${opt}`, `lpart1:${i}`)]);
  await ctx.reply(`❓ ${item.number}) Eng mos javobni tanlang:`, Markup.inlineKeyboard(buttons));
}

async function handleAnswer(ctx) {
  const selected = parseInt(ctx.match[1], 10);
  const state = ctx.session.listeningPart1;
  if (!state) {
    await ctx.answerCbQuery('Sessiya topilmadi.');
    return;
  }
  const item = items[state.index];

  const isCorrect = selected === item.correct;
  if (isCorrect) state.correct += 1;

  const letters = ['A', 'B', 'C'];
  await ctx.answerCbQuery(
    isCorrect ? "✅ To'g'ri!" : `❌ Noto'g'ri. To'g'ri javob: ${letters[item.correct]}) ${item.options[item.correct]}`
  );
  await ctx.editMessageReplyMarkup(undefined).catch(() => {});

  const nextIndex = state.index + 1;
  if (nextIndex >= items.length) {
    const { mainMenu } = require('../keyboards');
    await ctx.reply(`🏆 Part 1 (Listening) yakunlandi!\n\n📊 Natija: ${state.correct}/${items.length}`, mainMenu);
    ctx.session.listeningPart1 = null;
    return;
  }

  state.index = nextIndex;
  await sendItem(ctx);
}

module.exports = { startListeningPart1, handleAnswer };
