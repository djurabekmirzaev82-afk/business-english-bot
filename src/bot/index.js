const { Telegraf, session } = require('telegraf');
const config = require('../config');

const ensureUser = require('./middleware/ensureUser');
const { mainMenu } = require('./keyboards');

const { handleStart } = require('./handlers/start');
const { showCabinet } = require('./handlers/cabinet');

const {
  startTest,
  handleAnswerCallback
} = require('./handlers/placementTest');

const { comingSoon } = require('./handlers/comingSoon');

const {
  showModuleList,
  showModule,
  startBusinessChallenge,
  handleBusinessChallengeAnswer,
  cancelBusinessChallenge
} = require('./handlers/businessEnglish');

const {
  showSchedule,
  showContact
} = require('./handlers/orgInfo');

const {
  showWritingMenu,
  showSubmenu,
  selectLesson,
  handleWritingSubmission
} = require('./handlers/writing');

const {
  showSpeakingMenu,
  selectScenario,
  handleSpeakingMessage,
  endSpeaking
} = require('./handlers/speaking');

const {
  showIeltsSpeakingMenu,
  startTopic: startIeltsSpeakingTopic,
  handleAnswer: handleIeltsSpeakingAnswer,
  handleAudioAnswer: handleIeltsSpeakingAudio
} = require('./handlers/ieltsSpeaking');

const {
  showListeningMenu,
  showResources: showListeningResources,
  startPart: startListeningPart,
  startMock: startListeningMock,
  handleSentenceReplyAnswer,
  handleSpeakerMatchingAnswer,
  handleExtractsMcAnswer,
  handleTextAnswer: handleListeningTextAnswer
} = require('./handlers/listeningMock');

const {
  showAdminStats
} = require('./handlers/admin');

const {
  showReadingMenu: showReadingMockMenu,
  showDrillMenu,
  showMockMenu,
  startDrill,
  startMock,
  handleClozeSubmission,
  handleMmAnswer,
  handleMcAnswer,
  handleGapAnswer
} = require('./handlers/readingMock');

const bot = new Telegraf(config.botToken);

// Session
bot.use(
  session({
    defaultSession: () => ({})
  })
);

bot.use(ensureUser);

// START
bot.start(handleStart);

bot.command('menu', (ctx) =>
  ctx.reply('Asosiy menyu:', mainMenu)
);

// CABINET
bot.hears(
  '👨‍🎓 Mening kabinetim',
  showCabinet
);

bot.command('cabinet', showCabinet);

// PLACEMENT TEST
bot.hears(
  '📝 Placement Test',
  startTest
);

bot.command('test', startTest);

// ADMIN
bot.command('admin', showAdminStats);

// MAIN MENU
bot.hears(
  '🏠 Asosiy menu',
  (ctx) => ctx.reply('Asosiy menyu:', mainMenu)
);

// ======================================================
// BUSINESS ENGLISH
// ======================================================

bot.hears(
  '💼 Business English',
  showModuleList
);

bot.action(
  /^bemod:(.+)$/,
  showModule
);

// Business Challenge
bot.action(
  'bechallenge:start',
  startBusinessChallenge
);

bot.action(
  'bechallenge:cancel',
  cancelBusinessChallenge
);

// ======================================================
// SCHEDULE & CONTACT
// ======================================================

bot.hears(
  '📅 Schedule',
  showSchedule
);

bot.hears(
  '☎ Contact',
  showContact
);

// ======================================================
// WRITING
// ======================================================

bot.hears(
  '✍ Writing',
  showWritingMenu
);

bot.action(
  /^wsubmenu:(.+)$/,
  showSubmenu
);

bot.action(
  /^wlesson:(.+)$/,
  selectLesson
);

// ======================================================
// READING
// ======================================================

bot.hears(
  '📖 Reading',
  showReadingMockMenu
);

bot.action(
  'rread:menu:drills',
  showDrillMenu
);

bot.action(
  'rread:menu:mocks',
  showMockMenu
);

