# Mimikara Oboeru N3 · N2 – Frontend

React + TypeScript + Vite app with three practice tabs:

- **📖 Từ vựng N3** – multiple-choice quiz over the Mimikara Oboeru N3 vocabulary, by lesson, by unit or all words. Wrong answers come back later in the round and are saved to the *unremembered* list (localStorage) for review.
- **📗 Từ vựng N2** – the same quiz over the JLPT N2 list of [JTest.net](https://jtest.net/tu-vung-n2) (はじめての日本語能力試験 N2 単語 2500: 12 chapters × 5 lessons, 1546 words), by lesson, by chapter or all words. N2 words have their own unremembered list; the speaker, Hán Việt and Hiragana settings are shared with N3.
Both vocabulary tabs offer two study modes, and show companion words with every answer:

- **📝 Trắc nghiệm** – the quiz above.
- **🧠 Thẻ ghi nhớ** – flashcards with spaced repetition (Leitner boxes): recall the meaning, flip the card (Space), then grade yourself 1 Quên · 2 Khó · 3 Nhớ · 4 Dễ. Remembered words come back after 1 → 3 → 7 → 14 → 30 → 60 → 120 days, forgotten ones come back in the same session and go to the unremembered list. Each session takes the due reviews of the selected batch plus 20 new words. Progress is saved per deck in localStorage (`mimikara_srs_n3`, `mimikara_srs_n2`).
- **🔗 Học 1 được 2** – after answering (and on the back of a flashcard) up to two companion words are shown: the 自動詞/他動詞 pair of a verb (倒れる → 倒す), then synonyms and antonyms, each with reading, Hán Việt, meaning and speaker.

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
│   ├── ui/                 # shared pieces: OptionButton, HanVietButton, CompanionList, ResultPanel, Modal, SettingToggle, VocabTable
│   ├── vocab/              # vocabulary tab of a deck: quiz, flashcards, word hero, toolbar, progress, unremembered modal
│   └── exam/               # exam papers (sections, questions, result)
├── hooks/                  # persistent state, shared vocab settings, flashcard progress, speech, keyboard shortcuts, quiz session
├── data/                   # N3/N2 vocabulary, companions, exam and kanji Hán Việt JSON; vocabBatches builds the N3 and N2 decks
├── utils/                  # quizEngine (vocab queue), srs (spaced repetition), examEngine (papers & scoring), hanViet, gtm
└── types/
```

## Exam data

`src/data/jlpt_n3_minchan_exam.json` is generated from the Word document; regenerate it after editing the document:

```bash
pip install python-docx
python3 scripts/build_exam_data.py   # run from the repository root
```

Underlined words in the document become the `target` of each question; answers marked `*` in the answer key are flagged `inferred` and shown as reference answers.

## N2 vocabulary and companion words

The JLPT lists of jtest.net (with their "Từ liên quan": synonyms, antonyms…) are crawled into `scripts/data/jtest_<level>.json`, one request per lesson page with a pause between requests. `build_vocab_data.py` then writes:

- `src/data/jtest_n2_vocab.json` – the N2 deck. Words are numbered 1–1546 across the whole list (the site restarts at 1 in every lesson) because the unremembered list and the flashcard progress match words by number. The source has no Hán Việt, so the app derives it from the kanji (see below).
- `src/data/vocab_companions.json` – up to two companions per N3 and N2 word: the 自動詞/他動詞 pair found with [JMdict](https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project) (EDRDG, CC BY-SA 4.0) transitivity and the usual okurigana alternations (上がる/上げる, 開く/開ける, 残る/残す, 冷える/冷やす…), then synonyms and antonyms of jtest.net (Mimikara N3 words are matched to the jtest lists, N3 first) and JMdict antonyms. Every companion has a Vietnamese meaning taken from the word lists.

```bash
# run from the repository root
python3 scripts/crawl_jtest.py n2        # also n3, n4, n1: more lists give more companions to N3 words
python3 scripts/build_vocab_data.py      # downloads JMdict
python3 scripts/build_han_viet_data.py   # downloads KANJIDIC2
```

## Hán Việt buttons

Every exam word written in kanji (the underlined word and each option) has a **Hán Việt** button that shows its Sino-Vietnamese reading; in the vocabulary quiz the same button appears while Hán Việt is hidden. Readings come from the N3 vocabulary data when the word is in it, otherwise kanji by kanji from `src/data/kanji_han_viet.json`; the N2 vocabulary and the companion words get their Hán Việt the same way. Regenerate that table after changing the exam data or running `build_vocab_data.py`:

```bash
python3 scripts/build_han_viet_data.py   # run from the repository root; downloads KANJIDIC2
```

Per-kanji readings prefer the vocabulary data, then the first Vietnamese reading of [KANJIDIC2](https://www.edrdg.org/wiki/index.php/KANJIDIC_Project) (EDRDG, CC BY-SA 4.0); `OVERRIDES` in the script fixes kanji whose KANJIDIC2 reading is uncommon.
