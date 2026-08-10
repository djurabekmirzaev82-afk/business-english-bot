const fs = require('fs');
const path = require('path');
const audioTutor = require('../../services/audioTutor');

const content = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'listeningPart2.json'), 'utf8'));
const explanations = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'listeningPartExplanations.json'), 'utf8')
);

function normalize(w) {
  return w.trim().toLowerCase().replace(/[.,!?;:]/g, '');
}

async function startListeningPart2(ctx) {
  await ctx.answerCbQuery();
  const exp = explanations.part2;
  await ctx.reply(`${exp.title}\n\n${exp.explanation}`, { parse_mode: 'Markdown' });

  if (!process.env.GEMINI_API_KEY) {
    await ctx.reply("⚠️ AI Tutor hali sozlanmagan (GEMINI_API_KEY yo'q). Administrator .env faylga API kalitni qo'shishi kerak.");
    return;
  }

  await ctx.reply(content.notesTemplate);
  await ctx.reply('⏳ Audio tayyorlanmoqda...');

  try {
    const audioBuffer = await audioTutor.generateSpeech(`Say naturally: ${content.script}`);
    await ctx.replyWithAudio({ source: audioBuffer, filename: 'listening_part2.wav' });
  } catch (err) {
    console.error('Listening Part 2 audio generation failed:', err.message);
    await ctx.reply("Audio yaratishda texnik xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring.");
    return;
  }

  await ctx.reply(
    `✍ Tinglab, yuqoridagi 6 ta bo'shliqni (9-14) to'ldiring. Javoblaringizni vergul bilan ajratib, tartibda yuboring ` +
      `(masalan: so'z1, so'z2, so'z3, so'z4, so'z5, so'z6):`
  );
  ctx.session.listeningPart2 = { awaiting: true };
}

async function handleAnswer(ctx) {
  const state = ctx.session.listeningPart2;
  if (!state || !state.awaiting) return false; // not our turn — let other handlers deal with it

  const words = ctx.message.text.split(',').map((w) => w.trim());
  let correct = 0;
  let feedback = `📊 Part 2 natijasi: `;

  const results = content.gaps.map((gap, i) => {
    const userWord = normalize(words[i] || '');
    const isCorrect = gap.answers.some((a) => normalize(a) === userWord);
    if (isCorrect) correct += 1;
    return { number: gap.number, userWord: words[i] || "(bo'sh)", correctAnswers: gap.answers, isCorrect };
  });

  feedback = `📊 Part 2 natijasi: ${correct}/${content.gaps.length}\n\n`;
  results.forEach((r) => {
    feedback += `${r.isCorrect ? '✅' : '❌'} ${r.number}) siz: "${r.userWord}"`;
    if (!r.isCorrect) feedback += ` — to'g'ri: "${r.correctAnswers[0]}"`;
    feedback += '\n';
  });

  const { mainMenu } = require('../keyboards');
  await ctx.reply(feedback, mainMenu);
  ctx.session.listeningPart2 = null;
  return true;
}

module.exports = { startListeningPart2, handleAnswer };
