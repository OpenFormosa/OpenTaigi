"use client";

import {
  CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Mode = "reader" | "vocabulary" | "sentences";
type ReaderView = "reading" | "layout";
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

type HtmlLine = {
  text: string;
  x: number;
  y: number;
  width: number;
  size: number;
  role: "meta" | "title" | "heading" | "note" | "body";
  column: "left" | "right";
};

type HtmlBlock = {
  role: HtmlLine["role"];
  text: string;
  y: number;
};

type HtmlPage = {
  number: number;
  width: number;
  height: number;
  lines: HtmlLine[];
  columns: Array<{
    side: "left" | "right";
    blocks: HtmlBlock[];
  }>;
  text: string;
};

type HtmlBook = {
  id: string;
  number: string;
  series: string;
  title: string;
  pages: HtmlPage[];
};

type HtmlCurriculum = {
  format: string;
  stats: {
    books: number;
    pages: number;
    searchablePages: number;
    lines: number;
    characters: number;
    vocabularyEntries: number;
  };
  books: HtmlBook[];
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

type LastPlace = {
  bookId: string;
  page: number;
};

const SOURCE_ROOT =
  "https://github.com/Taiwanese-Corpus/Lan-Lai-Oh-Taigi";
const OPENFORMOSA_ROOT = "https://openformosa.com";
const RAW_SENTENCE_ROOT =
  "https://raw.githubusercontent.com/Taiwanese-Corpus/Lan-Lai-Oh-Taigi/master/mp3/03";

const fallbackBooks = [
  ["01", "拼音", "學拼音有撇步", "21", "#154f83"],
  ["02·上", "語詞", "學語詞真輕鬆", "25", "#0b6b50"],
  ["02·下", "語詞", "學語詞真輕鬆", "21", "#0b6b50"],
  ["03·上", "語句", "讀語句上簡單", "37", "#c99022"],
  ["03·下", "語句", "讀語句上簡單", "37", "#c99022"],
  ["04·上", "文章", "讀文章蓋趣味", "38", "#c64332"],
  ["04·下", "文章", "讀文章蓋趣味", "36", "#c64332"],
  ["附", "補充", "主管機關補充資料", "2", "#17120d"],
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

function chapterName(value: string) {
  return value.replace(
    /^(十一|十二|十三|十四|十五|十六|十|一|二|三|四|五|六|七|八|九)/,
    "",
  );
}

function loadStringSet(key: string) {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(key) ?? "[]"));
  } catch {
    return new Set<string>();
  }
}

function loadLastPlace(): LastPlace | null {
  try {
    const value = JSON.parse(
      localStorage.getItem("opentaigi-last-place") ?? "null",
    );
    if (
      value &&
      typeof value.bookId === "string" &&
      Number.isInteger(value.page)
    ) {
      return value;
    }
  } catch {
    // A broken local preference must not block the textbook.
  }
  return null;
}

