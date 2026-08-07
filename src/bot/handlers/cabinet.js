const { getCabinetSummary } = require('../../services/userService');

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('uz-UZ', { year: 'numeric', month: 'long', day: 'numeric' });
}

async function showCabinet(ctx) {
  const user = ctx.state.user;
  const summary = await getCabinetSummary(user.id);

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Mehmon';
  let text = `👨‍🎓 Mening kabinetim\n\n`;
  text += `Ism: ${fullName}\n`;
  text += `Username: ${user.username ? '@' + user.username : '-'}\n`;
  text += `Daraja (CEFR): ${user.cefr_level || 'Belgilanmagan — Placement Test topshiring'}\n\n`;

  if (summary.latestAttempt) {
    text += `📝 So'nggi Placement Test:\n`;
    text += `— Natija: ${summary.latestAttempt.correct_answers}/${summary.latestAttempt.total_questions}\n`;
    text += `— Daraja: ${summary.latestAttempt.result_level}\n`;
    text += `— Sana: ${formatDate(summary.latestAttempt.finished_at)}\n`;
    text += `— Jami urinishlar: ${summary.attemptCount}\n`;
  } else {
    text += `Hali Placement Test topshirmadingiz. "📝 Placement Test" tugmasini bosing.\n`;
  }

  text += `\n💳 To'lov tarixi, uy vazifalari va sertifikatlar keyingi bosqichda qo'shiladi.`;

  await ctx.reply(text);
}

module.exports = { showCabinet };
