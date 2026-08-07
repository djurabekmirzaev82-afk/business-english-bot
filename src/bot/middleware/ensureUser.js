const { findOrCreateUser } = require('../../services/userService');

module.exports = async function ensureUser(ctx, next) {
  if (!ctx.from) {
    return next();
  }
  try {
    ctx.state.user = await findOrCreateUser(ctx);
  } catch (err) {
    console.error('ensureUser middleware failed:', err.message);
    if (ctx.chat) {
      await ctx.reply('Texnik xatolik yuz berdi. Birozdan so\'ng qayta urinib ko\'ring.');
    }
    return;
  }
  return next();
};
