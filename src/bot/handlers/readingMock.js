const { Markup } = require('telegraf');
const engine = require('../../services/readingMockEngine');

// ==================== MENUS ====================

async function showReadingMenu(ctx) {
  await ctx.reply(
    '📖 Reading (Multilevel format)\n\n' +
      "Avval har bir qismni alohida mashq qiling, keyin to'liq Mock test (35 savol) bilan o'zingizni sinang:",
    Markup.inlineKeyboard([
      [Markup.button.callback("📝 Mashqlar (Part bo'yicha)", 'rread:menu:drills')],
      [Markup.button.callback("🏆 To'liq Mock testlar", 'rread:menu:mocks')],
    ])
  );
}

async function showDrillMenu(ctx) {
  await ctx.answerCbQuery();
  const buttons = [1, 2, 3, 4, 5].map((n) => {
    const exp = engine.getExplanation(n);
    return [Markup.button.callback(exp.title, `rread:startdrillpart:${n}`)];
  });
  await ctx.reply("📝 Qaysi Part'ni mashq qilmoqchisiz?", Markup.inlineKeyboard(buttons));
}

async function showMockMenu(ctx) {
  await ctx.answerCbQuery();
  const mocksList = engine.getAllMocks();
  const buttons = mocksList.map((m) => [
    Markup.button.callback(`${m.title} (${engine.totalQuestions(m)} savol)`, `rread:startmock:${m.id}`),
  ]);
  await ctx.reply("🏆 To'liq Mock testni tanlang:", Markup.inlineKeyboard(buttons));
}

// ==================== STARTING A RUN (drill = 1 part, mock = 5 parts) ====================

async function startDrill(ctx) {
  const partNumber = parseInt(ctx.match[1], 10);
  const partDrills = engine.getDrillsForPart(partNumber);
  if (!partDrills.length) {
    await ctx.answerCbQuery('Mashq topilmadi.');
    return;
  }
  await ctx.answerCbQuery();

  const exp = engine.getExplanation(partNumber);
  ctx.session.readingRun = {
    mode: 'drill',
    label: exp.title,
    queue: partDrills, // may be >1 segment (e.g. Part 5 = note completion + MC)
    index: 0,
    scores: {},
    state: {},
  };
  await runQueue(ctx);
}

async function startMock(ctx) {
  const mockId = ctx.match[1];
  const mock = engine.getMock(mockId);
  if (!mock) {
    await ctx.answerCbQuery('Mock topilmadi.');
    return;
  }
  await ctx.answerCbQuery();

  const introLines = [`🏁 ${mock.title} boshlandi! Omad tilaymiz.`];
  if (mock.pdfUrl) {
    introLines.push('', `📄 Asl savollar varag'i (PDF): ${mock.pdfUrl}`);
  }
  await ctx.reply(introLines.join('\n'));
  ctx.session.readingRun = {
    mode: 'mock',
    label: mock.title,
    queue: mock.parts,
    index: 0,
    scores: {},
    state: {},
  };
  await runQueue(ctx);
}


function addScore(run, partNumber, correct, total) {
  const existing = run.scores[partNumber];
  if (existing) {
    existing.correct += correct;
    existing.total += total;
  } else {
    run.scores[partNumber] = { correct, total };
  }
}

// ==================== GENERIC PART RUNNER ====================

async function runQueue(ctx) {
  const run = ctx.session.readingRun;
  if (run.index >= run.queue.length) {
    await finishRun(ctx);
    return;
  }
  const part = run.queue[run.index];
  run.state = {}; // reset per-part transient state

  const exp = engine.getExplanation(part.partNumber);
  await ctx.reply(`${exp.title}\n\n${exp.explanation}`, { parse_mode: 'Markdown' });

  if (part.taskType === 'open_cloze') return startOpenCloze(ctx, part);
  if (part.taskType === 'multiple_matching') return startMultipleMatching(ctx, part);
  if (part.taskType === 'multiple_choice') return startMultipleChoice(ctx, part);
  if (part.taskType === 'gapped_text') return startGappedText(ctx, part);
}

async function advanceToNextPart(ctx) {
  ctx.session.readingRun.index += 1;
  await runQueue(ctx);
}

// ---------- OPEN CLOZE ----------

