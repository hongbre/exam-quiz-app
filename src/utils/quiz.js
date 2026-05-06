import * as XLSX from "xlsx";

export function parseWorkbook(fileBuffer) {
  const workbook = XLSX.read(fileBuffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  return rows
    .map((row, idx) => {
      const questionNo = getField(row, "No");
      const question = getField(row, "Question");
      const choicesRaw = [
        getField(row, "Choice A"),
        getField(row, "Choice B"),
        getField(row, "Choice C"),
        getField(row, "Choice D"),
        getField(row, "Choice E"),
      ];
      const choices = choicesRaw
        .map((v) => String(v).trim())
        .filter((v) => v.length > 0);

      const answerRaw = getField(row, "Answer");
      const reference = getField(row, "Reference");
      const category = getField(row, "Category") || "기타";

      const correctIndex = findAnswerIndex(answerRaw, choices);

      if (!question || choices.length < 2 || correctIndex < 0) {
        return null;
      }

      return {
        id: questionNo ? `no-${questionNo}` : `${idx}-${question.slice(0, 20)}`,
        no: questionNo || String(idx + 1),
        question,
        choices,
        correctIndex,
        category,
        reference,
      };
    })
    .filter(Boolean);
}

function getField(row, targetKey) {
  if (row[targetKey] !== undefined) return String(row[targetKey]).trim();

  const normalizedTarget = normalizeKey(targetKey);
  for (const [key, value] of Object.entries(row)) {
    if (normalizeKey(key) === normalizedTarget) {
      return String(value ?? "").trim();
    }
  }
  return "";
}

function normalizeKey(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function findAnswerIndex(answerRaw, choices) {
  if (!answerRaw) return -1;
  const normalized = normalizeAnswer(answerRaw);
  const upper = normalized.toUpperCase();

  const alphaMap = { A: 0, B: 1, C: 2, D: 3, E: 4 };
  if (Object.hasOwn(alphaMap, upper)) {
    const idx = alphaMap[upper];
    return idx < choices.length ? idx : -1;
  }

  const numeric = Number(normalized);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= choices.length) {
    return numeric - 1;
  }

  const directMatch = choices.findIndex((choice) => choice === answerRaw.trim());
  if (directMatch >= 0) return directMatch;

  const relaxedMatch = choices.findIndex(
    (choice) => normalizeAnswer(choice).toUpperCase() === upper
  );
  return relaxedMatch;
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
