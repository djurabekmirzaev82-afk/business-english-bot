const { Telegraf, session } = require('telegraf');
const config = require('../config');
const ensureUser = require('./middleware/ensureUser');
const { mainMenu } = require('./keyboards');
const { handleStart } = require('./handlers/start');
const { showCabinet } = require('./handlers/cabinet');
const { startTest, handleAnswerCallback } = require('./handlers/placementTest');
const { comingSoon } = require('./handlers/comingSoon');
const { showModuleList, showModule } = require('./handlers/businessEnglish');
const { showSchedule, showContact } = require('./handlers/orgInfo');
const { showWritingMenu, selectTaskType, handleWritingSubmission } = require('./handlers/writing');
const { showSpeakingMenu, selectScenario, handleSpeakingMessage, endSpeaking } = require('./handlers/speaking');

const bot = new Telegraf(config.botToken);

// In-memory session (per chat). Fine for MVP / single-process deployment.
// For multi-instance production, swap in a Postgres or Redis session store.
bot.use(session({ defaultSession: () => ({}) }));
bot.use(ensureUser);

bot.start(handleStart);
bot.command('menu', (ctx) => ctx.reply('Asosiy menyu:', mainMenu));

bot.hears('📝 Placement Test', startTest);
bot.command('test', startTest);

bot.hears('👨‍🎓 Mening kabinetim', showCabinet);
bot.command('cabinet', showCabinet);

bot.hears('🏠 Asosiy menu', (ctx) => ctx.reply('Asosiy menyu:', mainMenu));

// Business English modules
bot.hears('💼 Business English', showModuleList);
bot.action(/bemod:(.+)/, showModule);

// Schedule & Contact (static info — edit src/config/orgInfo.js)
bot.hears('📅 Schedule', showSchedule);
bot.hears('☎ Contact', showContact);

// Writing (AI-checked)
bot.hears('✍ Writing', showWritingMenu);
bot.action(/wtype:(.+)/, selectTaskType);

// Speaking Club (text-based AI roleplay)
bot.hears('🎤 Speaking Club', showSpeakingMenu);
bot.action(/speak:(.+)/, selectScenario);
bot.hears('🛑 Suhbatni tugatish', endSpeaking);

// Still reserved for later phases
['📚 Courses'].forEach((label) => bot.hears(label, comingSoon));

bot.action(/answer:(\d+)/, handleAnswerCallback);

// Generic free-text router: only fires when no bot.hears() label matched above.
// Routes to whichever flow (Writing / Speaking) the user currently has active.
bot.on('text', async (ctx) => {
  if (ctx.session.pendingWriting) {
    return handleWritingSubmission(ctx);
  }
  if (ctx.session.pendingSpeaking) {
    return handleSpeakingMessage(ctx);
  }
  // No active flow and text didn't match any menu button — gently redirect.
  await ctx.reply('Quyidagi menyudan bo\'limni tanlang 👇', mainMenu);
});

bot.catch((err, ctx) => {
  console.error(`Bot error for update ${ctx.updateType}:`, err);
});

module.exports = bot;
