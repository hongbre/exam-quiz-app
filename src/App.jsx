import { useEffect, useMemo, useState } from "react";
import { parseJsonQuestions, pickQuestionSet, updateHistory } from "./utils/quiz";

const LS_KEY = "quiz-history-v2";

const jsonModules = import.meta.glob("./data/*.json", { eager: true });
const dataFiles = Object.entries(jsonModules)
  .map(([path, mod]) => {
    const name = path.split("/").pop() ?? path;
    const baseName = name.replace(/\.json$/i, "") || name;
    const raw = mod?.default ?? mod;
    return { path, name, baseName, raw };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

function App() {
  const [questions, setQuestions] = useState([]);
  const [selectedFile, setSelectedFile] = useState(dataFiles[0]?.path ?? "");
  const [cycleSize, setCycleSize] = useState(20);
  const [history, setHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY) ?? "{}");
    } catch {
      return {};
    }
  });
  const [cycle, setCycle] = useState([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState([]);
  const [checked, setChecked] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);

  const current = cycle[index] ?? null;
  const progress = cycle.length ? `${index + 1} / ${cycle.length}` : "0 / 0";

  const stats = useMemo(() => {
    const attempts = Object.values(history).reduce((acc, v) => acc + v.attempts, 0);
    const wrong = Object.values(history).reduce((acc, v) => acc + v.wrong, 0);
    const accuracy = attempts ? Math.round(((attempts - wrong) / attempts) * 100) : 0;
    return { attempts, wrong, accuracy };
  }, [history]);

  useEffect(() => {
    const item = dataFiles.find((f) => f.path === selectedFile);
    if (!item) {
      setQuestions([]);
      return;
    }
    const parsed = parseJsonQuestions(item.raw, { category: item.baseName });
    setQuestions(parsed);
    setCycle([]);
    setIndex(0);
    setSelected([]);
    setChecked(false);
    setCorrectCount(0);
  }, [selectedFile]);

  function startCycle() {
    if (questions.length === 0) return;
    const selectedCycle = pickQuestionSet(questions, history, cycleSize);
    setCycle(selectedCycle);
    setIndex(0);
    setSelected([]);
    setChecked(false);
    setCorrectCount(0);
  }

  function checkAnswer() {
    if (!current || selected.length === 0 || checked) return;
    const selectedSorted = [...selected].sort((a, b) => a - b);
    const correctSorted = [...current.correctIndices].sort((a, b) => a - b);
    const isCorrect =
      selectedSorted.length === correctSorted.length &&
      selectedSorted.every((value, idx) => value === correctSorted[idx]);
    setChecked(true);
    if (isCorrect) setCorrectCount((prev) => prev + 1);

    const nextHistory = updateHistory(history, current.id, isCorrect);
    setHistory(nextHistory);
    localStorage.setItem(LS_KEY, JSON.stringify(nextHistory));
  }

  function nextQuestion() {
    if (index + 1 >= cycle.length) return;
    setIndex((prev) => prev + 1);
    setSelected([]);
    setChecked(false);
  }

  function onChoiceClick(choiceIndex) {
    if (!current || checked) return;
    const isMultiAnswer = current.correctIndices.length > 1;
    if (!isMultiAnswer) {
      setSelected([choiceIndex]);
      return;
    }

    setSelected((prev) => {
      if (prev.includes(choiceIndex)) {
        return prev.filter((v) => v !== choiceIndex);
      }
      return [...prev, choiceIndex];
    });
  }

  const isFinished = cycle.length > 0 && index === cycle.length - 1 && checked;

  return (
    <div className="app">
      <h1>객관식 학습 앱</h1>
      <p className="sub">미풀이 우선 + 오답률 높은 분야 우선 출제</p>

      <section className="panel">
        <label className="label">문제 세트 선택 (`src/data`)</label>
        <select
          value={selectedFile}
          onChange={(e) => setSelectedFile(e.target.value)}
          disabled={dataFiles.length === 0}
        >
          {dataFiles.length === 0 ? (
            <option value="">JSON 파일이 없습니다</option>
          ) : (
            dataFiles.map((file) => (
              <option key={file.path} value={file.path}>
                {file.name}
              </option>
            ))
          )}
        </select>
        <p className="hint">보기 A~F, Answer, Reference, AnswerExplanation, Explanations</p>
      </section>

      <section className="panel row">
        <div>
          <label className="label">사이클 문제 수</label>
          <input
            type="number"
            min={1}
            max={Math.max(1, questions.length)}
            value={cycleSize}
            onChange={(e) => setCycleSize(Number(e.target.value) || 1)}
          />
        </div>
        <button onClick={startCycle} disabled={questions.length === 0}>
          랜덤 사이클 시작
        </button>
      </section>

      <section className="panel">
        <div className="stats">
          <span>전체 문제: {questions.length}</span>
          <span>풀이 기록: {stats.attempts}회</span>
          <span>정확도: {stats.accuracy}%</span>
        </div>
      </section>

      {current && (
        <section className="panel">
          <div className="meta">
            <strong>
              {progress} · No.{current.no}
            </strong>
            <span className="chip">{current.category}</span>
          </div>
          {current.correctIndices.length > 1 && (
            <p className="hint">이 문제는 복수 정답입니다. 해당하는 보기를 모두 선택하세요.</p>
          )}
          <h4>{current.question}</h4>
          <div className="choices">
            {current.choices.map((choice, i) => {
              const letter = current.choiceLetters[i];
              const picked = selected.includes(i);
              const isCorrectChoice = current.correctIndices.includes(i);
              const correct = checked && isCorrectChoice;
              const wrong = checked && picked && !isCorrectChoice;
              const explanation = (current.explanations[letter] ?? "").trim();
              // 정답 보기: explanations에 텍스트가 있을 때만 표시. 오답·미선택 보기: 설명 없으면 '—'
              const showChoiceExplanation =
                checked &&
                (!isCorrectChoice || explanation.length > 0);

              return (
                <div key={`${current.id}-${letter}`} className="choice-block">
                  <button
                    type="button"
                    className={`choice ${picked ? "picked" : ""} ${correct ? "correct" : ""} ${
                      wrong ? "wrong" : ""
                    }`}
                    onClick={() => onChoiceClick(i)}
                    disabled={checked}
                  >
                    {letter}. {choice}
                  </button>
                  {showChoiceExplanation ? (
                    <div className="choice-explanation">
                      {isCorrectChoice ? explanation : explanation || "—"}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          {checked && current.answerExplanation ? (
            <div className="answer-explanation">
              <h3 className="answer-explanation-title">정답 해설</h3>
              <div className="answer-explanation-body">{current.answerExplanation}</div>
            </div>
          ) : null}
          <div className="actions">
            <button type="button" onClick={checkAnswer} disabled={selected.length === 0 || checked}>
              정답 확인
            </button>
            <button type="button" onClick={nextQuestion} disabled={!checked || index + 1 >= cycle.length}>
              다음 문제
            </button>
            <button
              type="button"
              onClick={() => window.open(current.reference, "_blank", "noopener,noreferrer")}
              disabled={!current.reference}
            >
              Reference Check
            </button>
          </div>
        </section>
      )}

      {isFinished && (
        <section className="panel result">
          <h3>사이클 완료</h3>
          <p>
            맞은 개수: {correctCount} / {cycle.length}
          </p>
        </section>
      )}
    </div>
  );
}

export default App;
