const fs = require('fs');
const path = require('path');
const { Markup } = require('telegraf');
const aiTutor = require('../../services/aiTutor');

const lessons = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'writingLessons.json'), 'utf8')
);

function findLesson(id) {
  return lessons.find((l) => l.id === id);
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatChartAsText(chart) {
  let out = `📊 *${chart.title}* (${chart.unit})\n\n`;
  chart.series.forEach((s) => {
    out += `${s.name}: `;
    out += chart.categories.map((c, i) => `${c}=${s.data[i]}`).join(', ');
    out += '\n';
  });
  return out;
}

function formatStepsAsText(steps) {
  return steps.map((s, i) => `${i + 1}) ${s}`).join(' → ');
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function mainMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback(findLesson('task1_1_informal_letter').title, 'wlesson:task1_1_informal_letter')],
    [Markup.button.callback(findLesson('task1_2_formal_letter').title, 'wlesson:task1_2_formal_letter')],
    [Markup.button.callback('📝 Task 2 — Insho turlari (Essay Types)', 'wsubmenu:essay')],
    [Markup.button.callback('📊 IELTS Academic Task 1 (Diagramma)', 'wsubmenu:academic')],
  ]);
}

function essayMenuKeyboard() {
  const essayLessons = lessons.filter((l) => l.category === 'essay');
  const buttons = essayLessons.map((l) => [Markup.button.callback(l.title, `wlesson:${l.id}`)]);
  buttons.push([Markup.button.callback('⬅ Orqaga', 'wsubmenu:main')]);
  return Markup.inlineKeyboard(buttons);
}

function academicMenuKeyboard() {
  const academicLessons = lessons.filter((l) => l.category === 'academic_task1_chart' || l.category === 'academic_task1_process');
  const buttons = academicLessons.map((l) => [Markup.button.callback(l.title, `wlesson:${l.id}`)]);
  buttons.push([Markup.button.callback('⬅ Orqaga', 'wsubmenu:main')]);
  return Markup.inlineKeyboard(buttons);
}

async function showWritingMenu(ctx) {
  await ctx.reply(
    '✍ Writing (Multilevel format) — vazifani tanlang. Avval qoida va so\'z chegarasi ko\'rsatiladi, so\'ng vazifa beriladi:',
    mainMenuKeyboard()
  );
}

async function showSubmenu(ctx) {
  const which = ctx.match[1];
  await ctx.answerCbQuery();
  if (which === 'essay') {
    await ctx.reply('📝 Task 2 — insho turini tanlang:', essayMenuKeyboard());
  } else if (which === 'academic') {
    await ctx.reply('📊 IELTS Academic Task 1 — turini tanlang:', academicMenuKeyboard());
  } else {
    await ctx.reply('✍ Writing — vazifani tanlang:', mainMenuKeyboard());
  }
}

async function selectLesson(ctx) {
  const id = ctx.match[1];
  const lesson = findLesson(id);
  if (!lesson) {
    await ctx.answerCbQuery('Mavzu topilmadi.');
    return;
  }
  await ctx.answerCbQuery();

  // Har safar tasodifiy bitta vazifa tanlanadi — shu bilan foydalanuvchi
  // xuddi shu bo'limga qayta kirganda boshqa mashqni ko'radi.
  const picked = pickRandom(lesson.prompts);
  const isStructured = typeof picked === 'object';
  const taskPromptText = isStructured ? picked.text : picked;

  // Store lesson context so the free-text handler knows what to check against.
  ctx.session.pendingWriting = {
    taskType: `${lesson.task} — ${lesson.title}`,
    lessonId: lesson.id,
    criteria: lesson.lesson,
    taskPrompt: taskPromptText,
    chart: isStructured ? picked.chart : undefined,
    steps: isStructured ? picked.steps : undefined,
    wordCountMin: lesson.wordCountMin,
    wordCountMax: lesson.wordCountMax,
  };
  ctx.session.pendingSpeaking = null; // only one active flow at a time

  await ctx.reply(lesson.lesson, { parse_mode: 'Markdown' });
  await ctx.reply(taskPromptText, { parse_mode: 'Markdown' });
  if (isStructured && picked.chart) {
    await ctx.reply(formatChartAsText(picked.chart), { parse_mode: 'Markdown' });
  } else if (isStructured && picked.steps) {
    await ctx.reply(`⚙️ Bosqichlar: ${formatStepsAsText(picked.steps)}`);
  }
  await ctx.reply(
    `📏 Eslatma: bu vazifa uchun so'z soni ${lesson.wordCountMin}-${lesson.wordCountMax} oralig'ida bo'lishi kerak.\n\n` +
      "Tayyor bo'lgach, matningizni shu chatga yuboring — AI tekshirib beradi."
  );
}

/**
 * Called from the generic text handler when ctx.session.pendingWriting is set.
 */
async function handleWritingSubmission(ctx) {
  const { taskType, criteria, taskPrompt, chart, steps, wordCountMin, wordCountMax } = ctx.session.pendingWriting;
  const userText = ctx.message.text;
  const wordCount = countWords(userText);

  if (userText.length < 15) {
    await ctx.reply("Matn juda qisqa ko'rinadi. Iltimos, to'liqroq matn yuboring.");
    return;
  }

  // Instant local word-count check, before waiting on the AI call.
  let wordCountNote = `📏 So'z soni: ${wordCount} (talab: ${wordCountMin}-${wordCountMax})`;
  if (wordCount < wordCountMin) {
    wordCountNote += `\n⚠️ Talab qilingandan kam — kamida ${wordCountMin - wordCount} ta so'z qo'shing.`;
  } else if (wordCount > wordCountMax) {
    wordCountNote += `\n⚠️ Talab qilingandan ko'p — ${wordCount - wordCountMax} ta so'zni qisqartiring.`;
  } else {
    wordCountNote += "\n✅ So'z soni talabga mos.";
  }
  await ctx.reply(wordCountNote);

  await ctx.reply('⏳ AI matningizni tekshirmoqda, biroz kuting...');

  try {
    let dataContext = '';
    if (chart) {
      dataContext = `\n\nUnderlying chart data the student was asked to describe (use this to verify accuracy):\nTitle: ${chart.title}\nType: ${chart.type}\nCategories: ${chart.categories.join(', ')}\n${chart.series.map((s) => `${s.name}: ${s.data.join(', ')}`).join('\n')}`;
    } else if (steps) {
      dataContext = `\n\nUnderlying process steps the student was asked to describe (use this to verify accuracy and completeness):\n${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
    }
    const criteriaWithWordCount =
      `${criteria}\n\nTask given to student: ${taskPrompt || ''}${dataContext}\n\n` +
      `Required word count for this task: ${wordCountMin}-${wordCountMax} words. ` +
      `The student's submission has ${wordCount} words — factor this into your BALL score if it is outside the range.`;
    const scoreFormat = chart || steps ? 'ieltsBand' : 'multilevel75';
    const feedback = await aiTutor.checkWriting(taskType, userText, criteriaWithWordCount, scoreFormat);
    await ctx.reply(feedback);
  } catch (err) {
    if (err.code === 'AI_NOT_CONFIGURED') {
      await ctx.reply(
        "⚠️ AI Tutor hali sozlanmagan (GEMINI_API_KEY yo'q). Administrator .env faylga API kalitni qo'shishi kerak."
      );
    } else {
      console.error('Writing check failed:', err.message);
      await ctx.reply("Texnik xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring.");
    }
  } finally {
    ctx.session.pendingWriting = null;
  }
}

module.exports = { showWritingMenu, showSubmenu, selectLesson, handleWritingSubmission };
