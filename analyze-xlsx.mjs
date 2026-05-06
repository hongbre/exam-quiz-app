import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";

const inputName = process.argv[2] ?? "SAA-C03.xlsx";
const filePath = path.resolve(process.cwd(), "question", inputName);
const fileBuffer = fs.readFileSync(filePath);
const workbook = XLSX.read(fileBuffer, { type: "buffer" });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

const normalizeKey = (value) =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

function getField(row, targetKey) {
  if (row[targetKey] !== undefined) return String(row[targetKey]).trim();
  const t = normalizeKey(targetKey);
  for (const [k, v] of Object.entries(row)) {
    if (normalizeKey(k) === t) return String(v ?? "").trim();
  }
  return "";
}

function normalizeAnswer(value) {
  const raw = String(value).trim();
  if (!raw) return "";
  const circledMap = { "①": "1", "②": "2", "③": "3", "④": "4", "⑤": "5" };
  if (circledMap[raw]) return circledMap[raw];
  return raw
    .replace(/^choice\s*/i, "")
    .replace(/[.)\]>\-:]+$/g, "")
    .replace(/(번|호)\s*$/g, "")
    .replace(/^\(/, "")
    .replace(/\)$/, "")
    .trim();
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
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= choices.length) return numeric - 1;
  const direct = choices.findIndex((c) => c === String(answerRaw).trim());
  if (direct >= 0) return direct;
  return choices.findIndex((c) => normalizeAnswer(c).toUpperCase() === upper);
}

const stats = {
  totalRows: rows.length,
  missingQuestion: 0,
  tooFewChoices: 0,
  invalidAnswer: 0,
  parsed: 0,
};

const invalidSamples = [];

for (let idx = 0; idx < rows.length; idx++) {
  const row = rows[idx];
  const question = getField(row, "Question");
  const choices = ["Choice A", "Choice B", "Choice C", "Choice D", "Choice E"]
    .map((k) => getField(row, k))
    .filter((v) => v.length > 0);
  const answer = getField(row, "Answer");
  const ansIdx = findAnswerIndex(answer, choices);

  if (!question) {
    stats.missingQuestion++;
    if (invalidSamples.length < 20) invalidSamples.push({ row: idx + 2, reason: "missingQuestion", answer, choices });
    continue;
  }
  if (choices.length < 2) {
    stats.tooFewChoices++;
    if (invalidSamples.length < 20) invalidSamples.push({ row: idx + 2, reason: "tooFewChoices", answer, choices });
    continue;
  }
  if (ansIdx < 0) {
    stats.invalidAnswer++;
    if (invalidSamples.length < 20) invalidSamples.push({ row: idx + 2, reason: "invalidAnswer", answer, choices });
    continue;
  }
  stats.parsed++;
}

const report = {
  sheetName: workbook.SheetNames[0],
  headers: Object.keys(rows[0] || {}),
  stats,
  invalidSamples,
};

const outputPath = path.resolve(process.cwd(), "analysis-report.json");
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
