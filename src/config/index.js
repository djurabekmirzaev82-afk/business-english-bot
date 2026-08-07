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
  nodeEnv: process.env.NODE_ENV || 'development',
};
