const fs = require('fs');
const path = require('path');
const { Markup } = require('telegraf');

const passages = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'readingPassages.json'), 'utf8')
);

function findPassage(id) {
  return passages.find((p) => p.id === id);
}

function passageListKeyboard() {
  const buttons = passages.map((p) => [Markup.button.callback(`${p.title} [${p.level}]`, `rpass:${p.id}`)]);
  return Markup.inlineKeyboard(buttons);
}

function answerKeyboard(passageId, qIndex, options) {
  const buttons = options.map((opt, idx) => [
    Markup.button.callback(opt, `ranswer:${passageId}:${qIndex}:${idx}`),
  ]);
  return Markup.inlineKeyboard(buttons);
}

async function showReadingMenu(ctx) {
  await ctx.reply('📖 Reading — matnni tanlang:', passageListKeyboard());
}

async function startPassage(ctx) {
  const id = ctx.match[1];
  const passage = findPassage(id);
  if (!passage) {
    await ctx.answerCbQuery('Matn topilmadi.');
    return;
  }
  await ctx.answerCbQuery();

  ctx.session.reading = { passageId: id, qIndex: 0, correct: 0 };

  await ctx.reply(`${passage.title} [${passage.level}]\n\n${passage.text}`);
  await sendQuestion(ctx, passage, 0);
}

async function sendQuestion(ctx, passage, qIndex) {
  const q = passage.questions[qIndex];
  await ctx.reply(
    `❓ Savol ${qIndex + 1}/${passage.questions.length}:\n${q.q}`,
    answerKeyboard(passage.id, qIndex, q.options)
  );
}

async function handleAnswer(ctx) {
  const [, passageId, qIndexStr, optionStr] = ctx.match;
  const qIndex = parseInt(qIndexStr, 10);
  const selected = parseInt(optionStr, 10);

  const state = ctx.session.reading;
  if (!state || state.passageId !== passageId || state.qIndex !== qIndex) {
    await ctx.answerCbQuery('Bu savol eskirgan.');
    return;
  }

  const passage = findPassage(passageId);
  const q = passage.questions[qIndex];
  const isCorrect = selected === q.correct;
  if (isCorrect) state.correct += 1;

  await ctx.answerCbQuery(isCorrect ? "✅ To'g'ri!" : `❌ Noto'g'ri. To'g'ri javob: ${q.options[q.correct]}`);
  await ctx.editMessageReplyMarkup(undefined).catch(() => {});

  const nextIndex = qIndex + 1;
  if (nextIndex >= passage.questions.length) {
    await ctx.reply(
      `🏁 Tugadi! Natija: ${state.correct}/${passage.questions.length} to'g'ri javob.`
    );
    ctx.session.reading = null;
    return;
  }

  state.qIndex = nextIndex;
  await sendQuestion(ctx, passage, nextIndex);
}

module.exports = { showReadingMenu, startPassage, handleAnswer };
