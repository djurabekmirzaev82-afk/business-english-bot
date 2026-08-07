const { Markup } = require('telegraf');

/**
 * MVP scope keeps only Placement Test and Student Cabinet fully functional.
 * Remaining menu items are shown (matching the full product vision) but reply
 * with "coming soon" until later phases are built — this keeps the bot's
 * navigation shape stable as features get added incrementally.
 */
const mainMenu = Markup.keyboard([
  ['📝 Placement Test', '👨‍🎓 Mening kabinetim'],
  ['💼 Business English', '📚 Courses'],
  ['🎤 Speaking Club', '✍ Writing'],
  ['📅 Schedule', '☎ Contact'],
]).resize();

const cancelMenu = Markup.keyboard([['❌ Bekor qilish']]).resize();

const backToMenu = Markup.keyboard([['🏠 Asosiy menu']]).resize();

function optionsKeyboard(options) {
  const buttons = options.map((opt, idx) => [Markup.button.callback(opt, `answer:${idx}`)]);
  return Markup.inlineKeyboard(buttons);
}

const languageKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('🇺🇿 Uzbek', 'lang:uz')],
  [Markup.button.callback('🇷🇺 Русский', 'lang:ru')],
  [Markup.button.callback('🇬🇧 English', 'lang:en')],
]);

module.exports = {
  mainMenu,
  cancelMenu,
  backToMenu,
  optionsKeyboard,
  languageKeyboard,
};
