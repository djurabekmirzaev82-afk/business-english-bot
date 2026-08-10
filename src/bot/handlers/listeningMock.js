const { Markup } = require('telegraf');
const engine = require('../../services/listeningMockEngine');

// ==================== MENUS ====================

async function showListeningMenu(ctx) {
  const buttons = [1, 2, 3, 5, 6].map((n) => {
    const exp = engine.getExplanation(n);
    return [Markup.button.callback(exp.title, `lmock:startpart:${n}`)];
  });
  const mocksList = engine.getAllMocks();
  mocksList.forEach((m) => buttons.push([Markup.button.callback(`🏆 ${m.title} (to'liq)`, `lmock:startmock:${m.id}`)]));
  buttons.push([Markup.button.callback('🔗 Qo\'shimcha manbalar (BBC, TED va h.k.)', 'lresources:show')]);

  await ctx.reply(
    "🎧 Listening (Multilevel format)\n\n" +
      "Har bir Part'ni alohida mashq qiling, yoki to'liq Mock testni sinang. " +
      "Part 4 (Xarita) rasm talab qilgani uchun keyinroq qo'shiladi.",
    Markup.inlineKeyboard(buttons)
  );
}

async function showResources(ctx) {
  const { showResources: showRes } = require('./listening');
  await showRes(ctx);
}

// ==================== START (part practice = 1 part, mock = all parts) ====================

async function startPart(ctx) {
  const partNumber = parseInt(ctx.match[1], 10);
  const mock = engine.getMock('mock1'); // parts are currently only defined in mock1
  const part = mock.parts.find((p) => p.partNumber === partNumber);
  if (!part) {
    await ctx.answerCbQuery('Mashq topilmadi.');
    return;
  }
  await ctx.answerCbQuery();

  if (!process.env.GEMINI_API_KEY) {
    await ctx.reply("⚠️ AI Tutor hali sozlanmagan (GEMINI_API_KEY yo'q). Administrator .env faylga API kalitni qo'shishi kerak.");
    return;
  }

  ctx.session.listeningRun = { mode: 'part', label: part.title, queue: [part], index: 0, scores: {}, state: {} };
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

  // "Real audio" mocks ship one continuous recording (like the real exam) instead of
  // per-item TTS clips. No GEMINI key needed for these — the audio is bundled.
  if (mock.audioFile) {
    await ctx.reply(
      `🏁 ${mock.title} boshlandi!\n\n🎧 Bu — haqiqiy imtihon yozuvi: barcha qismlar birin-ketin shu audioda keladi. ` +
        `Diqqat bilan tinglang (savollar pastda ketma-ket chiqadi), zarur bo'lsa audio faylni qayta eshiting.`
    );
    const ok = await sendFullMockAudio(ctx, mock);
    if (!ok) return;
    ctx.session.listeningRun = {
      mode: 'mock',
      label: mock.title,
      queue: mock.parts,
      index: 0,
      scores: {},
      state: {},
      skipPerItemAudio: true,
    };
    await runQueue(ctx);
    return;
  }

  if (!process.env.GEMINI_API_KEY) {
    await ctx.reply("⚠️ AI Tutor hali sozlanmagan (GEMINI_API_KEY yo'q). Administrator .env faylga API kalitni qo'shishi kerak.");
    return;
  }

  await ctx.reply(`🏁 ${mock.title} boshlandi!`);
  ctx.session.listeningRun = { mode: 'mock', label: mock.title, queue: mock.parts, index: 0, scores: {}, state: {} };
  await runQueue(ctx);
}

async function sendFullMockAudio(ctx, mock) {
  await ctx.reply('⏳ Audio yuklanmoqda (bir necha o\'n daqiqa davomida bo\'lishi mumkin)...');
  try {
    const buffer = await engine.resolveAudio({ audioFile: mock.audioFile });
    await ctx.replyWithAudio({ source: buffer, filename: mock.audioFile }, { caption: "🎧 To'liq Listening yozuvi (barcha qismlar)" });
    return true;
  } catch (err) {
    console.error('Full mock audio resolution failed:', err.message);
    await ctx.reply("Audio bilan ishlashda texnik xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring.");
    return false;
  }
}

