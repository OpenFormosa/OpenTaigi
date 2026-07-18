"use client";

import {
  CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Mode = "library" | "reader" | "vocabulary" | "sentences";
type Volume = "上冊" | "下冊";

type Hotspot = {
  id: string;
  label: string;
  filename: string;
  audio: string;
  available: boolean;
  kind: "audio" | "headword" | "example";
  x: number;
  y: number;
  width: number;
  height: number;
};

type BookPage = {
  number: number;
  image: string;
  width: number;
  height: number;
  hotspots: Hotspot[];
};

type Book = {
  id: string;
  number: string;
  series: string;
  title: string;
  subtitle: string;
  accent: string;
  description: string;
  pdfFile: string;
  sourcePdf: string;
  pageCount: number;
  audioCount: number;
  pages: BookPage[];
};

type Curriculum = {
  title: string;
  source: string;
  stats: {
    books: number;
    pages: number;
    hotspots: number;
    audioFiles: number;
  };
  books: Book[];
};

type Vocabulary = {
  id: string;
  bookId: string;
  volume: Volume;
  number: string;
  page: number;
  headword: string;
  romanization: string;
  meaning: string;
  examples: string;
  audioA: string;
  audioB: string;
};

type Sentence = {
  id: string;
  page: string;
  chapter: string;
  order: number;
  hanji: string;
  lomaji: string;
  huagi: string;
  audio: string;
  volume: Volume;
};

const SOURCE_ROOT =
  "https://github.com/Taiwanese-Corpus/Lan-Lai-Oh-Taigi";
const RAW_SENTENCE_ROOT =
  "https://raw.githubusercontent.com/Taiwanese-Corpus/Lan-Lai-Oh-Taigi/master/mp3/03";

const fallbackBooks = [
  ["01", "拼音", "學拼音有撇步", "21", "#8076B5"],
  ["02·上", "語詞", "學語詞真輕鬆", "25", "#877461"],
  ["02·下", "語詞", "學語詞真輕鬆", "21", "#877461"],
  ["03·上", "語句", "讀語句上簡單", "37", "#D6A622"],
  ["03·下", "語句", "讀語句上簡單", "37", "#D6A622"],
  ["04·上", "文章", "讀文章蓋趣味", "38", "#D77A3D"],
  ["04·下", "文章", "讀文章蓋趣味", "36", "#D77A3D"],
  ["附", "補充", "主管機關補充資料", "2", "#2F6B54"],
];

function parseCsvLine(line: string) {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      values.push(value);
      value = "";
    } else {
      value += character;
    }
  }
  values.push(value);
  return values;
}

function parseSentences(text: string, volume: Volume): Sentence[] {
  return text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .slice(1)
    .filter(Boolean)
    .map((line) => {
      const [page, chapter, order, hanji, lomaji, huagi, audio] =
        parseCsvLine(line);
      return {
        id: `${volume}-${audio}`,
        page,
        chapter,
        order: Number(order),
        hanji,
        lomaji,
        huagi,
        audio,
        volume,
      };
    })
    .filter((sentence) => sentence.audio && sentence.hanji);
}

function sentenceAudio(sentence: Sentence) {
  const volume = sentence.volume === "上冊" ? "01" : "02";
  return `${RAW_SENTENCE_ROOT}/${volume}/${encodeURIComponent(sentence.audio)}`;
}

function loadStringSet(key: string) {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(key) ?? "[]"));
  } catch {
    return new Set<string>();
  }
}

function chapterName(value: string) {
  return value.replace(
    /^(十一|十二|十三|十四|十五|十六|十|一|二|三|四|五|六|七|八|九)/,
    "",
  );
}

