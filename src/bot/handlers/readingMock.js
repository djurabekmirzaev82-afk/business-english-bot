const { Markup } = require('telegraf');
const engine = require('../../services/readingMockEngine');

function mockListKeyboard() {
  const mocks = engine.getAllMocks();
  const buttons = mocks.map((m) => [
    Markup.button.callback(`${m.title} (${engine.totalQuestions(m)} savol)`, `rmock:start:${m.id}`),
  ]);
  return Markup.inlineKeyboard(buttons);
}

async function showReadingMockMenu(ctx) {
  await ctx.reply(
    '📖 Reading — Multilevel formatidagi Mock testlar.\n\n' +
      'Har bir mock 5 qismdan iborat (Part 1-5, jami 35 savol), xuddi haqiqiy Multilevel imtihoni tuzilishiga mos:\n\n' +
      "1️⃣ Part 1 — Open Cloze: matndagi bo'shliqlarni bitta so'z bilan to'ldirish\n" +
      "2️⃣ Part 2 — Multiple Matching: gaplarni mos matnga bog'lash\n" +
      "3️⃣ Part 3 — Multiple Choice: uzun matn, tushunish savollari\n" +
      "4️⃣ Part 4 — Gapped Text: olib tashlangan gaplarni joyiga qaytarish\n" +
      "5️⃣ Part 5 — Multiple Choice: ikkinchi uzun matn\n\n" +
      'Mockni tanlang:',
    mockListKeyboard()
  );
}

async function startMock(ctx) {
  const mockId = ctx.match[1];
  const mock = engine.getMock(mockId);
  if (!mock) {
    await ctx.answerCbQuery('Mock topilmadi.');
    return;
  }
  await ctx.answerCbQuery();

  ctx.session.readingMock = {
    mockId,
    scores: {},
  };

  await ctx.reply(`🏁 ${mock.title} boshlandi! Omad tilaymiz.`);
  await startPart1(ctx, mock);
}

// ==================== PART 1: OPEN CLOZE ====================

async function startPart1(ctx, mock) {
  const part = mock.parts[0];
  await ctx.reply(`${part.title}\n\nℹ️ ${part.skillNote}`);
  await ctx.reply(part.textTemplate);
  await ctx.reply(
    "✍ Javoblaringizni shu tartibda, vergul bilan ajratib yuboring (masalan: in, to, that, a, as, will):\n\n" +
      '1) ___  2) ___  3) ___  4) ___  5) ___  6) ___'
  );
  ctx.session.readingMock.awaitingCloze = true;
}

async function handleClozeSubmission(ctx) {
  const mock = engine.getMock(ctx.session.readingMock.mockId);
  const part = mock.parts[0];
  const words = ctx.message.text.split(',').map((w) => w.trim());

  const result = engine.scoreOpenCloze(part, words);
  ctx.session.readingMock.scores.part1 = { correct: result.correct, total: result.total };
  ctx.session.readingMock.awaitingCloze = false;

  let feedback = `📊 Part 1 natijasi: ${result.correct}/${result.total}\n\n`;
  result.results.forEach((r) => {
    feedback += `${r.isCorrect ? '✅' : '❌'} ${r.number}) siz: "${r.userWord}"`;
    if (!r.isCorrect) feedback += ` — to'g'ri: "${r.correctAnswers[0]}"`;
    feedback += '\n';
  });
  await ctx.reply(feedback);

  await startPart2(ctx, mock);
}

// ==================== PART 2: MULTIPLE MATCHING ====================

function part2Keyboard(part) {
  const buttons = part.texts.map((t) => [Markup.button.callback(`${t.label} — ${t.title}`, `rmock:p2:${t.label}`)]);
  return Markup.inlineKeyboard(buttons);
}

async function startPart2(ctx, mock) {
  const part = mock.parts[1];
  await ctx.reply(`${part.title}\n\nℹ️ ${part.skillNote}`);

  let textsMsg = '';
  part.texts.forEach((t) => {
    textsMsg += `*${t.label}) ${t.title}*\n${t.text}\n\n`;
  });
  await ctx.reply(textsMsg, { parse_mode: 'Markdown' });

  ctx.session.readingMock.p2Index = 0;
  ctx.session.readingMock.p2Correct = 0;
  await sendPart2Question(ctx, part);
}

async function sendPart2Question(ctx, part) {
  const idx = ctx.session.readingMock.p2Index;
  const q = part.questions[idx];
  await ctx.reply(`❓ ${q.number}) ${q.statement}`, part2Keyboard(part));
}