// ==================== GENERIC PART RUNNER ====================

function addScore(run, partNumber, correct, total) {
  const existing = run.scores[partNumber];
  if (existing) {
    existing.correct += correct;
    existing.total += total;
  } else {
    run.scores[partNumber] = { correct, total };
  }
}

async function runQueue(ctx) {
  const run = ctx.session.listeningRun;
  if (run.index >= run.queue.length) return finishRun(ctx);

  const part = run.queue[run.index];
  run.state = {};

  const exp = engine.getExplanation(part.partNumber);
  await ctx.reply(`${exp.title}\n\n${exp.explanation}`, { parse_mode: 'Markdown' });

  if (part.taskType === 'sentence_reply') return startSentenceReply(ctx, part);
  if (part.taskType === 'note_completion') return startNoteCompletion(ctx, part);
  if (part.taskType === 'speaker_matching') return startSpeakerMatching(ctx, part);
  if (part.taskType === 'extracts_mc') return startExtractsMc(ctx, part);
}

async function advanceToNextPart(ctx) {
  ctx.session.listeningRun.index += 1;
  await runQueue(ctx);
}

async function sendAudioSafely(ctx, item, filenameHint) {
  const run = ctx.session.listeningRun;
  if (run && run.skipPerItemAudio) return true; // full recording already played once at mock start
  await ctx.reply('⏳ Audio tayyorlanmoqda...');
  try {
    const buffer = await engine.resolveAudio(item);
    await ctx.replyWithAudio({ source: buffer, filename: filenameHint });
    return true;
  } catch (err) {
    console.error('Listening audio resolution failed:', err.message);
    await ctx.reply("Audio bilan ishlashda texnik xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring.");
    return false;
  }
}

// ---------- SENTENCE REPLY (Part 1 style) ----------

async function startSentenceReply(ctx, part) {
  ctx.session.listeningRun.state = { index: 0, correct: 0 };
  await sendSentenceItem(ctx, part);
}

async function sendSentenceItem(ctx, part) {
  const state = ctx.session.listeningRun.state;
  const item = part.items[state.index];
  const ok = await sendAudioSafely(ctx, item, `listening_${item.number}.wav`);
  if (!ok) return;

  const letters = ['A', 'B', 'C'];
  const buttons = item.options.map((opt, i) => [Markup.button.callback(`${letters[i]}) ${opt}`, `lmock:sr:${i}`)]);
  await ctx.reply(`❓ ${item.number}) Eng mos javobni tanlang:`, Markup.inlineKeyboard(buttons));
}

async function handleSentenceReplyAnswer(ctx) {
  const selected = parseInt(ctx.match[1], 10);
  const run = ctx.session.listeningRun;
  const part = run.queue[run.index];
  const state = run.state;
  const item = part.items[state.index];

  const isCorrect = selected === item.correct;
  if (isCorrect) state.correct += 1;

  const letters = ['A', 'B', 'C'];
  await ctx.answerCbQuery(isCorrect ? "✅ To'g'ri!" : `❌ Noto'g'ri. To'g'ri javob: ${letters[item.correct]}) ${item.options[item.correct]}`);
  await ctx.editMessageReplyMarkup(undefined).catch(() => {});

  const nextIdx = state.index + 1;
  if (nextIdx >= part.items.length) {
    addScore(run, part.partNumber, state.correct, part.items.length);
    await ctx.reply(`📊 ${part.title} natijasi: ${state.correct}/${part.items.length}`);
    await advanceToNextPart(ctx);
    return;
  }
  state.index = nextIdx;
  await sendSentenceItem(ctx, part);
}

// ---------- NOTE COMPLETION (Part 2 / 6 style) ----------