export function TaigiApp() {
  const [mode, setMode] = useState<Mode>("library");
  const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
  const [vocabulary, setVocabulary] = useState<Vocabulary[]>([]);
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [activeBookId, setActiveBookId] = useState("pronunciation");
  const [pageNumber, setPageNumber] = useState(1);
  const [activeAudio, setActiveAudio] = useState<{
    url: string;
    label: string;
  } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [bookmarks, setBookmarks] = useState<Set<string>>(() =>
    typeof window === "undefined"
      ? new Set()
      : loadStringSet("opentaigi-bookmarks"),
  );
  const [completed, setCompleted] = useState<Set<string>>(() =>
    typeof window === "undefined"
      ? new Set()
      : loadStringSet("opentaigi-completed-pages"),
  );
  const [vocabSearch, setVocabSearch] = useState("");
  const [vocabVolume, setVocabVolume] = useState<"全部" | Volume>("全部");
  const [visibleVocabulary, setVisibleVocabulary] = useState(60);
  const [revealedWords, setRevealedWords] = useState<Set<string>>(new Set());
  const [sentenceSearch, setSentenceSearch] = useState("");
  const [sentenceVolume, setSentenceVolume] =
    useState<"全部" | Volume>("全部");
  const [sentenceChapter, setSentenceChapter] = useState("全部");
  const [visibleSentences, setVisibleSentences] = useState(60);
  const [practiceSentence, setPracticeSentence] = useState<Sentence | null>(
    null,
  );
  const [showPracticeAnswer, setShowPracticeAnswer] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    Promise.all([
      fetch("./data/curriculum.json").then((response) => response.json()),
      fetch("./data/vocabulary.json").then((response) => response.json()),
      fetch("./data/3-1.csv").then((response) => response.text()),
      fetch("./data/3-2.csv").then((response) => response.text()),
    ])
      .then(([curriculumData, vocabularyData, firstVolume, secondVolume]) => {
        setCurriculum(curriculumData);
        setVocabulary(vocabularyData);
        const loadedSentences = [
          ...parseSentences(firstVolume, "上冊"),
          ...parseSentences(secondVolume, "下冊"),
        ];
        setSentences(loadedSentences);
        setPracticeSentence(loadedSentences[0] ?? null);
      })
      .catch(() => {
        // The server-rendered library remains useful if a network request fails.
      });
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  const activeBook = useMemo(
    () => curriculum?.books.find((book) => book.id === activeBookId) ?? null,
    [activeBookId, curriculum],
  );
  const activePage = activeBook?.pages[pageNumber - 1] ?? null;
  const pageKey = `${activeBookId}-${pageNumber}`;

  const playAudio = useCallback(
    (url: string, label: string) => {
      if (!url || !audioRef.current) return;
      const player = audioRef.current;
      if (activeAudio?.url !== url) player.src = url;
      player.playbackRate = speed;
      setActiveAudio({ url, label });
      player.play().catch(() => setIsPlaying(false));
    },
    [activeAudio?.url, speed],
  );

  const goToPage = useCallback(
    (nextPage: number) => {
      if (!activeBook) return;
      setPageNumber(Math.min(Math.max(nextPage, 1), activeBook.pageCount));
    },
    [activeBook],
  );

  useEffect(() => {
    if (mode !== "reader") return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;
      if (event.key === "ArrowLeft") goToPage(pageNumber - 1);
      if (event.key === "ArrowRight") goToPage(pageNumber + 1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goToPage, mode, pageNumber]);

  const openBook = (bookId: string, page = 1) => {
    setActiveBookId(bookId);
    setPageNumber(page);
    setMode("reader");
    window.setTimeout(
      () => document.querySelector("#workbench")?.scrollIntoView(),
      0,
    );
  };

  const toggleStoredSet = (
    key: string,
    value: string,
    current: Set<string>,
    setter: (next: Set<string>) => void,
  ) => {
    const next = new Set(current);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
    localStorage.setItem(key, JSON.stringify([...next]));
  };

  const filteredVocabulary = useMemo(() => {
    const query = vocabSearch.trim().toLocaleLowerCase();
    return vocabulary.filter((entry) => {
      const volumeMatches =
        vocabVolume === "全部" || entry.volume === vocabVolume;
      const textMatches =
        !query ||
        `${entry.headword} ${entry.romanization} ${entry.meaning} ${entry.examples}`
          .toLocaleLowerCase()
          .includes(query);
      return volumeMatches && textMatches;
    });
  }, [vocabSearch, vocabVolume, vocabulary]);

  const chapters = useMemo(
    () => Array.from(new Set(sentences.map((item) => item.chapter))),
    [sentences],
  );

  const filteredSentences = useMemo(() => {
    const query = sentenceSearch.trim().toLocaleLowerCase();
    return sentences.filter((sentence) => {
      const volumeMatches =
        sentenceVolume === "全部" || sentence.volume === sentenceVolume;
      const chapterMatches =
        sentenceChapter === "全部" || sentence.chapter === sentenceChapter;
      const textMatches =
        !query ||
        `${sentence.hanji} ${sentence.lomaji} ${sentence.huagi}`
          .toLocaleLowerCase()
          .includes(query);
      return volumeMatches && chapterMatches && textMatches;
    });
  }, [
    sentenceChapter,
    sentenceSearch,
    sentenceVolume,
    sentences,
  ]);

  const randomPractice = () => {
    if (!filteredSentences.length) return;
    setPracticeSentence(
      filteredSentences[Math.floor(Math.random() * filteredSentences.length)],
    );
    setShowPracticeAnswer(false);
  };

  const navItems: { id: Mode; label: string; index: string }[] = [
    { id: "library", label: "教材書架", index: "壹" },
    { id: "reader", label: "原頁精讀", index: "貳" },
    { id: "vocabulary", label: "語詞卡", index: "參" },
    { id: "sentences", label: "840 句", index: "肆" },
  ];

  return (
    <main className="site-shell">
      <header className="masthead">
        <a className="brand" href="#top" aria-label="回到頁首">
          <span className="brand-seal">台</span>
          <span>
            <strong>咱來學台語</strong>
            <small>Lán lâi o̍h Tâi-gí</small>
          </span>
        </a>
        <nav className="mast-nav" aria-label="主要導覽">
          <a href="#library">教材</a>
          <a href="#workbench">練習桌</a>
          <a href="#about">關於</a>
        </nav>
        <button
          className="mast-start"
          onClick={() => openBook("pronunciation")}
        >
          開始點讀
        </button>
      </header>

      <section className="hero page-width" id="top">
        <div className="hero-copy">
          <p className="kicker">教育部《咱來學臺灣閩南語》完整互動版</p>
          <h1>
            一頁一頁，
            <br />
            <em>講出台語。</em>
          </h1>
          <p className="hero-lead">
            不是 PDF 下載站。八冊教材的 217 個原始跨頁，全數變成能直接點讀的課本；
            再把語詞、840 句生活台語整理成可搜尋、可複習的練習。
          </p>
          <div className="hero-actions">
            <button onClick={() => openBook("pronunciation")}>
              翻開第一冊 <span aria-hidden="true">↗</span>
            </button>
            <button
              className="text-button"
              onClick={() => {
                setMode("sentences");
                document.querySelector("#workbench")?.scrollIntoView();
              }}
            >
              先聽「多謝你」
            </button>
          </div>
        </div>

        <div className="hero-poster" aria-label="教材摘要">
          <span className="poster-flower" aria-hidden="true">✿</span>
          <p>今仔日來講</p>
          <strong>多謝你！</strong>
          <i>To-siā--lí!</i>
          <button
            aria-label="播放多謝你"
            onClick={() =>
              playAudio(
                `${RAW_SENTENCE_ROOT}/01/0301_01_01_03.mp3`,
                "多謝你！",
              )
            }
          >
            <span aria-hidden="true">▶</span> 聽發音
          </button>
        </div>

        <div className="hero-stats" aria-label="教材統計">
          <div><strong>8</strong><span>冊完整教材</span></div>
          <div><strong>217</strong><span>個原始跨頁</span></div>
          <div><strong>4,349</strong><span>段真人發音</span></div>
          <div><strong>840</strong><span>句生活台語</span></div>
        </div>
      </section>

      <section className="library-section" id="library">
        <div className="page-width">
          <div className="section-heading">
            <div>
              <p className="folio">THE COMPLETE EDITION · 2014</p>
              <h2>八冊，攏佇遮。</h2>
            </div>
            <p>
              每一列就是一本可互動的課本。保留原版字型、插圖與編排，
              點藍字的所在就會播放對應音檔。
            </p>
          </div>

          <div className="book-index">
            {(curriculum?.books ?? []).length > 0
              ? curriculum?.books.map((book) => (
                  <button
                    key={book.id}
                    className="book-row"
                    onClick={() => openBook(book.id)}
                    style={{ "--book-accent": book.accent } as CSSProperties}
                  >
                    <span className="book-number">{book.number}</span>
                    <span className="book-kind">{book.series}</span>
                    <span className="book-title">
                      <strong>{book.title}</strong>
                      <small>{book.description}</small>
                    </span>
                    <span className="book-meta">
                      {book.pageCount} 頁
                      {book.audioCount > 0 && ` · ${book.audioCount} 音檔`}
                    </span>
                    <span className="book-arrow" aria-hidden="true">↗</span>
                  </button>
                ))
              : fallbackBooks.map(([number, kind, title, pages, accent]) => (
                  <div
                    className="book-row book-row-loading"
                    key={`${number}-${kind}`}
                    style={{ "--book-accent": accent } as CSSProperties}
                  >
                    <span className="book-number">{number}</span>
                    <span className="book-kind">{kind}</span>
                    <span className="book-title"><strong>{title}</strong></span>
                    <span className="book-meta">{pages} 頁</span>
                  </div>
                ))}
          </div>
        </div>
      </section>

      <section className="workbench" id="workbench">
        <div className="mode-strip page-width" role="tablist" aria-label="學習模式">
          {navItems.map((item) => (
            <button
              key={item.id}
              role="tab"
              aria-selected={mode === item.id}
              className={mode === item.id ? "active" : ""}
              onClick={() => setMode(item.id)}
            >
              <span>{item.index}</span>
              {item.label}
            </button>
          ))}
        </div>

        {mode === "library" && (
          <div className="mode-intro page-width">
            <p className="folio">HOW TO USE</p>
            <h2>原書的所在，就是互動的所在。</h2>
            <div className="method-lines">
              <article>
                <span>01</span>
                <h3>揀一冊</h3>
                <p>照拼音、語詞、語句、文章的順序讀，抑是直接揀欲學的冊。</p>
              </article>
              <article>
                <span>02</span>
                <h3>點藍字</h3>
                <p>頁面上的橘色小點標出原 PDF 發音區；按一下就聽真人錄音。</p>
              </article>
              <article>
                <span>03</span>
                <h3>留進度</h3>
                <p>收藏頁面、標記讀完。紀錄留在這台裝置，下擺閣來接續。</p>
              </article>
            </div>
            <button className="ink-button" onClick={() => openBook("pronunciation")}>
              對拼音開始
            </button>
          </div>
        )}

        {mode === "reader" && (
          <div className="reader-layout page-width">
            <aside className="reader-rail">
              <div className="rail-label">
                <span>原頁精讀</span>
                <small>ORIGINAL READER</small>
              </div>
              <div className="rail-books" aria-label="選擇課本">
                {curriculum?.books.map((book) => (
                  <button
                    key={book.id}
                    className={activeBookId === book.id ? "active" : ""}
                    onClick={() => {
                      setActiveBookId(book.id);
                      setPageNumber(1);
                    }}
                    style={{ "--book-accent": book.accent } as CSSProperties}
                  >
                    <span>{book.number}</span>
                    {book.series}
                  </button>
                ))}
              </div>
              {activeBook && (
                <div className="rail-progress">
                  <span>這冊進度</span>
                  <strong>
                    {
                      [...completed].filter((key) =>
                        key.startsWith(`${activeBook.id}-`),
                      ).length
                    }
                    <small> / {activeBook.pageCount}</small>
                  </strong>
                  <div>
                    <i
                      style={{
                        width: `${
                          ([...completed].filter((key) =>
                            key.startsWith(`${activeBook.id}-`),
                          ).length /
                            activeBook.pageCount) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </aside>

            <div className="reader-main">
              {activeBook && activePage ? (
                <>
                  <header className="reader-heading">
                    <div>
                      <p>{activeBook.number} · {activeBook.series}</p>
                      <h2>{activeBook.title}</h2>
                    </div>
                    <div className="reader-actions">
                      <button
                        className={bookmarks.has(pageKey) ? "marked" : ""}
                        onClick={() =>
                          toggleStoredSet(
                            "opentaigi-bookmarks",
                            pageKey,
                            bookmarks,
                            setBookmarks,
                          )
                        }
                      >
                        {bookmarks.has(pageKey) ? "★ 已收藏" : "☆ 收藏這頁"}
                      </button>
                      <a
                        href={activeBook.sourcePdf}
                        target="_blank"
                        rel="noreferrer"
                      >
                        原始 PDF ↗
                      </a>
                    </div>
                  </header>

                  <div
                    className="reader-page-canvas"
                    style={{
                      aspectRatio: `${activePage.width} / ${activePage.height}`,
                    }}
                  >
                    {/* The source spread is the primary teaching visual. */}
                    {/* The pages are pre-optimized WebP and use dynamic source data. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={activePage.image}
                      alt={`${activeBook.title}第 ${activePage.number} 頁`}
                    />
                    {activePage.hotspots.map((hotspot, index) => (
                      <button
                        key={hotspot.id}
                        className={`audio-hotspot ${hotspot.kind} ${
                          activeAudio?.url === hotspot.audio ? "playing" : ""
                        }`}
                        style={{
                          left: `${hotspot.x}%`,
                          top: `${hotspot.y}%`,
                          width: `${hotspot.width}%`,
                          height: `${hotspot.height}%`,
                          "--hotspot-delay": `${Math.min(index * 18, 360)}ms`,
                        } as CSSProperties}
                        aria-label={`播放：${hotspot.label}`}
                        title={hotspot.label}
                        disabled={!hotspot.available}
                        onClick={() =>
                          playAudio(hotspot.audio, hotspot.label)
                        }
                      >
                        <span aria-hidden="true">▶</span>
                      </button>
                    ))}
                  </div>

                  <div className="page-controls">
                    <button
                      onClick={() => goToPage(pageNumber - 1)}
                      disabled={pageNumber === 1}
                      aria-label="上一頁"
                    >
                      ← <span>上一頁</span>
                    </button>
                    <label>
                      <span>PAGE</span>
                      <select
                        value={pageNumber}
                        onChange={(event) =>
                          goToPage(Number(event.target.value))
                        }
                        aria-label="前往頁面"
                      >
                        {activeBook.pages.map((page) => (
                          <option key={page.number} value={page.number}>
                            {page.number} / {activeBook.pageCount}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      onClick={() => goToPage(pageNumber + 1)}
                      disabled={pageNumber === activeBook.pageCount}
                      aria-label="下一頁"
                    >
                      <span>下一頁</span> →
                    </button>
                  </div>

                  <div className="reader-note">
                    <p>
                      <span className="hotspot-key">▶</span>
                      頁上的橘點都是原書發音位置，共 {activePage.hotspots.length} 處。
                      電腦也可用左右方向鍵翻頁。
                    </p>
                    <button
                      className={completed.has(pageKey) ? "done" : ""}
                      onClick={() =>
                        toggleStoredSet(
                          "opentaigi-completed-pages",
                          pageKey,
                          completed,
                          setCompleted,
                        )
                      }
                    >
                      {completed.has(pageKey) ? "✓ 這頁讀過矣" : "標記這頁讀完"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="reader-loading">咧整理冊頁，請稍等一下⋯</div>
              )}
            </div>
          </div>
        )}

        {mode === "vocabulary" && (
          <div className="study-mode page-width">
            <div className="study-heading">
              <div>
                <p className="folio">VOCABULARY · BOOK 02</p>
                <h2>語詞，逐條斟酌聽。</h2>
              </div>
              <p>
                A 音檔讀詞頭，B 音檔讀例詞。先看台文與羅馬字，
                再揭開華語意思。
              </p>
            </div>
            <div className="filter-line">
              <label className="search-field">
                <span>揣語詞</span>
                <input
                  value={vocabSearch}
                  onChange={(event) => {
                    setVocabSearch(event.target.value);
                    setVisibleVocabulary(60);
                  }}
                  placeholder="台文、羅馬字、華語⋯"
                />
              </label>
              <div className="segmented" aria-label="語詞冊別">
                {(["全部", "上冊", "下冊"] as const).map((item) => (
                  <button
                    key={item}
                    className={vocabVolume === item ? "active" : ""}
                    onClick={() => setVocabVolume(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <strong>{filteredVocabulary.length}<small> 詞</small></strong>
            </div>

            <div className="word-list">
              {filteredVocabulary.slice(0, visibleVocabulary).map((entry) => {
                const revealed = revealedWords.has(entry.id);
                return (
                  <article className="word-row" key={entry.id}>
                    <button
                      className="word-main"
                      onClick={() => playAudio(entry.audioA, entry.headword)}
                      aria-label={`播放${entry.headword}`}
                    >
                      <span>{entry.volume === "上冊" ? "上" : "下"} · {entry.number}</span>
                      <strong>{entry.headword}</strong>
                      <i>{entry.romanization || "—"}</i>
                      <b aria-hidden="true">▶</b>
                    </button>
                    <div className={`word-answer ${revealed ? "revealed" : ""}`}>
                      <button
                        onClick={() => {
                          const next = new Set(revealedWords);
                          if (revealed) next.delete(entry.id);
                          else next.add(entry.id);
                          setRevealedWords(next);
                        }}
                      >
                        {revealed ? "收起解說" : "揭開華語"}
                      </button>
                      <div>
                        <strong>{entry.meaning || "請看原頁解說"}</strong>
                        {entry.examples && <p>{entry.examples}</p>}
                      </div>
                      {entry.audioB && (
                        <button
                          className="example-play"
                          onClick={() =>
                            playAudio(
                              entry.audioB,
                              `${entry.headword}的例詞`,
                            )
                          }
                        >
                          ▶ 例詞
                        </button>
                      )}
                      <button
                        className="page-jump"
                        onClick={() => openBook(entry.bookId, entry.page)}
                      >
                        原書 p.{entry.page} ↗
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
            {visibleVocabulary < filteredVocabulary.length && (
              <button
                className="load-more"
                onClick={() => setVisibleVocabulary((count) => count + 60)}
              >
                閣看 60 詞
              </button>
            )}
          </div>
        )}

        {mode === "sentences" && (
          <div className="study-mode page-width">
            <div className="study-heading sentence-heading">
              <div>
                <p className="folio">840 SENTENCES · BOOK 03</p>
                <h2>一句一句，講出台語。</h2>
              </div>
              <div className="practice-slip">
                <small>隨堂小練習</small>
                <strong>{practiceSentence?.hanji ?? "多謝你！"}</strong>
                <i>
                  {showPracticeAnswer
                    ? practiceSentence?.lomaji
                    : "先聽，試看家己講"}
                </i>
                <div>
                  <button
                    onClick={() =>
                      practiceSentence &&
                      playAudio(
                        sentenceAudio(practiceSentence),
                        practiceSentence.hanji,
                      )
                    }
                  >
                    ▶ 聽
                  </button>
                  <button onClick={() => setShowPracticeAnswer((show) => !show)}>
                    {showPracticeAnswer ? "收起" : "看答案"}
                  </button>
                  <button onClick={randomPractice}>換一句</button>
                </div>
              </div>
            </div>

            <div className="filter-line sentence-filters">
              <label className="search-field">
                <span>生活語句，隨時揣</span>
                <input
                  value={sentenceSearch}
                  onChange={(event) => {
                    setSentenceSearch(event.target.value);
                    setVisibleSentences(60);
                  }}
                  placeholder="例如：食飯、明仔載、車頭⋯"
                />
              </label>
              <select
                value={sentenceVolume}
                onChange={(event) =>
                  setSentenceVolume(event.target.value as "全部" | Volume)
                }
                aria-label="選擇冊別"
              >
                <option>全部</option>
                <option>上冊</option>
                <option>下冊</option>
              </select>
              <select
                value={sentenceChapter}
                onChange={(event) => setSentenceChapter(event.target.value)}
                aria-label="選擇主題"
              >
                <option>全部</option>
                {chapters.map((item) => (
                  <option key={item} value={item}>
                    {chapterName(item)}
                  </option>
                ))}
              </select>
              <strong>{filteredSentences.length}<small> 句</small></strong>
            </div>

            <div className="sentence-list">
              {filteredSentences.slice(0, visibleSentences).map((sentence) => (
                <article className="sentence-row" key={sentence.id}>
                  <span className="sentence-number">
                    {sentence.volume === "上冊" ? "上" : "下"} ·{" "}
                    {String(sentence.order).padStart(2, "0")}
                  </span>
                  <div>
                    <strong>{sentence.hanji}</strong>
                    <i>{sentence.lomaji}</i>
                    <small>{sentence.huagi}</small>
                  </div>
                  <span className="chapter-tag">
                    {chapterName(sentence.chapter)}
                  </span>
                  <button
                    onClick={() =>
                      playAudio(sentenceAudio(sentence), sentence.hanji)
                    }
                    aria-label={`播放${sentence.hanji}`}
                  >
                    ▶
                  </button>
                </article>
              ))}
            </div>
            {visibleSentences < filteredSentences.length && (
              <button
                className="load-more"
                onClick={() => setVisibleSentences((count) => count + 60)}
              >
                閣看 60 句
              </button>
            )}
          </div>
        )}
      </section>

      <section className="source-note" id="about">
        <div className="page-width">
          <span className="source-seal">台</span>
          <div>
            <p className="folio">OPEN MATERIALS, CAREFUL EDITION</p>
            <h2>原教材無改，學習方式變好用。</h2>
            <p>
              本站保留原始教材每一頁，發音熱點依 PDF 內嵌座標重建；
              音檔直接取自 Taiwanese-Corpus 的公開典藏。內容若有差異，
              以原始教材為準。
            </p>
          </div>
          <a href={SOURCE_ROOT} target="_blank" rel="noreferrer">
            看 GitHub 原始資料 ↗
          </a>
        </div>
      </section>

      <footer className="page-width">
        <div>
          <strong>咱來學台語</strong>
          <span>Lán lâi o̍h Tâi-gí</span>
        </div>
        <p>八冊 · 217 跨頁 · 4,349 真人發音 · 840 生活語句</p>
        <a href="#top">轉去頂懸 ↑</a>
      </footer>

      <div className={`audio-dock ${activeAudio ? "visible" : ""}`}>
        <button
          className="dock-play"
          onClick={() => {
            const player = audioRef.current;
            if (!player || !activeAudio) return;
            if (player.paused) player.play();
            else player.pause();
          }}
          aria-label={isPlaying ? "暫停" : "播放"}
        >
          {isPlaying ? "Ⅱ" : "▶"}
        </button>
        <div>
          <small>NOW PLAYING</small>
          <strong>{activeAudio?.label ?? "揀一段來聽"}</strong>
        </div>
        <label>
          速度
          <select
            value={speed}
            onChange={(event) => setSpeed(Number(event.target.value))}
          >
            <option value={0.75}>0.75×</option>
            <option value={1}>1×</option>
            <option value={1.25}>1.25×</option>
          </select>
        </label>
        <audio
          ref={audioRef}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
        />
      </div>
    </main>
  );
}
