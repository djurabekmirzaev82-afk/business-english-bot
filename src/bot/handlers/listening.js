const fs = require('fs');
const path = require('path');
const { Markup } = require('telegraf');

const resources = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'listeningResources.json'), 'utf8')
);

async function showListening(ctx) {
  await ctx.reply(
    '🎧 Listening (Multilevel format)\n\n' +
      "6 qismdan iborat (Part 1-6, jami 35 savol). Bot audio'ni jonli (AI orqali) yaratadi.\n\n" +
      "⏳ Hozircha *Part 1-2* tayyor. Qolgan qismlar (3-6) keyingi bosqichlarda qo'shiladi.",
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🎧 Part 1 — Gapga javob tanlash (8 ta)', 'lpart1:start')],
        [Markup.button.callback('🎧 Part 2 — Note Completion (6 ta)', 'lpart2:start')],
        [Markup.button.callback('🔗 Qo\'shimcha manbalar (BBC, TED va h.k.)', 'lresources:show')],
      ]),
    }
  );
}

async function showResources(ctx) {
  await ctx.answerCbQuery();
  let text = "🔗 Qo'shimcha Listening manbalari:\n\n";
  for (const group of resources) {
    text += `${group.category}\n`;
    for (const item of group.items) {
      text += `— ${item.title}\n${item.url}\n`;
    }
    text += '\n';
  }
  await ctx.reply(text, { disable_web_page_preview: true });
}

module.exports = { showListening, showResources };
