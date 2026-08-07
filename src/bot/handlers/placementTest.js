const { optionsKeyboard, mainMenu } = require('../keyboards');
const testEngine = require('../../services/testEngine');
const { setUserLevel } = require('../../services/userService');

async function startTest(ctx) {
  const questions = await testEngine.getAllQuestionsOrdered();
  if (questions.length === 0) {
    await ctx.reply(
      'Test savollari hali yuklanmagan. Administrator bilan bog\'laning yoki "npm run seed" buyrug\'ini ishga tushiring.'
    );
    return;
  }

  const attemptId = await testEngine.startAttempt(ctx.state.user.id, questions.length);

  ctx.session.test = {
    attemptId,
    currentIndex: 0,
    correctCount: 0,
  };

  await ctx.reply(
    `📝 Placement Test boshlandi!\n\n` +
      `Jami ${questions.length} ta savol. Har bir savol uchun to'g'ri javobni tanlang.\n` +
      `Test darajangizni (A1–C1) aniqlaydi va unga mos kurs tavsiya qilinadi.`
  );
  await sendQuestion(ctx, questions, 0);
}

async function sendQuestion(ctx, questions, index) {
  const q = questions[index];
  const options = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
  await ctx.reply(
    `Savol ${index + 1}/${questions.length} [${q.level}]\n\n${q.question_text}`,
    optionsKeyboard(options)
  );
}

async function handleAnswerCallback(ctx) {
  const state = ctx.session.test;
  if (!state) {
    await ctx.answerCbQuery('Test sessiyasi topilmadi. /test buyrug\'i bilan qayta boshlang.');
    return;
  }

  const questions = await testEngine.getAllQuestionsOrdered();
  const question = questions[state.currentIndex];
  if (!question) {
    await ctx.answerCbQuery();
    return;
  }

  const selectedOption = parseInt(ctx.match[1], 10);
  const isCorrect = await testEngine.recordAnswer(state.attemptId, question, selectedOption);
  if (isCorrect) state.correctCount += 1;

  await ctx.answerCbQuery(isCorrect ? '✅ To\'g\'ri!' : '❌ Noto\'g\'ri');
  await ctx.editMessageReplyMarkup(undefined).catch(() => {});

  const nextIndex = state.currentIndex + 1;
  if (nextIndex >= questions.length) {
    await finishTest(ctx);
    return;
  }

  state.currentIndex = nextIndex;
  await sendQuestion(ctx, questions, nextIndex);
}

async function finishTest(ctx) {
  const state = ctx.session.test;
  const { correct, level } = await testEngine.finishAttempt(state.attemptId);
  await setUserLevel(ctx.state.user.id, level);
  delete ctx.session.test;

  await ctx.reply(
    `🏁 Test yakunlandi!\n\n` +
      `To'g'ri javoblar: ${correct}/20\n` +
      `Sizning darajangiz: ${level}\n\n` +
      `Ushbu daraja "👨‍🎓 Mening kabinetim" bo'limida saqlandi. Unga mos kurslar tez orada bu yerdan tavsiya qilinadi.`,
    mainMenu
  );
}

module.exports = { startTest, handleAnswerCallback };
