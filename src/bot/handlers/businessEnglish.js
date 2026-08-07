const fs = require('fs');
const path = require('path');
const { Markup } = require('telegraf');

const modules = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'businessModules.json'), 'utf8')
);

function moduleListKeyboard() {
  const buttons = modules.map((m) => [Markup.button.callback(m.title, `bemod:${m.id}`)]);
  return Markup.inlineKeyboard(buttons);
}

async function showModuleList(ctx) {
  await ctx.reply('💼 Business English — mavzuni tanlang:', moduleListKeyboard());
}

async function showModule(ctx) {
  const id = ctx.match[1];
  const mod = modules.find((m) => m.id === id);
  if (!mod) {
    await ctx.answerCbQuery('Mavzu topilmadi.');
    return;
  }
  await ctx.answerCbQuery();

  const vocabText = mod.vocabulary.map((v) => `• *${v.term}* — ${v.def}`).join('\n');
  const phrasesText = mod.keyPhrases.map((p) => `— ${p}`).join('\n');

  const text =
    `${mod.title}\n\n` +
    `📖 *Lug'at:*\n${vocabText}\n\n` +
    `🗣 *Foydali iboralar:*\n${phrasesText}\n\n` +
    `💬 *Namuna dialog:*\n${mod.miniDialogue}`;

  await ctx.reply(text, { parse_mode: 'Markdown' });
}

module.exports = { showModuleList, showModule };
