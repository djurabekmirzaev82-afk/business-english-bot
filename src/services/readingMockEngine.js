const fs = require('fs');
const path = require('path');

const mocks = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'readingMocks.json'), 'utf8'));
const drills = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'readingDrills.json'), 'utf8'));
const explanations = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'data', 'readingPartExplanations.json'), 'utf8')
);

function getMock(id) {
  return mocks.find((m) => m.id === id);
}

function getAllMocks() {
  return mocks;
}

function getDrill(id) {
  return drills.find((d) => d.id === id);
}

function getDrillsForPart(partNumber) {
  return drills.filter((d) => d.partNumber === partNumber);
}

function getExplanation(partNumber) {
  return explanations[`part${partNumber}`];
}

function partItemCount(part) {
  if (part.taskType === 'open_cloze') return part.gaps.length;
  if (part.taskType === 'gapped_text') return Object.keys(part.answers).length;
  return part.questions.length; // multiple_matching, multiple_choice
}

function totalQuestions(mock) {
  return mock.parts.reduce((sum, p) => sum + partItemCount(p), 0);
}

function normalizeWord(w) {
  return w.trim().toLowerCase().replace(/[.,!?;:]/g, '');
}

/** Scores an open-cloze part (mock part OR standalone drill — same shape) given user words in gap order. */
function scoreOpenCloze(part, userWords) {
  let correct = 0;
  const results = part.gaps.map((gap, i) => {
    const userWord = normalizeWord(userWords[i] || '');
    const isCorrect = gap.answers.some((a) => normalizeWord(a) === userWord);
    if (isCorrect) correct += 1;
    return { number: gap.number, userWord: userWords[i] || '(bo\'sh)', correctAnswers: gap.answers, isCorrect };
  });
  return { correct, total: part.gaps.length, results };
}

module.exports = {
  getMock,
  getAllMocks,
  getDrill,
  getDrillsForPart,
  getExplanation,
  partItemCount,
  totalQuestions,
  scoreOpenCloze,
};
