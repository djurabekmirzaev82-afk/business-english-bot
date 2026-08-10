const { findOrCreateUser, promoteToAdmin } = require('../../services/userService');
const config = require('../../config');

module.exports = async function ensureUser(ctx, next) {
  if (!ctx.from) {
    return next();
  }
  try {
    ctx.state.user = await findOrCreateUser(ctx);

    // Auto-promote configured admin Telegram IDs (ADMIN_TELEGRAM_IDS in .env) to role='admin'.
    const isConfiguredAdmin = config.adminTelegramIds.includes(String(ctx.from.id));
    if (isConfiguredAdmin && ctx.state.user.role !== 'admin') {
      ctx.state.user = await promoteToAdmin(ctx.state.user.id);
    }
  } catch (err) {
    console.error('ensureUser middleware failed:', err.message);
    if (ctx.chat) {
      await ctx.reply('Texnik xatolik yuz berdi. Birozdan so\'ng qayta urinib ko\'ring.');
    }
    return;
  }
  return next();
};