async function handlePart2Answer(ctx) {
  const chosenLabel = ctx.match[1];
  const mock = engine.getMock(ctx.session.readingMock.mockId);
  const part = mock.parts[1];
  const idx = ctx.session.readingMock.p2Index;
  const q = part.questions[idx];

  const isCorrect = chosenLabel === q.answer;
  if (isCorrect) ctx.session.readingMock.p2Correct += 1;

  await ctx.answerCbQuery(isCorrect ? "✅ To'g'ri!" : `❌ Noto'g'ri. To'g'ri javob: ${q.answer}`);
  await ctx.editMessageReplyMarkup(undefined).catch(() => {});

  const nextIdx = idx + 1;
  if (nextIdx >= part.questions.length) {
    ctx.session.readingMock.scores.part2 = {
      correct: ctx.session.readingMock.p2Correct,
      total: part.questions.length,
    };
    await ctx.reply(`📊 Part 2 natijasi: ${ctx.session.readingMock.p2Correct}/${part.questions.length}`);
    await startPart3(ctx, mock);
    return;
  }

  ctx.session.readingMock.p2Index = nextIdx;
  await sendPart2Question(ctx, part);
}

// ==================== PART 3 & 5: MULTIPLE CHOICE ====================

function mcKeyboard(prefix, qIndex, options) {
  const buttons = options.map((opt, i) => [Markup.button.callback(opt, `${prefix}:${qIndex}:${i}`)]);
  return Markup.inlineKeyboard(buttons);
}

async function startPart3(ctx, mock) {
  const part = mock.parts[2];
  await ctx.reply(`${part.title}\n\nℹ️ ${part.skillNote}`);
  await ctx.reply(part.text);

  ctx.session.readingMock.p3Index = 0;
  ctx.session.readingMock.p3Correct = 0;
  await sendMcQuestion(ctx, part, 'rmock:p3', 0);
}

async function sendMcQuestion(ctx, part, prefix, idx) {
  const q = part.questions[idx];
  await ctx.reply(`❓ ${q.number}) ${q.q}`, mcKeyboard(prefix, idx, q.options));
}

async function handlePart3Answer(ctx) {
  const idx = parseInt(ctx.match[1], 10);
  const selected = parseInt(ctx.match[2], 10);
  const mock = engine.getMock(ctx.session.readingMock.mockId);
  const part = mock.parts[2];
  const q = part.questions[idx];

  const isCorrect = selected === q.correct;
  if (isCorrect) ctx.session.readingMock.p3Correct += 1;

  await ctx.answerCbQuery(isCorrect ? "✅ To'g'ri!" : `❌ Noto'g'ri. To'g'ri javob: ${q.options[q.correct]}`);
  await ctx.editMessageReplyMarkup(undefined).catch(() => {});

  const nextIdx = idx + 1;
  if (nextIdx >= part.questions.length) {
    ctx.session.readingMock.scores.part3 = {
      correct: ctx.session.readingMock.p3Correct,
      total: part.questions.length,
    };
    await ctx.reply(`📊 Part 3 natijasi: ${ctx.session.readingMock.p3Correct}/${part.questions.length}`);
    await startPart4(ctx, mock);
    return;
  }

  ctx.session.readingMock.p3Index = nextIdx;
  await sendMcQuestion(ctx, part, 'rmock:p3', nextIdx);
}

async function startPart5(ctx, mock) {
  const part = mock.parts[4];
  await ctx.reply(`${part.title}\n\nℹ️ ${part.skillNote}`);
  await ctx.reply(part.text);

  ctx.session.readingMock.p5Index = 0;
  ctx.session.readingMock.p5Correct = 0;
  await sendMcQuestion(ctx, part, 'rmock:p5', 0);
}

async function handlePart5Answer(ctx) {
  const idx = parseInt(ctx.match[1], 10);
  const selected = parseInt(ctx.match[2], 10);
  const mock = engine.getMock(ctx.session.readingMock.mockId);
  const part = mock.parts[4];
  const q = part.questions[idx];

  const isCorrect = selected === q.correct;
  if (isCorrect) ctx.session.readingMock.p5Correct += 1;

  await ctx.answerCbQuery(isCorrect ? "✅ To'g'ri!" : `❌ Noto'g'ri. To'g'ri javob: ${q.options[q.correct]}`);
  await ctx.editMessageReplyMarkup(undefined).catch(() => {});

  const nextIdx = idx + 1;
  if (nextIdx >= part.questions.length) {
    ctx.session.readingMock.scores.part5 = {
      correct: ctx.session.readingMock.p5Correct,
      total: part.questions.length,
    };
    await ctx.reply(`📊 Part 5 natijasi: ${ctx.session.readingMock.p5Correct}/${part.questions.length}`);
    await finishMock(ctx, mock);
    return;
  }

  ctx.session.readingMock.p5Index = nextIdx;
  await sendMcQuestion(ctx, part, 'rmock:p5', nextIdx);
}

