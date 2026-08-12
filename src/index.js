const express = require('express');
const cors = require('cors');
const bot = require('./bot');
const config = require('./config');
const apiRouter = require('./api');

const PORT = process.env.PORT || 3000;
// Render (and most PaaS providers) set this automatically to the app's public URL.
const PUBLIC_URL = process.env.RENDER_EXTERNAL_URL;

// The Express app now serves three things from one process (all free-tier friendly):
//   1. The Telegram bot webhook (production) or nothing here in polling mode
//   2. Uptime-check endpoints
//   3. The /api/* REST API used by the web app (BizEnglish Surxon)
const app = express();
app.use(cors({ origin: config.frontendUrl }));
app.use(express.json());

app.get('/', (req, res) => res.send('Business English Surxondaryo bot is running.'));
app.get('/health', (req, res) => res.send('OK'));
app.use('/api', apiRouter);

if (PUBLIC_URL) {
  // --- Production / hosted mode: webhook + HTTP server (bot + API together) ---
  const webhookPath = '/telegraf-webhook';
  app.use(bot.webhookCallback(webhookPath));

  app.listen(PORT, () => {
    console.log(`🌐 HTTP server (bot webhook + /api) listening on port ${PORT}`);
  });

  bot.telegram
    .setWebhook(`${PUBLIC_URL}${webhookPath}`)
    .then(() => console.log(`✅ Webhook set: ${PUBLIC_URL}${webhookPath}`))
    .catch((err) => {
      console.error('Webhook sozlashda xatolik:', err);
      process.exit(1);
    });
} else {
  // --- Local development mode: bot uses long polling, but /api still needs a port ---
  app.listen(PORT, () => {
    console.log(`🌐 HTTP server (/api only, bot is polling) listening on port ${PORT}`);
  });

  bot
    .launch()
    .then(() => console.log('✅ Business English Surxondaryo bot ishga tushdi (polling mode).'))
    .catch((err) => {
      console.error('Botni ishga tushirishda xatolik:', err);
      process.exit(1);
    });

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
