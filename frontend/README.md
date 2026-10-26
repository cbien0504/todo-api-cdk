# Mimikara Oboeru N3 · N2 – Frontend

React + TypeScript + Vite app with three practice tabs:

- **📖 Từ vựng N3** – multiple-choice quiz over the Mimikara Oboeru N3 vocabulary, by lesson, by unit or all words. Wrong answers come back later in the round and are saved to the *unremembered* list (localStorage) for review.
- **📗 Từ vựng N2** – the same quiz over the JLPT N2 list of [JTest.net](https://jtest.net/tu-vung-n2) (はじめての日本語能力試験 N2 単語 2500: 12 chapters × 5 lessons, 1546 words), by lesson, by chapter or all words. N2 words have their own unremembered list; the speaker, Hán Việt and Hiragana settings are shared with N3.
- **📝 Luyện đề N3** – 文字・語彙 exam papers built from `JLPT_N3_tu_vung_Minchan.docx` (440 questions). Questions are grouped by part like the real exam: 問題1 漢字読み, 問題2 表記, 問題3 文脈規定, 問題4 言い換え類義. Pick a random mock paper (real N3 question counts), a lesson (Bài 1–8) or a whole part, then submit to see the score per part. The options of every question are shuffled each time a paper is started or retried.

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
│   ├── ui/                 # shared pieces: OptionButton, HanVietButton, ResultPanel, Modal, SettingToggle, VocabTable
│   ├── vocab/              # vocabulary quiz for a deck (toolbar, progress, question card, unremembered modal)
│   └── exam/               # exam papers (sections, questions, result)
├── hooks/                  # persistent state, shared vocab settings, speech, keyboard shortcuts, quiz session
├── data/                   # N3/N2 vocabulary, exam and kanji Hán Việt JSON; vocabBatches builds the N3 and N2 decks
├── utils/                  # quizEngine (vocab queue), examEngine (papers & scoring), hanViet, gtm
└── types/
```

## Exam data

`src/data/jlpt_n3_minchan_exam.json` is generated from the Word document; regenerate it after editing the document:

```bash
pip install python-docx
python3 scripts/build_exam_data.py   # run from the repository root
```

Underlined words in the document become the `target` of each question; answers marked `*` in the answer key are flagged `inferred` and shown as reference answers.

## N2 vocabulary data

`src/data/jtest_n2_vocab.json` is crawled from jtest.net (one request per lesson page, with a pause between requests). The source has no Hán Việt, so the app derives it from the kanji (see below). Re-crawl, then rebuild the Hán Việt table:

```bash
python3 scripts/crawl_jtest_n2.py        # run from the repository root
python3 scripts/build_han_viet_data.py
```

Words are numbered 1–1546 across the whole list (the site restarts at 1 in every lesson) because the unremembered list matches words by number.

## Hán Việt buttons

Every exam word written in kanji (the underlined word and each option) has a **Hán Việt** button that shows its Sino-Vietnamese reading; in the vocabulary quiz the same button appears while Hán Việt is hidden. Readings come from the N3 vocabulary data when the word is in it, otherwise kanji by kanji from `src/data/kanji_han_viet.json`; the N2 vocabulary gets its Hán Việt the same way. Regenerate that table after changing the exam data or the N2 vocabulary:

```bash
python3 scripts/build_han_viet_data.py   # run from the repository root; downloads KANJIDIC2
```

Per-kanji readings prefer the vocabulary data, then the first Vietnamese reading of [KANJIDIC2](https://www.edrdg.org/wiki/index.php/KANJIDIC_Project) (EDRDG, CC BY-SA 4.0); `OVERRIDES` in the script fixes kanji whose KANJIDIC2 reading is uncommon.
