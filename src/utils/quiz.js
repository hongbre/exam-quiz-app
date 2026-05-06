import * as XLSX from "xlsx";

export function parseWorkbook(fileBuffer) {
  const workbook = XLSX.read(fileBuffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  return rows
    .map((row, idx) => {
      const question = String(row.question ?? row.문제 ?? "").trim();
      const choicesRaw = [
        row.choice1 ?? row.보기1 ?? "",
        row.choice2 ?? row.보기2 ?? "",
        row.choice3 ?? row.보기3 ?? "",
        row.choice4 ?? row.보기4 ?? "",
        row.choice5 ?? row.보기5 ?? "",
      ];
      const choices = choicesRaw
        .map((v) => String(v).trim())
        .filter((v) => v.length > 0);

      const answerRaw = String(row.answer ?? row.정답 ?? "").trim();
      const answerIndex = Number(answerRaw) - 1;
      const answerText = String(row.answerText ?? row.정답텍스트 ?? "").trim();
      const category = String(row.category ?? row.분야 ?? "기타").trim() || "기타";

      let correctIndex = -1;
      if (Number.isInteger(answerIndex) && answerIndex >= 0 && answerIndex < choices.length) {
        correctIndex = answerIndex;
      } else if (answerText) {
        correctIndex = choices.findIndex((v) => v === answerText);
      }

      if (!question || choices.length < 2 || correctIndex < 0) {
        return null;
      }

      return {
        id: `${idx}-${question.slice(0, 20)}`,
        question,
        choices,
        correctIndex,
        category,
      };
    })
    .filter(Boolean);
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
