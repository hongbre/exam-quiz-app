import { useMemo, useState } from "react";
import { parseWorkbook, pickQuestionSet, updateHistory } from "./utils/quiz";

const LS_KEY = "quiz-history-v1";

function App() {
  const [questions, setQuestions] = useState([]);
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
  const [selected, setSelected] = useState(null);
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

  async function onUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    const parsed = parseWorkbook(buffer);
    setQuestions(parsed);
    setCycle([]);
    setIndex(0);
    setSelected(null);
    setChecked(false);
    setCorrectCount(0);
  }

  function startCycle() {
    if (questions.length === 0) return;
    const selectedCycle = pickQuestionSet(questions, history, cycleSize);
    setCycle(selectedCycle);
    setIndex(0);
    setSelected(null);
    setChecked(false);
    setCorrectCount(0);
  }

  function checkAnswer() {
    if (!current || selected === null || checked) return;
    const isCorrect = selected === current.correctIndex;
    setChecked(true);
    if (isCorrect) setCorrectCount((prev) => prev + 1);

    const nextHistory = updateHistory(history, current.id, isCorrect);
    setHistory(nextHistory);
    localStorage.setItem(LS_KEY, JSON.stringify(nextHistory));
  }

  function nextQuestion() {
    if (index + 1 >= cycle.length) return;
    setIndex((prev) => prev + 1);
    setSelected(null);
    setChecked(false);
  }

  const isFinished = cycle.length > 0 && index === cycle.length - 1 && checked;

  return (
    <div className="app">
      <h1>객관식 학습 앱</h1>
      <p className="sub">미풀이 우선 + 오답률 높은 분야 우선 출제</p>

      <section className="panel">
        <label className="label">문제 엑셀 업로드 (.xlsx)</label>
        <input type="file" accept=".xlsx" onChange={onUpload} />
        <p className="hint">
          컬럼 예시: question, choice1~5, answer(정답 번호), category
        </p>
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
            <strong>{progress}</strong>
            <span className="chip">{current.category}</span>
          </div>
          <h2>{current.question}</h2>
          <div className="choices">
            {current.choices.map((choice, i) => {
              const picked = selected === i;
              const correct = checked && i === current.correctIndex;
              const wrong = checked && picked && i !== current.correctIndex;

              return (
                <button
                  key={`${current.id}-${i}`}
                  className={`choice ${picked ? "picked" : ""} ${correct ? "correct" : ""} ${
                    wrong ? "wrong" : ""
                  }`}
                  onClick={() => setSelected(i)}
                  disabled={checked}
                >
                  {i + 1}. {choice}
                </button>
              );
            })}
          </div>
          <div className="actions">
            <button onClick={checkAnswer} disabled={selected === null || checked}>
              정답 확인
            </button>
            <button onClick={nextQuestion} disabled={!checked || index + 1 >= cycle.length}>
              다음 문제
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
