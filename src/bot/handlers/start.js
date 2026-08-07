const { mainMenu } = require('../keyboards');

async function handleStart(ctx) {
  const name = ctx.state.user.first_name || 'Do\'stim';
  await ctx.reply(
    `👋 Assalomu alaykum, ${name}!\n\n` +
      `Business English in Surkhandarya Region botiga xush kelibsiz.\n\n` +
      `Bu yerda siz:\n` +
      `📝 Bepul Placement Test orqali darajangizni (A1–C1) aniqlashingiz\n` +
      `👨‍🎓 Shaxsiy kabinetingizda natijalarni kuzatishingiz mumkin.\n\n` +
      `Boshlash uchun quyidagi menyudan foydalaning 👇`,
    mainMenu
  );
}

module.exports = { handleStart };