function escapeExpression(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function Highlight({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  const normalized = query.trim();
  if (!normalized) return text;
  const expression = new RegExp(`(${escapeExpression(normalized)})`, "gi");
  return text.split(expression).map((part, index) =>
    part.toLocaleLowerCase().includes(normalized.toLocaleLowerCase()) ? (
      <mark key={`${part}-${index}`}>{part}</mark>
    ) : (
      part
    ),
  );
}

function RenderBlock({
  block,
  query,
}: {
  block: HtmlBlock;
  query: string;
}) {
  const content = <Highlight text={block.text} query={query} />;
  if (block.role === "title") return <h3>{content}</h3>;
  if (block.role === "heading") return <h4>{content}</h4>;
  if (block.role === "note") return <aside>{content}</aside>;
  return <p>{content}</p>;
}

function closestLine(page: HtmlPage | null, hotspot: Hotspot) {
  if (!page?.lines.length) return hotspot.label;
  const match = page.lines.reduce<{ line: HtmlLine; distance: number } | null>(
    (best, line) => {
      const distance =
        Math.abs(line.y - hotspot.y) * 1.35 +
        Math.abs(line.x - hotspot.x) * 0.25;
      return !best || distance < best.distance ? { line, distance } : best;
    },
    null,
  );
  const text = match?.line.text.trim() || hotspot.label;
  return text.length > 38 ? `${text.slice(0, 38)}…` : text;
}

export function TaigiApp() {
  const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
  const [htmlCurriculum, setHtmlCurriculum] =
    useState<HtmlCurriculum | null>(null);
  const [vocabulary, setVocabulary] = useState<Vocabulary[]>([]);
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [mode, setMode] = useState<Mode>("reader");
  const [readerView, setReaderView] = useState<ReaderView>("reading");
  const [activeBookId, setActiveBookId] = useState("pronunciation");
  const [pageNumber, setPageNumber] = useState(2);
  const [readerQuery, setReaderQuery] = useState("");
  const [fontScale, setFontScale] = useState(1);
  const [showAudio, setShowAudio] = useState(true);
  const [lastPlace, setLastPlace] = useState<LastPlace | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(() =>
    typeof window === "undefined"
      ? new Set()
      : loadStringSet("opentaigi-completed-pages"),
  );
  const [activeAudio, setActiveAudio] = useState<{
    url: string;
    label: string;
  } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [audioTime, setAudioTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [vocabSearch, setVocabSearch] = useState("");
  const [vocabVolume, setVocabVolume] =
    useState<"全部" | Volume>("全部");
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
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    Promise.all([
      fetch("./data/curriculum.json").then((response) => response.json()),
      fetch("./data/html-curriculum.json").then((response) => response.json()),
      fetch("./data/vocabulary.json").then((response) => response.json()),
      fetch("./data/3-1.csv").then((response) => response.text()),
      fetch("./data/3-2.csv").then((response) => response.text()),
    ])
      .then(
        ([
          curriculumData,
          htmlData,
          vocabularyData,
          firstVolume,
          secondVolume,
        ]) => {
          setCurriculum(curriculumData);
          setHtmlCurriculum(htmlData);
          setVocabulary(vocabularyData);
          const loadedSentences = [
            ...parseSentences(firstVolume, "上冊"),
            ...parseSentences(secondVolume, "下冊"),
          ];
          setSentences(loadedSentences);
          setPracticeSentence(loadedSentences[0] ?? null);
          setLastPlace(loadLastPlace());
        },
      )
      .catch(() => {
        // Static overview content remains available if data cannot be loaded.
      });
  }, []);

  useEffect(() => {
    const saved =
      typeof window === "undefined"
        ? null
        : localStorage.getItem("opentaigi-theme");
    const nextTheme = saved === "dark" ? "dark" : "light";
    const frame = window.requestAnimationFrame(() => {
      setTheme(nextTheme);
      document.documentElement.dataset.theme = nextTheme;
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  const activeBook = useMemo(
    () => curriculum?.books.find((book) => book.id === activeBookId) ?? null,
    [activeBookId, curriculum],
  );
  const activeHtmlBook = useMemo(
    () =>
      htmlCurriculum?.books.find((book) => book.id === activeBookId) ?? null,
    [activeBookId, htmlCurriculum],
  );
  const activePage = activeBook?.pages[pageNumber - 1] ?? null;
  const activeHtmlPage = activeHtmlBook?.pages[pageNumber - 1] ?? null;
  const pageKey = `${activeBookId}-${pageNumber}`;

  const sentencePageGroups = useMemo(() => {
    if (!activeBookId.startsWith("sentences-")) return [];
    const volume: Volume = activeBookId.endsWith("-1") ? "上冊" : "下冊";
    const logicalPages =
      pageNumber === 3
        ? [3]
        : pageNumber >= 4
          ? [pageNumber * 2 - 4, pageNumber * 2 - 3]
          : [];
    return logicalPages.map((logicalPage) => ({
      logicalPage,
      sentences: sentences.filter(
        (sentence) =>
          sentence.volume === volume &&
          Number(sentence.page) === logicalPage,
      ),
    }));
  }, [activeBookId, pageNumber, sentences]);

  const matchingPages = useMemo(() => {
    const query = readerQuery.trim().toLocaleLowerCase();
    if (!query || !activeHtmlBook) return [];
    return activeHtmlBook.pages.filter((page) =>
      page.text.toLocaleLowerCase().includes(query),
    );
  }, [activeHtmlBook, readerQuery]);

  const filteredVocabulary = useMemo(() => {
    const query = vocabSearch.trim().toLocaleLowerCase();
    return vocabulary.filter((entry) => {
      if (vocabVolume !== "全部" && entry.volume !== vocabVolume) return false;
      if (!query) return true;
      return [
        entry.headword,
        entry.romanization,
        entry.meaning,
        entry.examples,
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query);
    });
  }, [vocabSearch, vocabVolume, vocabulary]);

  const chapters = useMemo(
    () =>
      Array.from(new Set(sentences.map((sentence) => sentence.chapter))).filter(
        Boolean,
      ),
    [sentences],
  );

  const filteredSentences = useMemo(() => {
    const query = sentenceSearch.trim().toLocaleLowerCase();
    return sentences.filter((sentence) => {
      if (
        sentenceVolume !== "全部" &&
        sentence.volume !== sentenceVolume
      ) {
        return false;
      }
      if (
        sentenceChapter !== "全部" &&
        sentence.chapter !== sentenceChapter
      ) {
        return false;
      }
      if (!query) return true;
      return [sentence.hanji, sentence.lomaji, sentence.huagi]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query);
    });
  }, [sentenceChapter, sentenceSearch, sentenceVolume, sentences]);

  const playAudio = useCallback(
    (url: string, label: string) => {
      if (!url || !audioRef.current) return;
      const player = audioRef.current;
      if (activeAudio?.url === url && !player.paused) {
        player.pause();
        return;
      }
      if (activeAudio?.url !== url) {
        player.src = url;
        setAudioTime(0);
        setAudioDuration(0);
      }
      player.playbackRate = speed;
      setActiveAudio({ url, label });
      player.play().catch(() => setIsPlaying(false));
    },
    [activeAudio?.url, speed],
  );

  const rememberPlace = useCallback((bookId: string, page: number) => {
    const place = { bookId, page };
    setLastPlace(place);
    localStorage.setItem("opentaigi-last-place", JSON.stringify(place));
  }, []);

  const goToPage = useCallback(
    (nextPage: number) => {
      if (!activeBook) return;
      const safePage = Math.min(
        Math.max(nextPage, 1),
        activeBook.pageCount,
      );
      setPageNumber(safePage);
      rememberPlace(activeBook.id, safePage);
    },
    [activeBook, rememberPlace],
  );

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;
      if (mode !== "reader") return;
      if (event.key === "ArrowLeft") goToPage(pageNumber - 1);
      if (event.key === "ArrowRight") goToPage(pageNumber + 1);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goToPage, mode, pageNumber]);

  const openBook = (bookId: string, page = 2) => {
    setActiveBookId(bookId);
    setPageNumber(page);
    setMode("reader");
    rememberPlace(bookId, page);
    window.setTimeout(
      () => document.querySelector("#learn")?.scrollIntoView(),
      0,
    );
  };

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    window.setTimeout(
      () => document.querySelector("#learn")?.scrollIntoView(),
      0,
    );
  };

  const toggleCompleted = () => {
    const next = new Set(completed);
    if (next.has(pageKey)) next.delete(pageKey);
    else next.add(pageKey);
    setCompleted(next);
    localStorage.setItem(
      "opentaigi-completed-pages",
      JSON.stringify([...next]),
    );
  };

  const randomPractice = () => {
    const source = filteredSentences.length ? filteredSentences : sentences;
    if (!source.length) return;
    const next = source[Math.floor(Math.random() * source.length)];
    setPracticeSentence(next);
    setShowPracticeAnswer(false);
  };

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem("opentaigi-theme", nextTheme);
  };

  const navigateLastPlace = () => {
    if (lastPlace) openBook(lastPlace.bookId, lastPlace.page);
    else openBook("pronunciation", 2);
  };

  const completeCount = activeBook
    ? [...completed].filter((key) => key.startsWith(`${activeBook.id}-`)).length
    : 0;

  return (
    <div className="site-shell" id="top">
      <header className="site-header">
        <div className="nav-wrap">
          <a className="brand" href="#top" aria-label="回到首頁">
            <span className="brand-mark">台</span>
            <span className="brand-copy">
              <strong>咱來學台語</strong>
              <small>OPENFORMOSA LEARNING EDITION</small>
            </span>
          </a>
          <nav className="site-nav" aria-label="主要導覽">
            <a href="#books">教材</a>
            <button onClick={() => switchMode("vocabulary")}>語詞</button>
            <button onClick={() => switchMode("sentences")}>語句</button>
            <a href="#about">關於</a>
          </nav>
          <div className="nav-actions">
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={theme === "light" ? "切換深色模式" : "切換淺色模式"}
            >
              {theme === "light" ? "◐" : "◑"}
            </button>
            <button className="nav-cta" onClick={navigateLastPlace}>
              {lastPlace ? "繼續讀" : "開始學"}
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="hero section-pad">
          <div className="hero-copy">
            <p className="eyebrow">台灣語言教材的完整 HTML 版本</p>
            <h1>
              <span>毋免縮放 PDF，</span>
              <span>直接讀、聽、</span>
              <span>練台語。</span>
            </h1>
            <p className="lede">
              《咱來學臺灣閩南語》八冊內容已轉為真正的網頁文字。
              可以搜尋、選取、調字級、手機重排，也保留 4,349 段真人發音。
            </p>
          </div>

          <aside className="release-board" aria-label="HTML 版本狀態">
            <header>
              <span>OPEN TEXTBOOK / 01</span>
              <b>HTML</b>
            </header>
            <div className="release-title">
              <p>完整轉換狀態</p>
              <strong>217 / 217</strong>
              <span>PDF 頁面已網頁化</span>
            </div>
            <dl>
              <div>
                <dt>可搜尋文字</dt>
                <dd>182,475 字</dd>
              </div>
              <div>
                <dt>HTML 文字行</dt>
                <dd>12,189 行</dd>
              </div>
              <div>
                <dt>真人錄音</dt>
                <dd>4,349 段</dd>
              </div>
            </dl>
            <div className="release-status">
              <i />
              <span>資料與介面已連線</span>
            </div>
          </aside>

          <div className="hero-choices">
            <button onClick={() => openBook("pronunciation", 2)}>
              <span>01</span>
              <strong>讀全文</strong>
              <p>八冊逐頁 HTML 閱讀，保留原版版面定位。</p>
              <em>開啟閱讀器 ↗</em>
            </button>
            <button onClick={() => switchMode("vocabulary")}>
              <span>02</span>
              <strong>練語詞</strong>
              <p>852 詞，查台文、台羅、華語與例詞。</p>
              <em>開始查詞 ↗</em>
            </button>
            <button onClick={() => switchMode("sentences")}>
              <span>03</span>
              <strong>聽語句</strong>
              <p>840 句生活台語，依十六類主題練習。</p>
              <em>開始聽講 ↗</em>
            </button>
          </div>
        </section>

        <section className="route-section" id="books">
          <div className="section-pad">
            <header className="section-head">
              <div>
                <p className="eyebrow">四階段學習路線</p>
                <h2>聲、詞、句、文，逐步來。</h2>
              </div>
              <p>
                每一冊都能用「閱讀模式」重新排版，也能切回
                「原版模式」查看 PDF 的文字位置。兩種模式都是真正的 HTML。
              </p>
            </header>

            <div className="route-grid">
              {[
                ["01", "學聲音", "拼音", "聲母、韻母、聲調與變調", "#154f83"],
                ["02", "認語詞", "語詞", "852 個常用詞與真人例詞", "#0b6b50"],
                ["03", "講語句", "語句", "840 句生活台語與十六主題", "#c99022"],
                ["04", "讀文章", "文章", "短文、詞彙與文法解說", "#c64332"],
              ].map(([number, title, label, description, color]) => (
                <article
                  key={number}
                  style={{ "--route-color": color } as CSSProperties}
                >
                  <span>{number}</span>
                  <small>{label}</small>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </article>
              ))}
            </div>

            <div className="book-list">
              {(curriculum?.books ?? []).length
                ? curriculum?.books.map((book) => (
                    <button
                      key={book.id}
                      onClick={() => openBook(book.id, 2)}
                      style={{ "--book-color": book.accent } as CSSProperties}
                    >
                      <span className="book-number">{book.number}</span>
                      <span className="book-series">{book.series}</span>
                      <span className="book-name">
                        <strong>{book.title}</strong>
                        <small>{book.description}</small>
                      </span>
                      <span className="book-count">
                        {book.pageCount} 頁
                        {book.audioCount > 0 && ` · ${book.audioCount} 音檔`}
                      </span>
                      <b aria-hidden="true">↗</b>
                    </button>
                  ))
                : fallbackBooks.map(([number, series, title, pages, color]) => (
                    <div
                      className="book-loading"
                      key={`${number}-${series}`}
                      style={{ "--book-color": color } as CSSProperties}
                    >
                      <span>{number}</span>
                      <b>{series}</b>
                      <strong>{title}</strong>
                      <small>{pages} 頁</small>
                    </div>
                  ))}
            </div>
          </div>
        </section>

        <section className="learning-lab" id="learn">
          <div className="mode-tabs section-pad" role="tablist" aria-label="學習工具">
            {[
              ["reader", "01", "全文閱讀"],
              ["vocabulary", "02", "語詞資料庫"],
              ["sentences", "03", "生活語句"],
            ].map(([id, index, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={mode === id}
                className={mode === id ? "active" : ""}
                onClick={() => switchMode(id as Mode)}
              >
                <span>{index}</span>
                {label}
              </button>
            ))}
          </div>

          {mode === "reader" && (
            <div className="reader-shell section-pad">
              <aside className="reader-rail">
                <header>
                  <small>HTML TEXTBOOK</small>
                  <strong>揀一冊</strong>
                </header>
                <div className="rail-books">
                  {curriculum?.books.map((book) => (
                    <button
                      key={book.id}
                      className={activeBookId === book.id ? "active" : ""}
                      onClick={() => openBook(book.id, 2)}
                      style={{ "--book-color": book.accent } as CSSProperties}
                    >
                      <span>{book.number}</span>
                      <b>{book.series}</b>
                      <small>{book.pageCount} 頁</small>
                    </button>
                  ))}
                </div>
                {activeBook && (
                  <div className="rail-progress">
                    <span>這冊已讀</span>
                    <strong>
                      {completeCount}
                      <small> / {activeBook.pageCount}</small>
                    </strong>
                    <div>
                      <i
                        style={{
                          width: `${(completeCount / activeBook.pageCount) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </aside>

              <div className="reader-main">
                {activeBook && activeHtmlPage && activePage ? (
                  <>
                    <header className="reader-header">
                      <div>
                        <p>
                          {activeBook.number} / {activeBook.series} / HTML EDITION
                        </p>
                        <h2>{activeBook.title}</h2>
                      </div>
                      <div className="reader-status">
                        <span>可搜尋</span>
                        <span>可選取</span>
                        <span>可重排</span>
                      </div>
                    </header>

                    <div className="reader-tools">
                      <div className="view-switch" aria-label="閱讀模式">
                        <button
                          className={readerView === "reading" ? "active" : ""}
                          onClick={() => setReaderView("reading")}
                        >
                          閱讀模式
                        </button>
                        <button
                          className={readerView === "layout" ? "active" : ""}
                          onClick={() => setReaderView("layout")}
                        >
                          原版模式
                        </button>
                      </div>
                      <label className="reader-search">
                        <span className="sr-only">搜尋這冊</span>
                        <input
                          value={readerQuery}
                          onChange={(event) => setReaderQuery(event.target.value)}
                          placeholder="搜尋這一冊的 HTML 全文…"
                        />
                        <b>⌕</b>
                      </label>
                      <div className="type-controls" aria-label="文字大小">
                        <button
                          onClick={() =>
                            setFontScale((value) => Math.max(0.85, value - 0.1))
                          }
                          aria-label="縮小文字"
                        >
                          A−
                        </button>
                        <span>{Math.round(fontScale * 100)}%</span>
                        <button
                          onClick={() =>
                            setFontScale((value) => Math.min(1.35, value + 0.1))
                          }
                          aria-label="放大文字"
                        >
                          A+
                        </button>
                      </div>
                    </div>

                    {readerQuery && (
                      <div className="search-results">
                        <span>
                          「{readerQuery}」在本冊找到 {matchingPages.length} 頁
                        </span>
                        <div>
                          {matchingPages.slice(0, 18).map((page) => (
                            <button
                              key={page.number}
                              className={
                                page.number === pageNumber ? "active" : ""
                              }
                              onClick={() => goToPage(page.number)}
                            >
                              p.{page.number}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {readerView === "reading" ? (
                      <article
                        className="reading-sheet"
                        style={{ "--font-scale": fontScale } as CSSProperties}
                      >
                        <header>
                          <span>
                            {activeBook.number} · {activeBook.series}
                          </span>
                          <strong>
                            第 {pageNumber} / {activeBook.pageCount} 頁
                          </strong>
                        </header>
                        {activeHtmlPage.text ? (
                          <div className="reading-columns">
                            {activeHtmlPage.columns.map((column) => (
                              <section key={column.side}>
                                <small>
                                  {column.side === "left" ? "LEFT PAGE" : "RIGHT PAGE"}
                                </small>
                                {column.blocks.map((block, index) => (
                                  <RenderBlock
                                    block={block}
                                    query={readerQuery}
                                    key={`${column.side}-${block.y}-${index}`}
                                  />
                                ))}
                              </section>
                            ))}
                          </div>
                        ) : sentencePageGroups.some(
                            (group) => group.sentences.length > 0,
                          ) ? (
                          <div className="reading-columns sentence-page-fallback">
                            {sentencePageGroups.map((group) => (
                              <section key={group.logicalPage}>
                                <small>TEXTBOOK PAGE {group.logicalPage}</small>
                                {group.sentences.map((sentence) => (
                                  <article key={sentence.id}>
                                    <span>{String(sentence.order).padStart(2, "0")}</span>
                                    <div>
                                      <strong>{sentence.hanji}</strong>
                                      <i>{sentence.lomaji}</i>
                                      <p>{sentence.huagi}</p>
                                    </div>
                                    <button
                                      onClick={() =>
                                        playAudio(
                                          sentenceAudio(sentence),
                                          sentence.hanji,
                                        )
                                      }
                                      aria-label={`播放${sentence.hanji}`}
                                    >
                                      ▶
                                    </button>
                                  </article>
                                ))}
                              </section>
                            ))}
                          </div>
                        ) : (
                          <div className="html-cover">
                            {pageNumber === 1 && (
                              // Pure cover artwork remains an image; its title is
                              // repeated below as semantic HTML.
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={activePage.image} alt="" aria-hidden="true" />
                            )}
                            <span>{activeBook.number}</span>
                            <small>{activeBook.series}</small>
                            <h3>{activeBook.title}</h3>
                            <p>
                              這是原書封面或純圖像頁。下一頁開始進入可搜尋的
                              HTML 正文。
                            </p>
                            <button onClick={() => goToPage(pageNumber + 1)}>
                              讀下一頁 →
                            </button>
                          </div>
                        )}
                      </article>
                    ) : (
                      <div className="layout-viewport">
                        {activeHtmlPage.lines.length ? (
                          <div
                            className="layout-sheet"
                            style={{
                              aspectRatio: `${activeHtmlPage.width} / ${activeHtmlPage.height}`,
                              "--font-scale": fontScale,
                            } as CSSProperties}
                          >
                            {activeHtmlPage.lines.map((line, index) => (
                              <span
                                className={`layout-line ${line.role}`}
                                key={`${line.y}-${line.x}-${index}`}
                                style={{
                                  "--line-x": `${line.x}%`,
                                  "--line-y": `${line.y}%`,
                                  "--line-size":
                                    (line.size / activeHtmlPage.width) * 100,
                                } as CSSProperties}
                              >
                                <Highlight text={line.text} query={readerQuery} />
                              </span>
                            ))}
                            {showAudio &&
                              activePage.hotspots.map((hotspot, index) => (
                                <button
                                  className={`layout-audio ${hotspot.kind} ${
                                    activeAudio?.url === hotspot.audio
                                      ? "playing"
                                      : ""
                                  }`}
                                  key={hotspot.id}
                                  style={{
                                    left: `${hotspot.x}%`,
                                    top: `${hotspot.y}%`,
                                    width: `${Math.max(hotspot.width, 1.6)}%`,
                                    height: `${Math.max(hotspot.height, 2.2)}%`,
                                    "--audio-delay": `${Math.min(index * 12, 300)}ms`,
                                  } as CSSProperties}
                                  title={closestLine(activeHtmlPage, hotspot)}
                                  aria-label={`播放：${closestLine(activeHtmlPage, hotspot)}`}
                                  disabled={!hotspot.available}
                                  onClick={() =>
                                    playAudio(
                                      hotspot.audio,
                                      closestLine(activeHtmlPage, hotspot),
                                    )
                                  }
                                >
                                  ▶
                                </button>
                              ))}
                          </div>
                        ) : sentencePageGroups.some(
                            (group) => group.sentences.length > 0,
                          ) ? (
                          <div className="sentence-layout-fallback">
                            {sentencePageGroups.map((group) => (
                              <section key={group.logicalPage}>
                                <header>讀語句上簡單 ｜ {group.logicalPage}</header>
                                {group.sentences.map((sentence) => (
                                  <article key={sentence.id}>
                                    <span>{sentence.order}</span>
                                    <div>
                                      <strong>{sentence.hanji}</strong>
                                      <i>{sentence.lomaji}</i>
                                      <small>{sentence.huagi}</small>
                                    </div>
                                    <button
                                      onClick={() =>
                                        playAudio(
                                          sentenceAudio(sentence),
                                          sentence.hanji,
                                        )
                                      }
                                    >
                                      ▶
                                    </button>
                                  </article>
                                ))}
                              </section>
                            ))}
                          </div>
                        ) : (
                          <div className="layout-cover-fallback">
                            <span>{activeBook.number}</span>
                            <strong>{activeBook.title}</strong>
                            <small>HTML COVER</small>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="reader-options">
                      <button
                        className={showAudio ? "active" : ""}
                        aria-pressed={showAudio}
                        onClick={() => setShowAudio((value) => !value)}
                      >
                        {showAudio ? "● 發音位置已顯示" : "○ 顯示發音位置"}
                      </button>
                      <button
                        className={completed.has(pageKey) ? "active" : ""}
                        onClick={toggleCompleted}
                      >
                        {completed.has(pageKey) ? "✓ 本頁讀過矣" : "標記本頁讀完"}
                      </button>
                      <a
                        href={activeBook.sourcePdf}
                        target="_blank"
                        rel="noreferrer"
                      >
                        核對原始 PDF ↗
                      </a>
                    </div>

                    {activePage.hotspots.length > 0 && (
                      <details className="page-audio-list">
                        <summary>
                          <span>本頁真人錄音</span>
                          <strong>{activePage.hotspots.length} 段</strong>
                        </summary>
                        <div>
                          {activePage.hotspots.map((hotspot, index) => {
                            const label = closestLine(activeHtmlPage, hotspot);
                            return (
                              <button
                                key={hotspot.id}
                                disabled={!hotspot.available}
                                className={
                                  activeAudio?.url === hotspot.audio
                                    ? "playing"
                                    : ""
                                }
                                onClick={() => playAudio(hotspot.audio, label)}
                              >
                                <span>{String(index + 1).padStart(2, "0")}</span>
                                <b>▶</b>
                                <em>{label}</em>
                              </button>
                            );
                          })}
                        </div>
                      </details>
                    )}

                    <div className="page-nav">
                      <button
                        onClick={() => goToPage(pageNumber - 1)}
                        disabled={pageNumber === 1}
                      >
                        ← 上一頁
                      </button>
                      <label>
                        <span>PAGE</span>
                        <select
                          value={pageNumber}
                          onChange={(event) =>
                            goToPage(Number(event.target.value))
                          }
                        >
                          {activeBook.pages.map((page) => (
                            <option value={page.number} key={page.number}>
                              {page.number} / {activeBook.pageCount}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        onClick={() => goToPage(pageNumber + 1)}
                        disabled={pageNumber === activeBook.pageCount}
                      >
                        下一頁 →
                      </button>
                    </div>
                    <label className="page-range">
                      <span>1</span>
                      <input
                        type="range"
                        min="1"
                        max={activeBook.pageCount}
                        value={pageNumber}
                        onChange={(event) =>
                          goToPage(Number(event.target.value))
                        }
                      />
                      <span>{activeBook.pageCount}</span>
                    </label>
                  </>
                ) : (
                  <div className="loading-panel">
                    <span>HTML</span>
                    <p>咧整理教材文字，請稍等一下⋯</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {mode === "vocabulary" && (
            <div className="database-mode section-pad">
              <header className="database-head">
                <div>
                  <p className="eyebrow">BOOK 02 / 852 ENTRIES</p>
                  <h2>語詞資料庫</h2>
                </div>
                <p>
                  詞頭、台羅、華語和例詞已從 PDF 表格重新整理；
                  A 聽詞頭，B 聽完整例詞。
                </p>
              </header>

              <div className="database-tools">
                <label>
                  <span>搜尋語詞</span>
                  <input
                    value={vocabSearch}
                    onChange={(event) => {
                      setVocabSearch(event.target.value);
                      setVisibleVocabulary(60);
                    }}
                    placeholder="例如：多謝、tsuí、漂亮…"
                  />
                </label>
                <div className="segmented">
                  {(["全部", "上冊", "下冊"] as const).map((value) => (
                    <button
                      key={value}
                      className={vocabVolume === value ? "active" : ""}
                      onClick={() => {
                        setVocabVolume(value);
                        setVisibleVocabulary(60);
                      }}
                    >
                      {value}
                    </button>
                  ))}
                </div>
                <strong>
                  {filteredVocabulary.length}
                  <small> 詞</small>
                </strong>
              </div>

              <div className="data-table word-table">
                <div className="table-labels" aria-hidden="true">
                  <span>編號</span>
                  <span>台文 / 台羅</span>
                  <span>華語 / 例詞</span>
                  <span>音檔</span>
                </div>
                {filteredVocabulary
                  .slice(0, visibleVocabulary)
                  .map((entry) => {
                    const revealed = revealedWords.has(entry.id);
                    return (
                      <article key={entry.id}>
                        <button
                          className="entry-number"
                          onClick={() => openBook(entry.bookId, entry.page)}
                        >
                          {entry.volume === "上冊" ? "上" : "下"}·
                          {entry.number}
                        </button>
                        <div className="entry-word">
                          <strong>{entry.headword}</strong>
                          <i>{entry.romanization || "—"}</i>
                        </div>
                        <button
                          className={`entry-meaning ${revealed ? "revealed" : ""}`}
                          onClick={() => {
                            const next = new Set(revealedWords);
                            if (revealed) next.delete(entry.id);
                            else next.add(entry.id);
                            setRevealedWords(next);
                          }}
                        >
                          <span>{revealed ? entry.meaning : "按一下看華語"}</span>
                          <small>
                            {revealed && entry.examples
                              ? entry.examples
                              : "先想一下這个詞是啥物意思"}
                          </small>
                        </button>
                        <div className="entry-audio">
                          <button
                            onClick={() =>
                              playAudio(entry.audioA, entry.headword)
                            }
                            disabled={!entry.audioA}
                          >
                            <b>A</b> 詞頭
                          </button>
                          <button
                            onClick={() =>
                              playAudio(entry.audioB, `${entry.headword}的例詞`)
                            }
                            disabled={!entry.audioB}
                          >
                            <b>B</b> 例詞
                          </button>
                        </div>
                      </article>
                    );
                  })}
              </div>
              {filteredVocabulary.length === 0 && (
                <div className="empty-state">
                  <strong>揣無這个語詞</strong>
                  <p>試看覓改用台文、台羅或華語搜尋。</p>
                </div>
              )}
              {visibleVocabulary < filteredVocabulary.length && (
                <button
                  className="load-more"
                  onClick={() => setVisibleVocabulary((value) => value + 80)}
                >
                  閣看 80 詞
                </button>
              )}
            </div>
          )}

          {mode === "sentences" && (
            <div className="database-mode section-pad">
              <header className="database-head">
                <div>
                  <p className="eyebrow">BOOK 03 / 840 SENTENCES</p>
                  <h2>生活語句</h2>
                </div>
                <p>
                  十六種生活情境，先聽真人發音、跟講一遍，
                  再揭開台羅與華語答案。
                </p>
              </header>

              {practiceSentence && (
                <article className="practice-board">
                  <header>
                    <span>
                      隨機練習 / {practiceSentence.volume} /
                      {chapterName(practiceSentence.chapter)}
                    </span>
                    <button onClick={randomPractice}>換一句 ↻</button>
                  </header>
                  <div>
                    <button
                      className="practice-play"
                      onClick={() =>
                        playAudio(
                          sentenceAudio(practiceSentence),
                          practiceSentence.hanji,
                        )
                      }
                    >
                      ▶
                    </button>
                    <h3>{practiceSentence.hanji}</h3>
                    <button
                      className="reveal-answer"
                      onClick={() => setShowPracticeAnswer((value) => !value)}
                    >
                      {showPracticeAnswer ? "收起答案" : "看台羅與華語"}
                    </button>
                  </div>
                  {showPracticeAnswer && (
                    <footer>
                      <i>{practiceSentence.lomaji}</i>
                      <span>{practiceSentence.huagi}</span>
                    </footer>
                  )}
                </article>
              )}

              <div className="database-tools sentence-tools">
                <label>
                  <span>搜尋語句</span>
                  <input
                    value={sentenceSearch}
                    onChange={(event) => {
                      setSentenceSearch(event.target.value);
                      setVisibleSentences(60);
                    }}
                    placeholder="台文、台羅或華語…"
                  />
                </label>
                <select
                  value={sentenceChapter}
                  onChange={(event) => {
                    setSentenceChapter(event.target.value);
                    setVisibleSentences(60);
                  }}
                >
                  <option value="全部">全部主題</option>
                  {chapters.map((chapter) => (
                    <option value={chapter} key={chapter}>
                      {chapter}
                    </option>
                  ))}
                </select>
                <div className="segmented">
                  {(["全部", "上冊", "下冊"] as const).map((value) => (
                    <button
                      key={value}
                      className={sentenceVolume === value ? "active" : ""}
                      onClick={() => {
                        setSentenceVolume(value);
                        setVisibleSentences(60);
                      }}
                    >
                      {value}
                    </button>
                  ))}
                </div>
                <strong>
                  {filteredSentences.length}
                  <small> 句</small>
                </strong>
              </div>

              <div className="data-table sentence-table">
                <div className="table-labels" aria-hidden="true">
                  <span>主題</span>
                  <span>台文 / 台羅</span>
                  <span>華語</span>
                  <span>聽</span>
                </div>
                {filteredSentences
                  .slice(0, visibleSentences)
                  .map((sentence) => (
                    <article key={sentence.id}>
                      <span className="sentence-topic">
                        {sentence.volume === "上冊" ? "上" : "下"} ·
                        {chapterName(sentence.chapter)}
                      </span>
                      <div className="sentence-copy">
                        <strong>{sentence.hanji}</strong>
                        <i>{sentence.lomaji}</i>
                      </div>
                      <span className="sentence-meaning">{sentence.huagi}</span>
                      <button
                        className="sentence-play"
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
              {filteredSentences.length === 0 && (
                <div className="empty-state">
                  <strong>揣無這句</strong>
                  <p>換一个關鍵字，抑是切回全部主題。</p>
                </div>
              )}
              {visibleSentences < filteredSentences.length && (
                <button
                  className="load-more"
                  onClick={() => setVisibleSentences((value) => value + 80)}
                >
                  閣看 80 句
                </button>
              )}
            </div>
          )}
        </section>

        <section className="about-section" id="about">
          <div className="section-pad about-grid">
            <div>
              <p className="eyebrow">OPEN SOURCE / OPEN TEXTBOOK</p>
              <h2>完整，不等於照搬。</h2>
            </div>
            <div>
              <p>
                原 PDF 的文字、頁次與音檔位置全部保留；網頁端重新處理閱讀順序、
                手機斷行、搜尋、字級與練習流程。插圖與版面可回原始 PDF 核對，
                文字不再被鎖在圖片裡。
              </p>
              <div>
                <a href={SOURCE_ROOT} target="_blank" rel="noreferrer">
                  教材原始資料 ↗
                </a>
                <a href={OPENFORMOSA_ROOT} target="_blank" rel="noreferrer">
                  OpenFormosa ↗
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="section-pad">
          <div className="footer-brand">
            <span className="brand-mark">台</span>
            <div>
              <strong>咱來學台語</strong>
              <small>OPENFORMOSA LEARNING EDITION</small>
            </div>
          </div>
          <p>
            教材內容與音檔來自
            Taiwanese-Corpus/Lan-Lai-Oh-Taigi，著作權與授權依原始來源為準。
          </p>
          <a href="#top">轉去頂懸 ↑</a>
        </div>
      </footer>

      <audio
        ref={audioRef}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onTimeUpdate={(event) => setAudioTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) =>
          setAudioDuration(event.currentTarget.duration || 0)
        }
      />

      {activeAudio && (
        <div className="audio-dock" role="region" aria-label="發音播放器">
          <button
            className="dock-play"
            onClick={() => playAudio(activeAudio.url, activeAudio.label)}
            aria-label={isPlaying ? "暫停" : "播放"}
          >
            {isPlaying ? "Ⅱ" : "▶"}
          </button>
          <div className="dock-copy">
            <span>真人發音</span>
            <strong>{activeAudio.label}</strong>
            <input
              type="range"
              min="0"
              max={audioDuration || 1}
              value={Math.min(audioTime, audioDuration || 1)}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (audioRef.current) audioRef.current.currentTime = next;
                setAudioTime(next);
              }}
              aria-label="播放進度"
            />
          </div>
          <div className="dock-speed">
            {[0.75, 1, 1.25].map((value) => (
              <button
                key={value}
                className={speed === value ? "active" : ""}
                onClick={() => setSpeed(value)}
              >
                {value}×
              </button>
            ))}
          </div>
          <button
            className="dock-close"
            onClick={() => {
              audioRef.current?.pause();
              setActiveAudio(null);
            }}
            aria-label="關閉播放器"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