bot.action(
  /^rread:startdrillpart:(\d+)$/,
  startDrill
);

bot.action(
  /^rread:startmock:(.+)$/,
  startMock
);

bot.action(
  /^rread:mm:(.+)$/,
  handleMmAnswer
);

bot.action(
  /^rread:mc:(\d+):(\d+)$/,
  handleMcAnswer
);

bot.action(
  /^rread:gap:(.+)$/,
  handleGapAnswer
);

// ======================================================
// LISTENING
// ======================================================

bot.hears(
  '🎧 Listening',
  showListeningMenu
);

bot.action(
  /^lmock:startpart:(\d+)$/,
  startListeningPart
);

bot.action(
  /^lmock:startmock:(.+)$/,
  startListeningMock
);

bot.action(
  /^lmock:sr:(\d+)$/,
  handleSentenceReplyAnswer
);

bot.action(
  /^lmock:sm:([A-F])$/,
  handleSpeakerMatchingAnswer
);

bot.action(
  /^lmock:emc:(\d+):(\d+):(\d+)$/,
  handleExtractsMcAnswer
);

bot.action(
  'lresources:show',
  showListeningResources
);

// ======================================================
// SPEAKING
// ======================================================

bot.hears(
  '🎤 Speaking Club',
  showSpeakingMenu
);

bot.action(
  /^speak:(.+)$/,
  selectScenario
);

bot.action(
  'ispeak:menu',
  showIeltsSpeakingMenu
);

bot.action(
  /^ispeak:(.+)$/,
  startIeltsSpeakingTopic
);

bot.hears(
  '🛑 Suhbatni tugatish',
  endSpeaking
);

// ======================================================
// COURSES
// ======================================================

[
  '📚 Courses'
].forEach((label) => {
  bot.hears(label, comingSoon);
});

// ======================================================
// PLACEMENT ANSWERS
// ======================================================

bot.action(
  /^answer:(\d+)$/,
  handleAnswerCallback
);

// ======================================================
// TEXT ROUTER
// ======================================================

bot.on('text', async (ctx) => {

  // BUSINESS CHALLENGE
  if (
    ctx.session.businessChallenge &&
    ctx.session.businessChallenge.awaitingAnswer
  ) {
    return handleBusinessChallengeAnswer(ctx);
  }

  // READING CLOZE
  if (
    ctx.session.readingRun &&
    ctx.session.readingRun.state &&
    ctx.session.readingRun.state.awaitingCloze
  ) {
    return handleClozeSubmission(ctx);
  }

  // IELTS SPEAKING
  if (ctx.session.ieltsSpeaking) {
    return handleIeltsSpeakingAnswer(ctx);
  }

  // WRITING
  if (ctx.session.pendingWriting) {
    return handleWritingSubmission(ctx);
  }

  // SPEAKING
  if (ctx.session.pendingSpeaking) {
    return handleSpeakingMessage(ctx);
  }

  // LISTENING
  if (ctx.session.listeningRun) {
    const handled =
      await handleListeningTextAnswer(ctx);

    if (handled) {
      return;
    }
  }

  // DEFAULT
  await ctx.reply(
    'Quyidagi menyudan bo\'limni tanlang 👇',
    mainMenu
  );
});

// ======================================================
// VOICE / AUDIO
// ======================================================

bot.on(
  ['voice', 'audio'],
  async (ctx) => {

    if (ctx.session.ieltsSpeaking) {
      return handleIeltsSpeakingAudio(ctx);
    }

    await ctx.reply(
      'Ovozli xabar faqat "🎓 IELTS Speaking" mashqi davomida ishlaydi. Quyidagi menyudan bo\'limni tanlang 👇',
      mainMenu
    );
  }
);

// ======================================================
// ERROR HANDLER
// ======================================================

bot.catch((err, ctx) => {
  console.error(
    `Bot error for update ${ctx.updateType}:`,
    err
  );
});

module.exports = bot;
