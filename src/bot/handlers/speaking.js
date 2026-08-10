const { Markup } = require('telegraf');
const aiTutor = require('../../services/aiTutor');

const SCENARIOS = ['Business Discussion', 'Role Play', 'Interview', 'Presentation', 'Negotiation', 'Telephone English'];

function scenarioKeyboard() {
  const buttons = SCENARIOS.map((s) => [Markup.button.callback(s, `speak:${s}`)]);
  return Markup.inlineKeyboard(buttons);
}

const endKeyboard = Markup.keyboard([['🛑 Suhbatni tugatish']]).resize();

async function showSpeakingMenu(ctx) {
  await ctx.reply(
    '🎤 Speaking Club — mashq turini tanlang. AI siz bilan ingliz tilida suhbat qiladi ' +
      "(hozircha matn orqali — ovozli xabarlar keyingi bosqichda qo'shiladi):",
    Markup.inlineKeyboard([
      ...SCENARIOS.map((s) => [Markup.button.callback(s, `speak:${s}`)]),
      [Markup.button.callback('🎓 IELTS Speaking (Part 1 → 2 → 3)', 'ispeak:menu')],
    ])
  );
}

async function selectScenario(ctx) {
  const scenario = ctx.match[1];
  await ctx.answerCbQuery();

  if (!process.env.GEMINI_API_KEY) {
    await ctx.reply(
      '⚠️ AI Tutor hali sozlanmagan (GEMINI_API_KEY yo\'q). Administrator .env faylga API kalitni qo\'shishi kerak.'
    );
    return;
  }

  ctx.session.pendingWriting = null; // only one active flow at a time
  ctx.session.pendingSpeaking = { scenario, history: [] };

  await ctx.reply(
    `🎬 Boshlandi: *${scenario}*\n\nIngliz tilida yozing, AI sizga hamkasb sifatida javob beradi. ` +
      `Tugatish uchun "🛑 Suhbatni tugatish" tugmasini bosing.`,
    { parse_mode: 'Markdown', ...endKeyboard }
  );

  await ctx.reply('⏳ AI suhbatni boshlamoqda...');
  try {
    const opener = await aiTutor.roleplayReply(scenario, [
      { role: 'user', content: `Start the ${scenario} roleplay with a natural opening line.` },
    ]);
    ctx.session.pendingSpeaking.history.push({ role: 'assistant', content: opener });
    await ctx.reply(opener);
  } catch (err) {
    console.error('Speaking opener failed:', err.message);
    await ctx.reply('Texnik xatolik. Qaytadan urinib ko\'ring.');
    ctx.session.pendingSpeaking = null;
  }
}

/**
 * Called from the generic text handler when ctx.session.pendingSpeaking is set.
 */
async function handleSpeakingMessage(ctx) {
  const state = ctx.session.pendingSpeaking;
  const userText = ctx.message.text;

  state.history.push({ role: 'user', content: userText });

  try {
    const reply = await aiTutor.roleplayReply(state.scenario, state.history);
    state.history.push({ role: 'assistant', content: reply });
    await ctx.reply(reply);
  } catch (err) {
    console.error('Speaking reply failed:', err.message);
    await ctx.reply('Texnik xatolik yuz berdi. Birozdan so\'ng qayta urinib ko\'ring.');
  }
}

async function endSpeaking(ctx) {
  const { mainMenu } = require('../keyboards');

  // Delegate to the IELTS Speaking handler if that flow is active.
  const ieltsSpeaking = require('./ieltsSpeaking');
  if (ctx.session.ieltsSpeaking) {
    await ieltsSpeaking.endEarly(ctx);
    return;
  }

  const state = ctx.session.pendingSpeaking;
  if (!state) {
    await ctx.reply('Faol suhbat topilmadi.', mainMenu);
    return;
  }

  await ctx.reply('⏳ Yakuniy fikr-mulohaza tayyorlanmoqda...', Markup.removeKeyboard());
  try {
    const summary = await aiTutor.roleplaySummary(state.scenario, state.history);
    await ctx.reply(summary, mainMenu);
  } catch (err) {
    console.error('Speaking summary failed:', err.message);
    await ctx.reply('Suhbat yakunlandi.', mainMenu);
  } finally {
    ctx.session.pendingSpeaking = null;
  }
}

module.exports = { showSpeakingMenu, selectScenario, handleSpeakingMessage, endSpeaking };
