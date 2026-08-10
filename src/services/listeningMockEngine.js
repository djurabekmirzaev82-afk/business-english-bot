const fs = require('fs');
const path = require('path');
const audioTutor = require('./audioTutor');

const mocks = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'listeningMocks.json'), 'utf8'));
const explanations = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'data', 'listeningPartExplanations.json'), 'utf8')
);

const AUDIO_DIR = path.join(__dirname, '..', 'assets', 'audio', 'listening');

function getMock(id) {
  return mocks.find((m) => m.id === id);
}

function getAllMocks() {
  return mocks;
}

function getExplanation(partNumber) {
  return explanations[`part${partNumber}`];
}

/**
 * Resolves audio for any listening item: if `audioFile` is set, reads the bundled
 * MP3/WAV/OGG file from src/assets/audio/listening/<audioFile>. Otherwise falls
 * back to generating it live via Gemini TTS from `script` (and `isDialogue` for
 * two-speaker extracts).
 */
async function resolveAudio(item) {
  if (item.audioFile) {
    const filePath = path.join(AUDIO_DIR, item.audioFile);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Audio fayl topilmadi: ${item.audioFile}. Uni src/assets/audio/listening/ papkasiga joylashtiring.`);
    }
    return fs.readFileSync(filePath);
  }
  if (item.isDialogue) {
    return audioTutor.generateDialogueSpeech(item.script, 'A', 'Kore', 'B', 'Puck');
  }
  return audioTutor.generateSpeech(item.script);
}

function normalizeWord(w) {
  return w.trim().toLowerCase().replace(/[.,!?;:]/g, '');
}

module.exports = { getMock, getAllMocks, getExplanation, resolveAudio, normalizeWord, AUDIO_DIR };
