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

function mainMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback(findLesson('informal_letter').title, 'wlesson:informal_letter')],
    [Markup.button.callback(findLesson('formal_letter').title, 'wlesson:formal_letter')],
    [Markup.button.callback("📝 Insho turlari (Essay Types)", 'wsubmenu:essay')],
  ]);
}

function essayMenuKeyboard() {
  const essayLessons = lessons.filter((l) => l.category === 'essay');
  const buttons = essayLessons.map((l) => [Markup.button.callback(l.title, `wlesson:${l.id}`)]);
  buttons.push([Markup.button.callback('⬅ Orqaga', 'wsubmenu:main')]);
  return Markup.inlineKeyboard(buttons);
}

async function showWritingMenu(ctx) {
  await ctx.reply(
    '✍ Writing — mavzuni tanlang. Avval yozish qoidasini o\'rgatamiz, so\'ng vazifa beramiz:',
    mainMenuKeyboard()
  );
}

async function showSubmenu(ctx) {
  const which = ctx.match[1];
  await ctx.answerCbQuery();
  if (which === 'essay') {
    await ctx.reply('📝 Insho turini tanlang:', essayMenuKeyboard());
  } else {
    await ctx.reply('✍ Writing — mavzuni tanlang:', mainMenuKeyboard());
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

  // Store lesson context so the free-text handler knows what to check against.
  ctx.session.pendingWriting = { taskType: lesson.title, lessonId: lesson.id, criteria: lesson.lesson };
  ctx.session.pendingSpeaking = null; // only one active flow at a time

  await ctx.reply(lesson.lesson, { parse_mode: 'Markdown' });
  await ctx.reply(lesson.taskPrompt, { parse_mode: 'Markdown' });
  await ctx.reply("Tayyor bo'lgach, matningizni shu chatga yuboring — AI tekshirib beradi.");
}

/**
 * Called from the generic text handler when ctx.session.pendingWriting is set.
 */
async function handleWritingSubmission(ctx) {
  const { taskType, criteria } = ctx.session.pendingWriting;
  const userText = ctx.message.text;

  if (userText.length < 15) {
    await ctx.reply('Matn juda qisqa ko\'rinadi. Iltimos, to\'liqroq matn yuboring.');
    return;
  }

  await ctx.reply('⏳ AI matningizni tekshirmoqda, biroz kuting...');

  try {
    const feedback = await aiTutor.checkWriting(taskType, userText, criteria);
    await ctx.reply(feedback);
  } catch (err) {
    if (err.code === 'AI_NOT_CONFIGURED') {
      await ctx.reply(
        '⚠️ AI Tutor hali sozlanmagan (ANTHROPIC_API_KEY yo\'q). Administrator .env faylga API kalitni qo\'shishi kerak.'
      );
    } else {
      console.error('Writing check failed:', err.message);
      await ctx.reply('Texnik xatolik yuz berdi. Birozdan so\'ng qayta urinib ko\'ring.');
    }
  } finally {
    ctx.session.pendingWriting = null;
  }
}

module.exports = { showWritingMenu, showSubmenu, selectLesson, handleWritingSubmission };
