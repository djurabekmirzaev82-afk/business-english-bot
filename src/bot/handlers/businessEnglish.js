const fs = require('fs');
const path = require('path');
const { Markup } = require('telegraf');

const modules = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '..', '..', 'data', 'businessModules.json'),
    'utf8'
  )
);

const BUSINESS_CHALLENGES = require(
  path.join(__dirname, '..', '..', 'data', 'businessChallenges.js')
);

function moduleListKeyboard() {
  const buttons = modules.map((m) => [
    Markup.button.callback(m.title, `bemod:${m.id}`)
  ]);

  // New Business Challenge feature
  buttons.push([
    Markup.button.callback('🚀 Business Challenge', 'bechallenge:start')
  ]);

  return Markup.inlineKeyboard(buttons);
}

async function showModuleList(ctx) {
  await ctx.reply(
    '💼 Business English — mavzuni tanlang:',
    moduleListKeyboard()
  );
}

async function showModule(ctx) {
  const id = ctx.match[1];

  const mod = modules.find((m) => m.id === id);

  if (!mod) {
    await ctx.answerCbQuery('Mavzu topilmadi.');
    return;
  }

  await ctx.answerCbQuery();

  const vocabText = mod.vocabulary
    .map((v) => `• *${v.term}* — ${v.def}`)
    .join('\n');

  const phrasesText = mod.keyPhrases
    .map((p) => `— ${p}`)
    .join('\n');

  const text =
    `${mod.title}\n\n` +
    `📖 *Lug'at:*\n${vocabText}\n\n` +
    `🗣 *Foydali iboralar:*\n${phrasesText}\n\n` +
    `💬 *Namuna dialog:*\n${mod.miniDialogue}`;

  await ctx.reply(text, {
    parse_mode: 'Markdown'
  });
}

/**
 * Return a random business challenge.
 */
function getRandomChallenge() {
  if (!BUSINESS_CHALLENGES.length) {
    return null;
  }

  const index = Math.floor(
    Math.random() * BUSINESS_CHALLENGES.length
  );

  return BUSINESS_CHALLENGES[index];
}

/**
 * Start Business Challenge.
 */
async function startBusinessChallenge(ctx) {
  await ctx.answerCbQuery();

  const challenge = getRandomChallenge();

  if (!challenge) {
    await ctx.reply(
      '🚀 Hozircha Business Challenge mavjud emas.'
    );
    return;
  }

  ctx.session.businessChallenge = {
    challengeId: challenge.id,
    startedAt: Date.now(),
    attempts: 0,
    awaitingAnswer: true
  };

  const text =
    `🚀 *BUSINESS CHALLENGE*\n\n` +
    `${challenge.emoji} *${challenge.title}*\n\n` +
    `📊 Level: *${challenge.level}*\n` +
    `🏷 Category: *${challenge.category}*\n\n` +
    `📌 *Situation:*\n${challenge.scenario}\n\n` +
    `🎯 *Your task:*\n${challenge.task}\n\n` +
    `⏱ Time: *${challenge.timeLimit} seconds*\n\n` +
    `✍️ Javobingizni ingliz tilida yozing.\n` +
    `Qanchalik professional yozsangiz, shunchalik yaxshi natija olasiz.`;

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback(
          '🔄 Boshqa Challenge',
          'bechallenge:start'
        )
      ],
      [
        Markup.button.callback(
          '❌ Challenge-ni bekor qilish',
          'bechallenge:cancel'
        )
      ]
    ])
  });
}

/**
 * Handle Business Challenge text answer.
 *
 * AI evaluation will be connected in the next step.
 */
async function handleBusinessChallengeAnswer(ctx) {
  const state = ctx.session.businessChallenge;

  if (!state || !state.awaitingAnswer) {
    return false;
  }

  const challenge = BUSINESS_CHALLENGES.find(
    (item) => item.id === state.challengeId
  );

  if (!challenge) {
    delete ctx.session.businessChallenge;
    await ctx.reply(
      'Challenge topilmadi. Iltimos, qaytadan boshlang.'
    );
    return true;
  }

  const answer = (ctx.message.text || '').trim();

  if (!answer) {
    await ctx.reply('Iltimos, javobingizni yozing.');
    return true;
  }

  state.attempts += 1;
  state.answer = answer;
  state.awaitingAnswer = false;
  state.completedAt = Date.now();

  // Temporary result until AI evaluator is connected.
  await ctx.reply(
    `✅ *Javob qabul qilindi!*\n\n` +
    `🚀 Challenge: *${challenge.title}*\n\n` +
    `📝 Sizning javobingiz:\n${answer}\n\n` +
    `⏳ AI evaluation keyingi bosqichda ulanadi.\n\n` +
    `Hozircha javobingiz saqlandi. Keyingi versiyada AI:\n` +
    `• Business vocabulary\n` +
    `• Grammar\n` +
    `• Fluency\n` +
    `• Professionalism\n` +
    `• Task completion\n` +
    `bo‘yicha 100 ballik baho beradi.`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '🚀 Yana Challenge',
            'bechallenge:start'
          )
        ]
      ])
    }
  );

  return true;
}

/**
 * Cancel active challenge.
 */
async function cancelBusinessChallenge(ctx) {
  await ctx.answerCbQuery();

  delete ctx.session.businessChallenge;

  await ctx.reply(
    '❌ Business Challenge bekor qilindi.'
  );
}

module.exports = {
  showModuleList,
  showModule,
  startBusinessChallenge,
  handleBusinessChallengeAnswer,
  cancelBusinessChallenge
};