async function startOpenCloze(ctx, part) {
  await ctx.reply(part.textTemplate);
  const n = part.gaps.length;
  await ctx.reply(
    `✍ Javoblaringizni vergul bilan ajratib, ${n} ta so'z tartibda yuboring (masalan: so'z1, so'z2, so'z3...):`
  );
  ctx.session.readingRun.state.awaitingCloze = true;
}

async function handleClozeSubmission(ctx) {
  const run = ctx.session.readingRun;
  const part = run.queue[run.index];
  const words = ctx.message.text.split(',').map((w) => w.trim());

  const result = engine.scoreOpenCloze(part, words);
  addScore(run, part.partNumber, result.correct, result.total);
  run.state.awaitingCloze = false;

  let feedback = `📊 ${part.title} natijasi: ${result.correct}/${result.total}\n\n`;
  result.results.forEach((r) => {
    feedback += `${r.isCorrect ? '✅' : '❌'} ${r.number}) siz: "${r.userWord}"`;
    if (!r.isCorrect) feedback += ` — to'g'ri: "${r.correctAnswers[0]}"`;
    feedback += '\n';
  });
  await ctx.reply(feedback);

  await advanceToNextPart(ctx);
}

// ---------- MULTIPLE MATCHING ----------

function mmKeyboard(part) {
  const buttons = part.texts.map((t) => [Markup.button.callback(`${t.label} — ${t.title}`, `rread:mm:${t.label}`)]);
  return Markup.inlineKeyboard(buttons);
}

async function startMultipleMatching(ctx, part) {
  let textsMsg = '';
  part.texts.forEach((t) => {
    textsMsg += `*${t.label}) ${t.title}*\n${t.text}\n\n`;
  });
  await ctx.reply(textsMsg, { parse_mode: 'Markdown' });

  ctx.session.readingRun.state.qIndex = 0;
  ctx.session.readingRun.state.correct = 0;
  await sendMmQuestion(ctx, part);
}

async function sendMmQuestion(ctx, part) {
  const idx = ctx.session.readingRun.state.qIndex;
  const q = part.questions[idx];
  await ctx.reply(`❓ ${q.number}) ${q.statement}`, mmKeyboard(part));
}

async function handleMmAnswer(ctx) {
  const chosenLabel = ctx.match[1];
  const run = ctx.session.readingRun;
  const part = run.queue[run.index];
  const idx = run.state.qIndex;
  const q = part.questions[idx];

  const isCorrect = chosenLabel === q.answer;
  if (isCorrect) run.state.correct += 1;

  await ctx.answerCbQuery(isCorrect ? "✅ To'g'ri!" : `❌ Noto'g'ri. To'g'ri javob: ${q.answer}`);
  await ctx.editMessageReplyMarkup(undefined).catch(() => {});

  const nextIdx = idx + 1;
  if (nextIdx >= part.questions.length) {
    addScore(run, part.partNumber, run.state.correct, part.questions.length);
    await ctx.reply(`📊 ${part.title} natijasi: ${run.state.correct}/${part.questions.length}`);
    await advanceToNextPart(ctx);
    return;
  }
  run.state.qIndex = nextIdx;
  await sendMmQuestion(ctx, part);
}

// ---------- MULTIPLE CHOICE ----------

function mcKeyboard(qIndex, options) {
  const buttons = options.map((opt, i) => [Markup.button.callback(opt, `rread:mc:${qIndex}:${i}`)]);
  return Markup.inlineKeyboard(buttons);
}

async function startMultipleChoice(ctx, part) {
  await ctx.reply(part.text);
  ctx.session.readingRun.state.qIndex = 0;
  ctx.session.readingRun.state.correct = 0;
  await sendMcQuestion(ctx, part);
}

async function sendMcQuestion(ctx, part) {
  const idx = ctx.session.readingRun.state.qIndex;
  const q = part.questions[idx];
  await ctx.reply(`❓ ${q.number}) ${q.q}`, mcKeyboard(idx, q.options));
}

