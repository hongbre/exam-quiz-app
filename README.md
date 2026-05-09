# Exam Quiz App

React + Vite 기반 객관식 학습 앱입니다.

## 주요 기능

- `src/data` 디렉토리의 `.json` 문제 세트 자동 인식
- 파일명 셀렉트 박스로 세트 선택
- 랜덤 사이클 출제 (사이클 문제 수 지정 가능)
- 우선순위 출제:
  - 미풀이 문제 최우선
  - 오답률 높은 분야(파일 단위) 우선
- 정답/오답 하이라이팅 (녹색 / 적색)
- 정답 확인 후 각 보기별 설명(`explanations`) 및 정답 해설(`answerExplanation`) 표시

## 파일 배치

`src/data` 아래에 문제 배열 JSON을 둡니다.

```text
exam-quiz-app/
  src/
    data/
      saa-c03.json
```

## JSON 스키마 (배열의 각 요소)

필드명은 **camelCase** 또는 **PascalCase** 모두 허용합니다.

- `no` / `No`: 문제 번호
- `question` / `Question`: 지문
- `choices` / `Choices`: 객체. 키 `A` ~ `F`, 값은 보기 문자열. 비어 있지 않은 키만 출제에 사용됩니다.
- `answer` / `Answer`: 단일 `A`~`F`, `1`~`6`, 보기 텍스트, 또는 복수 정답 `A,E` 형태 (해당 보기를 **모두** 선택해야 정답)
- `reference` / `Reference`: 참고 링크 (없으면 Reference Check 비활성)
- `answerExplanation` / `AnswerExplanation`: 정답 확인 후 표시할 전체 해설
- `explanations` / `Explanations`: 보기별 설명 객체 (`{ "A": "…", "B": "…", … }`). 정답 확인 후 각 보기 아래에 표시됩니다.

## 실행

```bash
npm install
npm run dev
```
