const fs = require('fs');
const path = require('path');

const mocks = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'data', 'readingMocks.json'), 'utf8')
);

function getMock(id) {
  return mocks.find((m) => m.id === id);
}

function getAllMocks() {
  return mocks;
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

/** Scores Part 1 (open cloze) given an array of user-submitted words (in gap order). */
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

module.exports = { getMock, getAllMocks, partItemCount, totalQuestions, scoreOpenCloze };
