const express = require('express');
const fs = require('fs');
const path = require('path');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const dataDir = path.join(__dirname, '..', '..', 'data');

function loadJson(file) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
}

// Har bir chaqiruvda qayta o'qimaslik uchun modul yuklanganda bir marta xotiraga olinadi.
const businessModules = loadJson('businessModules.json');
const readingMocks = loadJson('readingMocks.json');
const listeningMocks = loadJson('listeningMocks.json');

router.get('/business-modules', requireAuth, (req, res) => {
  res.json(businessModules);
});

router.get('/business-modules/:id', requireAuth, (req, res) => {
  const mod = businessModules.find((m) => m.id === req.params.id);
  if (!mod) return res.status(404).json({ error: 'Mavzu topilmadi.' });
  res.json(mod);
});

router.get('/reading-mocks', requireAuth, (req, res) => {
  res.json(readingMocks.map((m) => ({ id: m.id, title: m.title })));
});

router.get('/reading-mocks/:id', requireAuth, (req, res) => {
  const mock = readingMocks.find((m) => m.id === req.params.id);
  if (!mock) return res.status(404).json({ error: 'Test topilmadi.' });
  res.json(mock);
});

router.get('/listening-mocks', requireAuth, (req, res) => {
  res.json(listeningMocks.map((m) => ({ id: m.id, title: m.title })));
});

router.get('/listening-mocks/:id', requireAuth, (req, res) => {
  const mock = listeningMocks.find((m) => m.id === req.params.id);
  if (!mock) return res.status(404).json({ error: 'Test topilmadi.' });
  res.json(mock);
});

module.exports = router;