async function startNoteCompletion(ctx, part) {
  await ctx.reply(part.notesTemplate);
  const ok = await sendAudioSafely(ctx, part, `listening_part${part.partNumber}.wav`);
  if (!ok) return;

  const gapNumbers = part.gaps.map((g) => g.number);
  await ctx.reply(
    `✍ Tinglab, yuqoridagi ${part.gaps.length} ta bo'shliqni (${gapNumbers[0]}-${gapNumbers[gapNumbers.length - 1]}) to'ldiring. ` +
      `Javoblaringizni vergul bilan ajratib, tartibda yuboring:`
  );
  ctx.session.listeningRun.state = { awaitingNotes: true };
}

async function handleNoteCompletionAnswer(ctx) {
  const run = ctx.session.listeningRun;
  if (!run || !run.state || !run.state.awaitingNotes) return false;
  const part = run.queue[run.index];

  const words = ctx.message.text.split(',').map((w) => w.trim());
  let correct = 0;
  let feedback = '';

  part.gaps.forEach((gap, i) => {
    const userWord = engine.normalizeWord(words[i] || '');
    const isCorrect = gap.answers.some((a) => engine.normalizeWord(a) === userWord);
    if (isCorrect) correct += 1;
    feedback += `${isCorrect ? '✅' : '❌'} ${gap.number}) siz: "${words[i] || "(bo'sh)"}"`;
    if (!isCorrect) feedback += ` — to'g'ri: "${gap.answers[0]}"`;
    feedback += '\n';
  });

  addScore(run, part.partNumber, correct, part.gaps.length);
  await ctx.reply(`📊 ${part.title} natijasi: ${correct}/${part.gaps.length}\n\n${feedback}`);
  await advanceToNextPart(ctx);
  return true;
}

// ---------- SPEAKER MATCHING (Part 3 style) ----------

async function startSpeakerMatching(ctx, part) {
  let optionsMsg = 'Variantlar:\n';
  part.options.forEach((o) => (optionsMsg += `${o.label}) ${o.text}\n`));
  await ctx.reply(optionsMsg);

  for (const speaker of part.speakers) {
    await ctx.reply(`🎙 Speaker ${part.speakers.indexOf(speaker) + 1}`);
    const ok = await sendAudioSafely(ctx, speaker, `listening_p${part.partNumber}_speaker${speaker.number}.wav`);
    if (!ok) return;
  }

  ctx.session.listeningRun.state = { index: 0, correct: 0, used: [] };
  await sendSpeakerQuestion(ctx, part);
}

function speakerOptionsKeyboard(part, usedLabels) {
  const available = part.options.filter((o) => !usedLabels.includes(o.label));
  const buttons = available.map((o) => [Markup.button.callback(`${o.label}) ${o.text}`, `lmock:sm:${o.label}`)]);
  return Markup.inlineKeyboard(buttons);
}

async function sendSpeakerQuestion(ctx, part) {
  const state = ctx.session.listeningRun.state;
  const speaker = part.speakers[state.index];
  await ctx.reply(`❓ Speaker ${state.index + 1} (${speaker.number})`, speakerOptionsKeyboard(part, state.used));
}

async function handleSpeakerMatchingAnswer(ctx) {
  const chosenLabel = ctx.match[1];
  const run = ctx.session.listeningRun;
  const part = run.queue[run.index];
  const state = run.state;
  const speaker = part.speakers[state.index];

  const isCorrect = part.answers[speaker.number] === chosenLabel;
  if (isCorrect) state.correct += 1;
  state.used.push(chosenLabel);

  await ctx.answerCbQuery(isCorrect ? "✅ To'g'ri!" : `❌ Noto'g'ri. To'g'ri javob: ${part.answers[speaker.number]}`);
  await ctx.editMessageReplyMarkup(undefined).catch(() => {});

  const nextIdx = state.index + 1;
  if (nextIdx >= part.speakers.length) {
    addScore(run, part.partNumber, state.correct, part.speakers.length);
    await ctx.reply(`📊 ${part.title} natijasi: ${state.correct}/${part.speakers.length}`);
    await advanceToNextPart(ctx);
    return;
  }
  state.index = nextIdx;
  await sendSpeakerQuestion(ctx, part);
}

// ---------- EXTRACTS MC (Part 5 style) ----------

