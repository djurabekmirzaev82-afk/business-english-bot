const { getAdminStats } = require('../../services/userService');

function formatDate(d) {
  return new Date(d).toLocaleDateString('uz-UZ', { year: 'numeric', month: 'short', day: 'numeric' });
}

async function showAdminStats(ctx) {
  if (!ctx.state.user || ctx.state.user.role !== 'admin') {
    await ctx.reply("Bu buyruq faqat administratorlar uchun.");
    return;
  }

  const stats = await getAdminStats();

  let text = `📊 *Bot statistikasi*\n\n`;
  text += `👥 Jami foydalanuvchilar: *${stats.total_users}*\n`;
  text += `🆕 Bugun qo'shilgan: ${stats.new_today}\n`;
  text += `📅 Shu hafta qo'shilgan: ${stats.new_this_week}\n`;
  text += `📝 Yakunlangan Placement Testlar: ${stats.totalAttempts}\n\n`;

  text += `*So'nggi 10 ta foydalanuvchi:*\n`;
  stats.recentUsers.forEach((u) => {
    const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || 'Noma\'lum';
    const username = u.username ? `@${u.username}` : '—';
    const level = u.cefr_level || '—';
    text += `— ${name} (${username}), ${level}, ${formatDate(u.created_at)}\n`;
  });

  await ctx.reply(text, { parse_mode: 'Markdown' });
}

module.exports = { showAdminStats };
