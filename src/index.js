const express = require('express');
const bot = require('./bot');

const PORT = process.env.PORT || 3000;
// Render (and most PaaS providers) set this automatically to the app's public URL.
const PUBLIC_URL = process.env.RENDER_EXTERNAL_URL;

if (PUBLIC_URL) {
  // --- Production / hosted mode: webhook + tiny HTTP server ---
  const app = express();
  const webhookPath = '/telegraf-webhook';

  // Simple endpoints so uptime monitors (e.g. UptimeRobot) have something to ping
  // to keep a free-tier instance from spinning down.
  app.get('/', (req, res) => res.send('Business English Surxondaryo bot is running.'));
  app.get('/health', (req, res) => res.send('OK'));

  app.use(bot.webhookCallback(webhookPath));

  app.listen(PORT, () => {
    console.log(`🌐 HTTP server listening on port ${PORT}`);
  });

  bot.telegram
    .setWebhook(`${PUBLIC_URL}${webhookPath}`)
    .then(() => console.log(`✅ Webhook set: ${PUBLIC_URL}${webhookPath}`))
    .catch((err) => {
      console.error('Webhook sozlashda xatolik:', err);
      process.exit(1);
    });
} else {
  // --- Local development mode: long polling (no public URL needed) ---
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