async function startExtractsMc(ctx, part) {
  ctx.session.listeningRun.state = { extractIndex: 0, qIndex: 0, correct: 0 };
  await playExtractAndAsk(ctx, part);
}

async function playExtractAndAsk(ctx, part) {
  const state = ctx.session.listeningRun.state;
  const extract = part.extracts[state.extractIndex];
  await ctx.reply(`🎙 ${extract.label}`);
  const ok = await sendAudioSafely(ctx, extract, `listening_p${part.partNumber}_extract${extract.extractNumber}.wav`);
  if (!ok) return;
  await sendExtractQuestion(ctx, part);
}

function extractMcKeyboard(extractIdx, qIdx, options) {
  const buttons = options.map((opt, i) => [Markup.button.callback(opt, `lmock:emc:${extractIdx}:${qIdx}:${i}`)]);
  return Markup.inlineKeyboard(buttons);
}

async function sendExtractQuestion(ctx, part) {
  const state = ctx.session.listeningRun.state;
  const extract = part.extracts[state.extractIndex];
  const q = extract.questions[state.qIndex];
  await ctx.reply(`❓ ${q.number}) ${q.q}`, extractMcKeyboard(state.extractIndex, state.qIndex, q.options));
}

async function handleExtractsMcAnswer(ctx) {
  const extractIdx = parseInt(ctx.match[1], 10);
  const qIdx = parseInt(ctx.match[2], 10);
  const selected = parseInt(ctx.match[3], 10);

  const run = ctx.session.listeningRun;
  const part = run.queue[run.index];
  const state = run.state;
  const extract = part.extracts[extractIdx];
  const q = extract.questions[qIdx];

  const isCorrect = selected === q.correct;
  if (isCorrect) state.correct += 1;

  await ctx.answerCbQuery(isCorrect ? "✅ To'g'ri!" : `❌ Noto'g'ri. To'g'ri javob: ${q.options[q.correct]}`);
  await ctx.editMessageReplyMarkup(undefined).catch(() => {});

  const nextQIdx = qIdx + 1;
  if (nextQIdx < extract.questions.length) {
    state.qIndex = nextQIdx;
    await sendExtractQuestion(ctx, part);
    return;
  }

  const nextExtractIdx = extractIdx + 1;
  if (nextExtractIdx >= part.extracts.length) {
    const total = part.extracts.reduce((sum, e) => sum + e.questions.length, 0);
    addScore(run, part.partNumber, state.correct, total);
    await ctx.reply(`📊 ${part.title} natijasi: ${state.correct}/${total}`);
    await advanceToNextPart(ctx);
    return;
  }

  state.extractIndex = nextExtractIdx;
  state.qIndex = 0;
  await playExtractAndAsk(ctx, part);
}

// ==================== FINISH ====================

async function finishRun(ctx) {
  const { mainMenu } = require('../keyboards');
  const run = ctx.session.listeningRun;
  const scores = run.scores;
  const total = Object.values(scores).reduce((sum, s) => sum + s.correct, 0);
  const totalMax = Object.values(scores).reduce((sum, s) => sum + s.total, 0);

  let summary = `🏆 ${run.label} yakunlandi!\n\n`;
  Object.entries(scores).forEach(([partNum, s]) => {
    summary += `Part ${partNum}: ${s.correct}/${s.total}\n`;
  });
  summary += `\n📊 JAMI: ${total}/${totalMax}`;

  await ctx.reply(summary, mainMenu);
  ctx.session.listeningRun = null;
}

// ==================== TEXT ROUTER ENTRYPOINT ====================

/** Called from the generic text handler; returns true if it handled the message. */
async function handleTextAnswer(ctx) {
  const run = ctx.session.listeningRun;
  if (!run) return false;
  const part = run.queue[run.index];
  if (part.taskType === 'note_completion') {
    return handleNoteCompletionAnswer(ctx);
  }
  return false;
}

module.exports = {
  showListeningMenu,
  showResources,
  startPart,
  startMock,
  handleSentenceReplyAnswer,
  handleSpeakerMatchingAnswer,
  handleExtractsMcAnswer,
  handleTextAnswer,
};
