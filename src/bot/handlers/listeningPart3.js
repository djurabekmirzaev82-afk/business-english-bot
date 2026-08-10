const { Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');
const audioTutor = require('../../services/audioTutor');

const content = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'listeningPart3.json'), 'utf8'));
const explanations = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'listeningPartExplanations.json'), 'utf8')
);

function optionsKeyboard(usedLabels) {
  const available = content.options.filter((o) => !usedLabels.includes(o.label));
  const buttons = available.map((o) => [Markup.button.callback(`${o.label}) ${o.text}`, `lpart3:${o.label}`)]);
  return Markup.inlineKeyboard(buttons);
}

async function startListeningPart3(ctx) {
  await ctx.answerCbQuery();
  const exp = explanations.part3;
  await ctx.reply(`${exp.title}\n\n${exp.explanation}`, { parse_mode: 'Markdown' });

  if (!process.env.GEMINI_API_KEY) {
    await ctx.reply("⚠️ AI Tutor hali sozlanmagan (GEMINI_API_KEY yo'q). Administrator .env faylga API kalitni qo'shishi kerak.");
    return;
  }

  let optionsMsg = "Variantlar (A-F):\n";
  content.options.forEach((o) => (optionsMsg += `${o.label}) ${o.text}\n`));
  await ctx.reply(optionsMsg);

  for (const speaker of content.speakers) {
    await ctx.reply(`🎙 Speaker ${speaker.number - 14}`);
    await ctx.reply('⏳ Audio tayyorlanmoqda...');
    try {
      const audioBuffer = await audioTutor.generateSpeech(speaker.script);
      await ctx.replyWithAudio({ source: audioBuffer, filename: `listening_part3_speaker${speaker.number}.wav` });
    } catch (err) {
      console.error('Listening Part 3 audio generation failed:', err.message);
      await ctx.reply("Audio yaratishda texnik xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring.");
      return;
    }
  }

  ctx.session.listeningPart3 = { index: 0, correct: 0, used: [] };
  await sendQuestion(ctx);
}

async function sendQuestion(ctx) {
  const state = ctx.session.listeningPart3;
  const speaker = content.speakers[state.index];
  await ctx.reply(`❓ Speaker ${speaker.number - 14} (${speaker.number})`, optionsKeyboard(state.used));
}

async function handleAnswer(ctx) {
  const chosenLabel = ctx.match[1];
  const state = ctx.session.listeningPart3;
  if (!state) {
    await ctx.answerCbQuery('Sessiya topilmadi.');
    return;
  }
  const speaker = content.speakers[state.index];

  const isCorrect = content.answers[speaker.number] === chosenLabel;
  if (isCorrect) state.correct += 1;
  state.used.push(chosenLabel);

  await ctx.answerCbQuery(
    isCorrect ? "✅ To'g'ri!" : `❌ Noto'g'ri. To'g'ri javob: ${content.answers[speaker.number]}`
  );
  await ctx.editMessageReplyMarkup(undefined).catch(() => {});

  const nextIndex = state.index + 1;
  if (nextIndex >= content.speakers.length) {
    const { mainMenu } = require('../keyboards');
    await ctx.reply(`🏆 Part 3 (Listening) yakunlandi!\n\n📊 Natija: ${state.correct}/${content.speakers.length}`, mainMenu);
    ctx.session.listeningPart3 = null;
    return;
  }

  state.index = nextIndex;
  await sendQuestion(ctx);
}

module.exports = { startListeningPart3, handleAnswer };