async function handleMcAnswer(ctx) {
  const idx = parseInt(ctx.match[1], 10);
  const selected = parseInt(ctx.match[2], 10);
  const run = ctx.session.readingRun;
  const part = run.queue[run.index];
  const q = part.questions[idx];

  const isCorrect = selected === q.correct;
  if (isCorrect) run.state.correct += 1;

  await ctx.answerCbQuery(isCorrect ? "✅ To'g'ri!" : `❌ Noto'g'ri. To'g'ri javob: ${q.options[q.correct]}`);
  await ctx.editMessageReplyMarkup(undefined).catch(() => {});

  const nextIdx = idx + 1;
  if (nextIdx >= part.questions.length) {
    addScore(run, part.partNumber, run.state.correct, part.questions.length);
    await ctx.reply(`📊 ${part.title} natijasi: ${run.state.correct}/${part.questions.length}`);
    await advanceToNextPart(ctx);
    return;
  }
  run.state.qIndex = nextIdx;
  await sendMcQuestion(ctx, part);
}

// ---------- GAPPED TEXT ----------

function gapKeyboard(part, usedLabels) {
  const available = part.options.filter((o) => !usedLabels.includes(o.label));
  const buttons = available.map((o) => [
    Markup.button.callback(`${o.label}) ${o.text.slice(0, 40)}${o.text.length > 40 ? '...' : ''}`, `rread:gap:${o.label}`),
  ]);
  return Markup.inlineKeyboard(buttons);
}

async function startGappedText(ctx, part) {
  await ctx.reply(part.text);

  let optionsMsg = "Variantlar:\n";
  part.options.forEach((o) => {
    optionsMsg += `${o.label}) ${o.text}\n`;
  });
  await ctx.reply(optionsMsg);

  const state = ctx.session.readingRun.state;
  state.gapNumbers = Object.keys(part.answers).map(Number).sort((a, b) => a - b);
  state.gIndex = 0;
  state.correct = 0;
  state.used = [];
  await sendGapQuestion(ctx, part);
}

async function sendGapQuestion(ctx, part) {
  const state = ctx.session.readingRun.state;
  const gapNumber = state.gapNumbers[state.gIndex];
  await ctx.reply(`❓ (${gapNumber})`, gapKeyboard(part, state.used));
}

async function handleGapAnswer(ctx) {
  const chosenLabel = ctx.match[1];
  const run = ctx.session.readingRun;
  const part = run.queue[run.index];
  const state = run.state;
  const gapNumber = state.gapNumbers[state.gIndex];

  const isCorrect = part.answers[gapNumber] === chosenLabel;
  if (isCorrect) state.correct += 1;
  state.used.push(chosenLabel);

  await ctx.answerCbQuery(isCorrect ? "✅ To'g'ri!" : `❌ Noto'g'ri. To'g'ri javob: ${part.answers[gapNumber]}`);
  await ctx.editMessageReplyMarkup(undefined).catch(() => {});

  const nextIdx = state.gIndex + 1;
  if (nextIdx >= state.gapNumbers.length) {
    addScore(run, part.partNumber, state.correct, state.gapNumbers.length);
    await ctx.reply(`📊 ${part.title} natijasi: ${state.correct}/${state.gapNumbers.length}`);
    await advanceToNextPart(ctx);
    return;
  }
  state.gIndex = nextIdx;
  await sendGapQuestion(ctx, part);
}

// ==================== FINISH ====================

async function finishRun(ctx) {
  const { mainMenu } = require('../keyboards');
  const run = ctx.session.readingRun;
  const scores = run.scores;
  const total = Object.values(scores).reduce((sum, s) => sum + s.correct, 0);
  const totalMax = Object.values(scores).reduce((sum, s) => sum + s.total, 0);

  let summary = `🏆 ${run.label} yakunlandi!\n\n`;
  Object.entries(scores).forEach(([partNum, s]) => {
    summary += `Part ${partNum}: ${s.correct}/${s.total}\n`;
  });
  summary += `\n📊 JAMI: ${total}/${totalMax}\n\n`;
  summary += "Natija taxminiy — rasmiy Multilevel bahosi emas, mashq maqsadida.";

  await ctx.reply(summary, mainMenu);
  ctx.session.readingRun = null;
}

module.exports = {
  showReadingMenu,
  showDrillMenu,
  showMockMenu,
  startDrill,
  startMock,
  handleClozeSubmission,
  handleMmAnswer,
  handleMcAnswer,
  handleGapAnswer,
};
