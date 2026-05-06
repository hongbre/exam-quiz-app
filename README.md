# Exam Quiz App

React + Vite 기반 객관식 학습 앱입니다.

## 주요 기능

- 프로젝트 루트 `question` 디렉토리의 `.xlsx` 파일 자동 인식
- 파일명 셀렉트 박스로 문제 세트 선택
- 랜덤 사이클 출제 (사이클 문제 수 지정 가능)
- 우선순위 출제:
  - 미풀이 문제 최우선
  - 오답률 높은 분야 문제 차우선
- 정답/오답 하이라이팅
  - 정답: 녹색
  - 오답: 적색

## 파일 배치

프로젝트 루트에 `question` 디렉토리를 만들고 `.xlsx` 파일을 넣어주세요.

예시:

```text
exam-quiz-app/
  question/
    set-1.xlsx
    set-2.xlsx
```

## 엑셀 컬럼 형식

다음 컬럼명을 사용합니다.

- `No` (문제번호)
- `Question` (문제 내용)
- `Choice A` ~ `Choice E` (보기, 4개/5개 모두 지원)
- `Answer` (정답: `A~E`, `1~5`, 또는 보기 텍스트)
- `Reference` (예시 링크)

`Reference` 값이 있는 문제는 화면에서 `Reference Check` 버튼으로 링크 이동할 수 있습니다.

## 실행

```bash
npm install
npm run dev
```
