# Mimikara Oboeru N3 – Frontend

React + TypeScript + Vite app with two practice modes:

- **📖 Học từ vựng** – multiple-choice quiz over the Mimikara Oboeru N3 vocabulary, by lesson, by unit or all words. Wrong answers come back later in the round and are saved to the *unremembered* list (localStorage) for review.
- **📝 Luyện đề JLPT** – 文字・語彙 exam papers built from `JLPT_N3_tu_vung_Minchan.docx` (440 questions). Questions are grouped by part like the real exam: 問題1 漢字読み, 問題2 表記, 問題3 文脈規定, 問題4 言い換え類義. Pick a random mock paper (real N3 question counts), a lesson (Bài 1–8) or a whole part, then submit to see the score per part.

## Scripts

```bash
npm run dev     # start Vite dev server
npm run test    # run Vitest suite
npm run lint    # run Oxlint
npm run build   # type-check and build to dist/
```

## Structure

```text
src/
├── App.tsx                 # header, theme and tabs
├── components/
│   ├── ui/                 # shared pieces: OptionButton, ResultPanel, Modal, SettingToggle, VocabTable
│   ├── vocab/              # vocabulary quiz (toolbar, progress, question card, unremembered modal)
│   └── exam/               # exam papers (sections, questions, result)
├── hooks/                  # persistent state, speech, keyboard shortcuts, quiz session
├── data/                   # vocabulary + exam JSON and batch definitions
├── utils/                  # quizEngine (vocab queue), examEngine (papers & scoring), gtm
└── types/
```

## Exam data

`src/data/jlpt_n3_minchan_exam.json` is generated from the Word document; regenerate it after editing the document:

```bash
pip install python-docx
python3 scripts/build_exam_data.py   # run from the repository root
```

Underlined words in the document become the `target` of each question; answers marked `*` in the answer key are flagged `inferred` and shown as reference answers.
