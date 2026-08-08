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
const { showWritingMenu, showSubmenu, selectLesson, handleWritingSubmission } = require('./handlers/writing');
const { showSpeakingMenu, selectScenario, handleSpeakingMessage, endSpeaking } = require('./handlers/speaking');
const { showListening, showResources } = require('./handlers/listening');
const { startListeningPart1, handleAnswer: handleListeningPart1Answer } = require('./handlers/listeningPart1');
const {
  showReadingMenu: showReadingMockMenu,
  showDrillMenu,
  showMockMenu,
  startDrill,
  startMock,
  handleClozeSubmission,
  handleMmAnswer,
  handleMcAnswer,
  handleGapAnswer,
} = require('./handlers/readingMock');

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

// Writing (Multilevel-format lessons + AI-checked tasks)
bot.hears('✍ Writing', showWritingMenu);
bot.action(/wsubmenu:(.+)/, showSubmenu);
bot.action(/wlesson:(.+)/, selectLesson);

// Reading (Multilevel-format: standalone part drills + full 5-part mocks)
bot.hears('📖 Reading', showReadingMockMenu);
bot.action('rread:menu:drills', showDrillMenu);
bot.action('rread:menu:mocks', showMockMenu);
bot.action(/rread:startdrill:(.+)/, startDrill);
bot.action(/rread:startmock:(.+)/, startMock);
bot.action(/rread:mm:(.+)/, handleMmAnswer);
bot.action(/rread:mc:(\d+):(\d+)/, handleMcAnswer);
bot.action(/rread:gap:(.+)/, handleGapAnswer);

// Listening (curated external resource links)
bot.hears('🎧 Listening', showListening);
bot.action('lpart1:start', startListeningPart1);
bot.action(/lpart1:(\d+)/, handleListeningPart1Answer);
bot.action('lresources:show', showResources);

// Speaking Club (text-based AI roleplay)
bot.hears('🎤 Speaking Club', showSpeakingMenu);
bot.action(/speak:(.+)/, selectScenario);
bot.hears('🛑 Suhbatni tugatish', endSpeaking);

// Still reserved for later phases
['📚 Courses'].forEach((label) => bot.hears(label, comingSoon));

bot.action(/answer:(\d+)/, handleAnswerCallback);

// Generic free-text router: only fires when no bot.hears() label matched above.
// Routes to whichever flow (Writing / Speaking / Reading Mock Cloze) the user currently has active.
bot.on('text', async (ctx) => {
  if (ctx.session.readingRun && ctx.session.readingRun.state && ctx.session.readingRun.state.awaitingCloze) {
    return handleClozeSubmission(ctx);
  }
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
