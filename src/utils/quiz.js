const CHOICE_ORDER = ["A", "B", "C", "D", "E", "F"];

/**
 * @param {unknown} raw
 * @param {{ category?: string }} [options]
 */
export function parseJsonQuestions(raw, options = {}) {
  const items = Array.isArray(raw) ? raw : [];
  const category = options.category ?? "기타";

  return items
    .map((row, idx) => normalizeQuestion(row, idx, category))
    .filter(Boolean);
}

function normalizeQuestion(row, idx, category) {
  if (!row || typeof row !== "object") return null;

  const questionNo = pickString(row, ["no", "No"]);
  const question = pickString(row, ["question", "Question"]);
  const choicesObj = pickObject(row, ["choices", "Choices"]);
  if (!choicesObj) return null;

  const choiceLetters = [];
  const choices = [];
  for (const letter of CHOICE_ORDER) {
    const text = String(choicesObj[letter] ?? "").trim();
    if (text.length > 0) {
      choiceLetters.push(letter);
      choices.push(text);
    }
  }

  const answerRaw = pickString(row, ["answer", "Answer"]);
  const reference = pickString(row, ["reference", "Reference"]);
  const answerExplanation = pickString(row, ["answerExplanation", "AnswerExplanation"]);
  const explanationsObj = pickObject(row, ["explanations", "Explanations"]) ?? {};

  const explanations = {};
  for (const letter of choiceLetters) {
    const exp = pickExplanationForLetter(explanationsObj, letter);
    if (exp) {
      explanations[letter] = exp;
    }
  }

  const correctIndices = findAnswerIndices(answerRaw, choiceLetters, choices);

  if (!question || choices.length < 2 || correctIndices.length === 0) {
    return null;
  }

  return {
    id: questionNo ? `no-${questionNo}` : `${idx}-${question.slice(0, 20)}`,
    no: questionNo || String(idx + 1),
    question,
    choiceLetters,
    choices,
    correctIndices,
    category,
    reference,
    answerExplanation,
    explanations,
  };
}

function pickString(obj, keys) {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) {
      return String(obj[k]).trim();
    }
  }
  return "";
}

function pickObject(obj, keys) {
  for (const k of keys) {
    const v = obj[k];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return v;
    }
  }
  return null;
}

/** explanations 객체의 키가 A/a 등으로 달라도 보기 문자와 매칭 */
function pickExplanationForLetter(explanationsObj, letter) {
  const upper = String(letter).toUpperCase();
  const direct = explanationsObj[letter] ?? explanationsObj[upper];
  if (direct != null && String(direct).trim()) {
    return String(direct).trim();
  }
  for (const [key, value] of Object.entries(explanationsObj)) {
    if (String(key).trim().toUpperCase() === upper && String(value).trim()) {
      return String(value).trim();
    }
  }
  return "";
}

function findAnswerIndices(answerRaw, choiceLetters, choices) {
  if (!answerRaw) return [];
  const tokens = String(answerRaw)
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  const normalizedTokens = tokens.length > 0 ? tokens : [String(answerRaw).trim()];
  const indices = normalizedTokens
    .map((token) => findSingleAnswerIndex(token, choiceLetters, choices))
    .filter((idx) => idx >= 0);

  const unique = [...new Set(indices)].sort((a, b) => a - b);
  return unique.length === normalizedTokens.length ? unique : [];
}

function findSingleAnswerIndex(answerRaw, choiceLetters, choices) {
  const normalized = normalizeAnswer(answerRaw);
  const upper = normalized.toUpperCase();

  const letterIdx = choiceLetters.indexOf(upper);
  if (letterIdx >= 0) return letterIdx;

  const alphaMap = { A: 0, B: 1, C: 2, D: 3, E: 4, F: 5 };
  if (Object.hasOwn(alphaMap, upper)) {
    const letter = CHOICE_ORDER[alphaMap[upper]];
    const idx = choiceLetters.indexOf(letter);
    return idx >= 0 ? idx : -1;
  }

  const numeric = Number(normalized);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= choices.length) {
    return numeric - 1;
  }

  const directMatch = choices.findIndex((choice) => choice === String(answerRaw).trim());
  if (directMatch >= 0) return directMatch;

  return choices.findIndex(
    (choice) => normalizeAnswer(choice).toUpperCase() === upper
  );
}

function normalizeAnswer(value) {
  const raw = String(value).trim();
  if (!raw) return "";

  const circledMap = {
    "①": "1",
    "②": "2",
    "③": "3",
    "④": "4",
    "⑤": "5",
    "⑥": "6",
  };
  if (circledMap[raw]) return circledMap[raw];

  return raw
    .replace(/^choice\s*/i, "")
    .replace(/[.)\]>\-:]+$/g, "")
    .replace(/(번|호)\s*$/g, "")
    .replace(/^\(/, "")
    .replace(/\)$/, "")
    .trim();
}

export function pickQuestionSet(questions, historyMap, cycleSize) {
  const weights = questions.map((q) => {
    const hist = historyMap[q.id] ?? { attempts: 0, wrong: 0 };
    const unansweredBoost = hist.attempts === 0 ? 1000 : 0;
    const wrongRate = hist.attempts > 0 ? hist.wrong / hist.attempts : 0;
    const categoryPressure = getCategoryWrongRate(q.category, questions, historyMap);
    const weight = unansweredBoost + wrongRate * 100 + categoryPressure * 50 + Math.random() * 10;
    return { id: q.id, weight };
  });

  const idToQuestion = Object.fromEntries(questions.map((q) => [q.id, q]));
  return weights
    .sort((a, b) => b.weight - a.weight)
    .slice(0, Math.min(cycleSize, questions.length))
    .map((w) => idToQuestion[w.id]);
}

function getCategoryWrongRate(category, questions, historyMap) {
  const targets = questions.filter((q) => q.category === category);
  if (targets.length === 0) return 0;

  let attempts = 0;
  let wrong = 0;
  for (const q of targets) {
    const hist = historyMap[q.id];
    if (!hist) continue;
    attempts += hist.attempts;
    wrong += hist.wrong;
  }

  if (attempts === 0) return 0;
  return wrong / attempts;
}

export function updateHistory(historyMap, questionId, isCorrect) {
  const prev = historyMap[questionId] ?? { attempts: 0, wrong: 0 };
  return {
    ...historyMap,
    [questionId]: {
      attempts: prev.attempts + 1,
      wrong: prev.wrong + (isCorrect ? 0 : 1),
    },
  };
}
