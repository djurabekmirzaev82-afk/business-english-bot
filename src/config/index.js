require('dotenv').config();

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}. Copy .env.example to .env and fill it in.`);
  }
  return value;
}

module.exports = {
  botToken: requireEnv('BOT_TOKEN'),
  databaseUrl: requireEnv('DATABASE_URL'),
  databaseSsl: process.env.DATABASE_SSL === 'true',
  geminiApiKey: process.env.GEMINI_API_KEY || null,
  // Web ilova (React) uchun JWT imzolash kaliti. Faqat /api/auth ishlatilganda kerak,
  // shuning uchun requireEnv emas — bot yolg'iz ishlaganda ham xatolik bermaydi.
  jwtSecret: process.env.JWT_SECRET || null,
  // Web ilova manzili (CORS uchun), masalan Vercel'dagi domen.
  frontendUrl: process.env.FRONTEND_URL || '*',
  // Comma-separated Telegram numeric user IDs that get auto-promoted to role='admin'.
  // Find your own ID by messaging @userinfobot on Telegram.
  adminTelegramIds: (process.env.ADMIN_TELEGRAM_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  nodeEnv: process.env.NODE_ENV || 'development',
};