// ==================== PART 4: GAPPED TEXT ====================

function part4Keyboard(part, usedLabels) {
  const available = part.options.filter((o) => !usedLabels.includes(o.label));
  const buttons = available.map((o) => [
    Markup.button.callback(`${o.label}) ${o.text.slice(0, 40)}${o.text.length > 40 ? '...' : ''}`, `rmock:p4:${o.label}`),
  ]);
  return Markup.inlineKeyboard(buttons);
}

async function startPart4(ctx, mock) {
  const part = mock.parts[3];
  await ctx.reply(`${part.title}\n\nℹ️ ${part.skillNote}`);
  await ctx.reply(part.text);

  let optionsMsg = "Variantlar:\n";
  part.options.forEach((o) => {
    optionsMsg += `${o.label}) ${o.text}\n`;
  });
  await ctx.reply(optionsMsg);

  ctx.session.readingMock.p4GapNumbers = Object.keys(part.answers).map(Number).sort((a, b) => a - b);
  ctx.session.readingMock.p4Index = 0;
  ctx.session.readingMock.p4Correct = 0;
  ctx.session.readingMock.p4UsedLabels = [];
  await sendPart4Question(ctx, part);
}

async function sendPart4Question(ctx, part) {
  const state = ctx.session.readingMock;
  const gapNumber = state.p4GapNumbers[state.p4Index];
  await ctx.reply(`❓ Bo'shliq (${gapNumber})`, part4Keyboard(part, state.p4UsedLabels));
}

async function handlePart4Answer(ctx) {
  const chosenLabel = ctx.match[1];
  const mock = engine.getMock(ctx.session.readingMock.mockId);
  const part = mock.parts[3];
  const state = ctx.session.readingMock;
  const gapNumber = state.p4GapNumbers[state.p4Index];

  const isCorrect = part.answers[gapNumber] === chosenLabel;
  if (isCorrect) state.p4Correct += 1;
  state.p4UsedLabels.push(chosenLabel);

  await ctx.answerCbQuery(isCorrect ? "✅ To'g'ri!" : `❌ Noto'g'ri. To'g'ri javob: ${part.answers[gapNumber]}`);
  await ctx.editMessageReplyMarkup(undefined).catch(() => {});

  const nextIdx = state.p4Index + 1;
  if (nextIdx >= state.p4GapNumbers.length) {
    state.scores.part4 = { correct: state.p4Correct, total: state.p4GapNumbers.length };
    await ctx.reply(`📊 Part 4 natijasi: ${state.p4Correct}/${state.p4GapNumbers.length}`);
    await startPart5(ctx, mock);
    return;
  }

  state.p4Index = nextIdx;
  await sendPart4Question(ctx, part);
}

// ==================== FINAL SUMMARY ====================

async function finishMock(ctx, mock) {
  const { mainMenu } = require('../keyboards');
  const scores = ctx.session.readingMock.scores;
  const total = Object.values(scores).reduce((sum, s) => sum + s.correct, 0);
  const totalMax = engine.totalQuestions(mock);

  let summary = `🏆 ${mock.title} yakunlandi!\n\n`;
  summary += `Part 1: ${scores.part1.correct}/${scores.part1.total}\n`;
  summary += `Part 2: ${scores.part2.correct}/${scores.part2.total}\n`;
  summary += `Part 3: ${scores.part3.correct}/${scores.part3.total}\n`;
  summary += `Part 4: ${scores.part4.correct}/${scores.part4.total}\n`;
  summary += `Part 5: ${scores.part5.correct}/${scores.part5.total}\n\n`;
  summary += `📊 JAMI: ${total}/${totalMax}\n\n`;
  summary += "Natija taxminiy — rasmiy Multilevel bahosi emas, mashq maqsadida.";

  await ctx.reply(summary, mainMenu);
  ctx.session.readingMock = null;
}

module.exports = {
  showReadingMockMenu,
  startMock,
  handleClozeSubmission,
  handlePart2Answer,
  handlePart3Answer,
  handlePart4Answer,
  handlePart5Answer,
};
