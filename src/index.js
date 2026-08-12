const express = require('express');
const cors = require('cors');
const bot = require('./bot');
const config = require('./config');
const apiRouter = require('./api');

const PORT = process.env.PORT || 3000;
const PUBLIC_URL = process.env.RENDER_EXTERNAL_URL;

const app = express();
app.use(cors({ origin: config.frontendUrl }));
app.use(express.json({ limit: '15mb' }));

app.get('/', (req, res) => res.send('Business English Surxondaryo bot is running.'));
app.get('/health', (req, res) => res.send('OK'));
app.use('/api', apiRouter);

if (PUBLIC_URL) {
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
