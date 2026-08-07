const { Markup } = require('telegraf');
const aiTutor = require('../../services/aiTutor');

const TASK_TYPES = [
  'Formal Email',
  'Report',
  'Proposal',
  'Essay',
  'Complaint Letter',
  'Application Letter',
  'CV',
  'Cover Letter',
];

function taskKeyboard() {
  const buttons = TASK_TYPES.map((t) => [Markup.button.callback(t, `wtype:${t}`)]);
  return Markup.inlineKeyboard(buttons);
}

async function showWritingMenu(ctx) {
  await ctx.reply(
    '✍ Writing — qaysi turdagi matn yozmoqchisiz? Tanlang, so\'ng matningizni shu chatga yuboring:',
    taskKeyboard()
  );
}

async function selectTaskType(ctx) {
  const taskType = ctx.match[1];
  ctx.session.pendingWriting = { taskType };
  ctx.session.pendingSpeaking = null; // only one active flow at a time
  await ctx.answerCbQuery();
  await ctx.reply(
    `📝 Tanlandi: *${taskType}*\n\n` +
      `Endi shu mavzuda ingliz tilida matn yozib, shu chatga yuboring. ` +
      `AI uni tekshirib, ball va tavsiyalar beradi.`,
    { parse_mode: 'Markdown' }
  );
}

/**
 * Called from the generic text handler when ctx.session.pendingWriting is set.
 */
async function handleWritingSubmission(ctx) {
  const { taskType } = ctx.session.pendingWriting;
  const userText = ctx.message.text;

  if (userText.length < 15) {
    await ctx.reply('Matn juda qisqa ko\'rinadi. Iltimos, to\'liqroq matn yuboring.');
    return;
  }

  await ctx.reply('⏳ AI matningizni tekshirmoqda, biroz kuting...');

  try {
    const feedback = await aiTutor.checkWriting(taskType, userText);
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

module.exports = { showWritingMenu, selectTaskType, handleWritingSubmission };
