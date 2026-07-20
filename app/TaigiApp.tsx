"use client";

import {
  CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Mode = "reader" | "vocabulary" | "sentences" | "games";
type ReaderView = "reading" | "layout";
type Volume = "上冊" | "下冊";
type LearnerLevel = "starter" | "everyday" | "advanced";
type HintMode = "full" | "romanization" | "challenge";
type GameKind = "listening" | "word";

type GameRound = {
  id: string;
  kind: GameKind;
  prompt: string;
  romanization: string;
  answer: string;
  audio: string;
  options: Array<{ id: string; label: string }>;
};

type GameStats = {
  score: number;
  streak: number;
  bestStreak: number;
  answered: number;
};

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
    rebuiltVocabularyEntries: number;
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

const learnerLevels: Record<
  LearnerLevel,
  {
    index: string;
    name: string;
    short: string;
    description: string;
    goal: string;
    pace: string;
    hintMode: HintMode;
    speed: number;
    fontScale: number;
    color: string;
    steps: Array<{
      label: string;
      title: string;
      detail: string;
      action: "book" | Mode;
      bookId?: string;
      page?: number;
    }>;
  }
> = {
  starter: {
    index: "01",
    name: "初學起步",
    short: "頭一擺學",
    description: "看華語與台羅提示，放慢速度，先聽清楚再開口。",
    goal: "認得拼音、聽出聲調，累積第一批生活語詞。",
    pace: "完整提示 · 0.75× 慢速",
    hintMode: "full",
    speed: 0.75,
    fontScale: 1.12,
    color: "#154f83",
    steps: [
      {
        label: "先聽",
        title: "拼音與聲調",
        detail: "從發音教材開始，點每一個音反覆聽。",
        action: "book",
        bookId: "pronunciation",
        page: 2,
      },
      {
        label: "再認",
        title: "常用語詞",
        detail: "同時看台文、台羅與華語，建立連結。",
        action: "vocabulary",
      },
      {
        label: "闖關",
        title: "聽力初挑戰",
        detail: "聽一句、揀意思，用遊戲建立第一份信心。",
        action: "games",
      },
    ],
  },
  everyday: {
    index: "02",
    name: "生活應用",
    short: "會講一寡",
    description: "保留台羅、先收起華語，用生活情境練自然反應。",
    goal: "把已經聽過的詞組成句，增加日常對話的流暢度。",
    pace: "台羅提示 · 1× 原速",
    hintMode: "romanization",
    speed: 1,
    fontScale: 1,
    color: "#0b6b50",
    steps: [
      {
        label: "暖身",
        title: "情境聽句",
        detail: "先聽真人發音，不看華語猜語意。",
        action: "sentences",
      },
      {
        label: "補詞",
        title: "主題語詞",
        detail: "從不熟的句子回頭查詞與例詞。",
        action: "vocabulary",
      },
      {
        label: "闖關",
        title: "情境聽力賽",
        detail: "不看華語先聽懂，累積答對連勝。",
        action: "games",
      },
    ],
  },
  advanced: {
    index: "03",
    name: "進階讀寫",
    short: "欲讀長文",
    description: "預設隱藏提示，直接讀文章、查全文、辨認細節。",
    goal: "閱讀完整篇章，掌握台文用字與較長語境。",
    pace: "挑戰模式 · 1.25× 快速",
    hintMode: "challenge",
    speed: 1.25,
    fontScale: 0.95,
    color: "#c64332",
    steps: [
      {
        label: "精讀",
        title: "文章上冊",
        detail: "讀 HTML 長文，用全文搜尋追詞語。",
        action: "book",
        bookId: "articles-1",
        page: 2,
      },
      {
        label: "延伸",
        title: "文章下冊",
        detail: "換一篇讀，對照原版排版與真人發音。",
        action: "book",
        bookId: "articles-2",
        page: 2,
      },
      {
        label: "自測",
        title: "無提示聽句",
        detail: "只聽真人發音作答，挑戰最高連勝。",
        action: "games",
      },
    ],
  },
};

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

function loadLearnerLevel(): LearnerLevel {
  try {
    const value = localStorage.getItem("opentaigi-learner-level");
    if (value === "starter" || value === "everyday" || value === "advanced") {
      return value;
    }
  } catch {
    // Use the welcoming starter profile if preferences are unavailable.
  }
  return "starter";
}

function loadGameStats(): GameStats {
  try {
    const value = JSON.parse(
      localStorage.getItem("opentaigi-game-stats") ?? "null",
    );
    if (
      value &&
      [value.score, value.streak, value.bestStreak, value.answered].every(
        Number.isFinite,
      )
    ) {
      return value;
    }
  } catch {
    // Starting from zero is safer than blocking play on an old preference.
  }
  return { score: 0, streak: 0, bestStreak: 0, answered: 0 };
}

function shuffled<T>(values: T[]) {
  return [...values].sort(() => Math.random() - 0.5);
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
  const normalized = block.text.trim();
  if (!normalized || /^[—–─-]+$/.test(normalized)) return null;
  const content = <Highlight text={block.text} query={query} />;
  if (block.role === "title") return <h3>{content}</h3>;
  if (block.role === "heading" && normalized.length <= 3) {
    return <span className="inline-term">{content}</span>;
  }
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

function normalizeTeachingText(value: string) {
  return value
    .replace(/[▲◆◇*＊\s、，。．：:；;（）()「」『』【】]/g, "")
    .toLocaleLowerCase();
}

function audioForBlock(
  page: HtmlPage,
  side: "left" | "right",
  block: HtmlBlock,
  hotspots: Hotspot[],
) {
  const blockText = normalizeTeachingText(block.text);
  if (!blockText) return [];
  return hotspots.filter((hotspot) => {
    const hotspotSide = hotspot.x < 50 ? "left" : "right";
    if (hotspotSide !== side || Math.abs(hotspot.y - block.y) > 5.5) {
      return false;
    }
    const audioText = normalizeTeachingText(closestLine(page, hotspot));
    if (!audioText) return false;
    if (audioText === blockText) return true;
    if (
      (block.role !== "title" && block.role !== "heading") ||
      blockText.length <= 3 ||
      audioText.length <= 1
    ) {
      return false;
    }
    return blockText.includes(audioText) || audioText.includes(blockText);
  });
}

export function TaigiApp() {
  const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
  const [htmlCurriculum, setHtmlCurriculum] =
    useState<HtmlCurriculum | null>(null);
  const [vocabulary, setVocabulary] = useState<Vocabulary[]>([]);
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [mode, setMode] = useState<Mode>("reader");
  const [readerView, setReaderView] = useState<ReaderView>("reading");
  const [learnerLevel, setLearnerLevel] =
    useState<LearnerLevel>("starter");
  const [hintMode, setHintMode] = useState<HintMode>("full");
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
  const [revealedSentences, setRevealedSentences] = useState<Set<string>>(
    new Set(),
  );
  const [sentenceSearch, setSentenceSearch] = useState("");
  const [sentenceVolume, setSentenceVolume] =
    useState<"全部" | Volume>("全部");
  const [sentenceChapter, setSentenceChapter] = useState("全部");
  const [visibleSentences, setVisibleSentences] = useState(60);
  const [practiceSentence, setPracticeSentence] = useState<Sentence | null>(
    null,
  );
  const [showPracticeAnswer, setShowPracticeAnswer] = useState(false);
  const [gameKind, setGameKind] = useState<GameKind>("listening");
  const [gameRound, setGameRound] = useState<GameRound | null>(null);
  const [gameChoice, setGameChoice] = useState<string | null>(null);
  const [gameStats, setGameStats] = useState<GameStats>({
    score: 0,
    streak: 0,
    bestStreak: 0,
    answered: 0,
  });
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const audioRef = useRef<HTMLAudioElement>(null);
  const learnerProfile = learnerLevels[learnerLevel];

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
    const savedLevel = loadLearnerLevel();
    const profile = learnerLevels[savedLevel];
    const frame = window.requestAnimationFrame(() => {
      setLearnerLevel(savedLevel);
      setHintMode(profile.hintMode);
      setSpeed(profile.speed);
      setFontScale(profile.fontScale);
      setGameStats(loadGameStats());
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
  const pageVocabulary = useMemo(
    () =>
      vocabulary.filter(
        (entry) =>
          entry.bookId === activeBookId && entry.page === pageNumber,
      ),
    [activeBookId, pageNumber, vocabulary],
  );

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

  const makeGameRound = useCallback(
    (kind: GameKind, avoidId?: string): GameRound | null => {
      if (kind === "listening") {
        const pool = sentences.filter(
          (sentence) => sentence.huagi && sentence.id !== avoidId,
        );
        const question = shuffled(pool)[0];
        if (!question) return null;
        const distractors = shuffled(
          sentences.filter(
            (sentence) =>
              sentence.id !== question.id &&
              sentence.huagi &&
              sentence.huagi !== question.huagi,
          ),
        )
          .filter(
            (sentence, index, values) =>
              values.findIndex((item) => item.huagi === sentence.huagi) === index,
          )
          .slice(0, 3);
        const options = shuffled([question, ...distractors]).map((sentence) => ({
          id: sentence.huagi,
          label: sentence.huagi,
        }));
        return {
          id: question.id,
          kind,
          prompt: question.hanji,
          romanization: question.lomaji,
          answer: question.huagi,
          audio: sentenceAudio(question),
          options,
        };
      }

      const pool = vocabulary.filter(
        (entry) => entry.meaning && entry.id !== avoidId,
      );
      const question = shuffled(pool)[0];
      if (!question) return null;
      const distractors = shuffled(
        vocabulary.filter(
          (entry) =>
            entry.id !== question.id &&
            entry.meaning &&
            entry.meaning !== question.meaning,
        ),
      )
        .filter(
          (entry, index, values) =>
            values.findIndex((item) => item.meaning === entry.meaning) === index,
        )
        .slice(0, 3);
      const options = shuffled([question, ...distractors]).map((entry) => ({
        id: entry.meaning,
        label: entry.meaning,
      }));
      return {
        id: question.id,
        kind,
        prompt: question.headword,
        romanization: question.romanization,
        answer: question.meaning,
        audio: question.audioA,
        options,
      };
    },
    [sentences, vocabulary],
  );

  const startGame = useCallback(
    (kind: GameKind, avoidId?: string) => {
      setGameKind(kind);
      setGameChoice(null);
      setGameRound(makeGameRound(kind, avoidId));
    },
    [makeGameRound],
  );

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

  const answerGame = (choice: string) => {
    if (!gameRound || gameChoice) return;
    const correct = choice === gameRound.answer;
    setGameChoice(choice);
    setGameStats((current) => {
      const streak = correct ? current.streak + 1 : 0;
      const next = {
        score: current.score + (correct ? 10 + current.streak * 2 : 0),
        streak,
        bestStreak: Math.max(current.bestStreak, streak),
        answered: current.answered + 1,
      };
      localStorage.setItem("opentaigi-game-stats", JSON.stringify(next));
      return next;
    });
  };

  const resetGameStats = () => {
    const next = { score: 0, streak: 0, bestStreak: 0, answered: 0 };
    setGameStats(next);
    localStorage.setItem("opentaigi-game-stats", JSON.stringify(next));
  };

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

  const openBook = (bookId: string, page?: number) => {
    const lessonPage =
      page ??
      (bookId.startsWith("vocabulary-") ||
      bookId.startsWith("sentences-")
        ? 3
        : 2);
    setActiveBookId(bookId);
    setPageNumber(lessonPage);
    setMode("reader");
    rememberPlace(bookId, lessonPage);
    window.setTimeout(
      () => document.querySelector("#learn")?.scrollIntoView(),
      0,
    );
  };

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    if (nextMode === "games" && (!gameRound || gameRound.kind !== gameKind)) {
      startGame(gameKind);
    }
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

  const chooseLearnerLevel = (level: LearnerLevel) => {
    const profile = learnerLevels[level];
    setLearnerLevel(level);
    setHintMode(profile.hintMode);
    setSpeed(profile.speed);
    setFontScale(profile.fontScale);
    setReaderView("reading");
    setRevealedWords(new Set());
    setRevealedSentences(new Set());
    setShowPracticeAnswer(false);
    localStorage.setItem("opentaigi-learner-level", level);
  };

  const openLearningStep = (
    step: (typeof learnerLevels)[LearnerLevel]["steps"][number],
  ) => {
    if (step.action === "book") {
      if (step.bookId) openBook(step.bookId, step.page ?? 2);
      return;
    }
    switchMode(step.action);
  };

  const navigateLastPlace = () => {
    if (lastPlace) openBook(lastPlace.bookId, lastPlace.page);
    else openLearningStep(learnerProfile.steps[0]);
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
            <a href="#levels">分級路線</a>
            <a href="#books">全部教材</a>
            <button onClick={() => switchMode("vocabulary")}>語詞</button>
            <button onClick={() => switchMode("sentences")}>語句</button>
            <button onClick={() => switchMode("games")}>遊戲</button>
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
            <p className="eyebrow">真實語料 / 分級遊戲 / 完整教材</p>
            <h1>
              <span>聽一句、揣答案，</span>
              <span>一關一關</span>
              <span>學台語。</span>
            </h1>
            <p className="lede">
              不論是第一次學、已經會講一點，或想讀完整文章，
              都能用真人發音玩聽力、配詞義、累積連勝；提示與速度會跟著程度調整。
            </p>
          </div>

          <aside
            className="release-board learner-ticket"
            aria-label={`目前選擇：${learnerProfile.name}`}
            style={{ "--level-color": learnerProfile.color } as CSSProperties}
          >
            <header>
              <span>YOUR LEARNING EDITION</span>
              <b>{learnerProfile.index}</b>
            </header>
            <div className="release-title">
              <p>{learnerProfile.short}</p>
              <strong>{learnerProfile.name}</strong>
              <span>{learnerProfile.goal}</span>
            </div>
            <dl>
              <div>
                <dt>學習提示</dt>
                <dd>{learnerProfile.pace.split(" · ")[0]}</dd>
              </div>
              <div>
                <dt>播放速度</dt>
                <dd>{learnerProfile.speed}×</dd>
              </div>
              <div>
                <dt>互動遊戲</dt>
                <dd>2 款</dd>
              </div>
            </dl>
            <div className="release-status">
              <i />
              <span>設定會保留在這台裝置</span>
            </div>
          </aside>

          <div className="level-picker" id="levels" aria-label="選擇學習程度">
            {(Object.entries(learnerLevels) as Array<
              [LearnerLevel, (typeof learnerLevels)[LearnerLevel]]
            >).map(([id, profile]) => (
              <button
                key={id}
                className={learnerLevel === id ? "active" : ""}
                aria-pressed={learnerLevel === id}
                onClick={() => chooseLearnerLevel(id)}
                style={{ "--level-color": profile.color } as CSSProperties}
              >
                <span>{profile.index}</span>
                <small>{profile.short}</small>
                <strong>{profile.name}</strong>
                <p>{profile.description}</p>
                <em>{learnerLevel === id ? "目前選擇 ✓" : "選這條路線 ↗"}</em>
              </button>
            ))}
          </div>
        </section>

        <section className="route-section" id="books">
          <div className="section-pad">
            <header className="section-head">
              <div>
                <p className="eyebrow">你的推薦路線 / {learnerProfile.index}</p>
                <h2>{learnerProfile.goal}</h2>
              </div>
              <p>
                這條路線不是鎖定課程；任何時候都能切換程度、提示方式，
                或直接打開下方八冊完整教材。
              </p>
            </header>

            <div
              className="personal-route"
              style={{ "--level-color": learnerProfile.color } as CSSProperties}
            >
              <header>
                <span>建議順序</span>
                <strong>{learnerProfile.pace}</strong>
              </header>
              <div>
                {learnerProfile.steps.map((step, index) => (
                  <button
                    key={`${learnerLevel}-${step.title}`}
                    onClick={() => openLearningStep(step)}
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <small>{step.label}</small>
                    <strong>{step.title}</strong>
                    <p>{step.detail}</p>
                    <b aria-hidden="true">↗</b>
                  </button>
                ))}
              </div>
              <footer>
                <span>完整提示會顯示華語與台羅；挑戰模式會先把兩者收起來。</span>
                <a href="#learn">直接進入學習區 ↓</a>
              </footer>
            </div>

            <header className="library-head">
              <div>
                <small>FULL LIBRARY</small>
                <strong>八冊完整教材</strong>
              </div>
              <p>聲、詞、句、文全數開放，不受目前程度限制。</p>
            </header>

            <div className="book-list">
              {(curriculum?.books ?? []).length
                ? curriculum?.books.map((book) => (
                    <button
                      key={book.id}
                      onClick={() => openBook(book.id)}
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
          <div
            className="learner-context section-pad"
            style={{ "--level-color": learnerProfile.color } as CSSProperties}
          >
            <div>
              <span>目前程度</span>
              <strong>{learnerProfile.name}</strong>
              <small>{learnerProfile.pace}</small>
            </div>
            <p>{learnerProfile.description}</p>
            <a href="#levels">調整程度 ↑</a>
          </div>
          <div className="mode-tabs section-pad" role="tablist" aria-label="學習工具">
            {[
              ["reader", "01", "全文閱讀"],
              ["vocabulary", "02", "語詞資料庫"],
              ["sentences", "03", "生活語句"],
              ["games", "04", "遊戲練功"],
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
                      aria-pressed={activeBookId === book.id}
                      onClick={() => openBook(book.id)}
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
                      <div className="reader-title">
                        <p>
                          {activeBook.number} / {activeBook.series} / HTML EDITION
                        </p>
                        <h2>{activeBook.title}</h2>
                      </div>
                      <nav
                        className="reader-page-controls"
                        aria-label="教材頁面導覽"
                      >
                        <button
                          type="button"
                          onClick={() => goToPage(pageNumber - 1)}
                          disabled={pageNumber === 1}
                        >
                          <b aria-hidden="true">←</b>
                          <span>上一頁</span>
                        </button>
                        <div>
                          <span>本冊位置</span>
                          <strong>
                            {pageNumber}
                            <small> / {activeBook.pageCount}</small>
                          </strong>
                          <progress
                            value={pageNumber}
                            max={activeBook.pageCount}
                            aria-label={`目前在第 ${pageNumber} 頁，共 ${activeBook.pageCount} 頁`}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => goToPage(pageNumber + 1)}
                          disabled={pageNumber === activeBook.pageCount}
                        >
                          <span>下一頁</span>
                          <b aria-hidden="true">→</b>
                        </button>
                      </nav>
                    </header>

                    <div className="reader-tools" aria-label="閱讀設定">
                      <div className="view-switch" aria-label="閱讀模式">
                        <button
                          className={readerView === "reading" ? "active" : ""}
                          onClick={() => setReaderView("reading")}
                        >
                          教學模式
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
                            {activePage.hotspots.length > 0 &&
                              ` · ${activePage.hotspots.length} 段真人發音`}
                          </span>
                          <strong>
                            {completed.has(pageKey) ? "✓ 本頁已完成" : "本頁學習中"}
                          </strong>
                        </header>
                        {pageVocabulary.length > 0 ? (
                          <div className="lesson-page vocabulary-lesson">
                            <header className="lesson-intro">
                              <div>
                                <span>本頁學習 / PAGE {pageNumber}</span>
                                <h3>{pageVocabulary.length} 个生活語詞</h3>
                                <p>
                                  先聽詞頭，閣看台羅佮華語，最後聽完整例詞。
                                </p>
                              </div>
                              <ol aria-label="建議學習順序">
                                <li><b>1</b> 聽詞頭</li>
                                <li><b>2</b> 看台羅</li>
                                <li><b>3</b> 跟講例詞</li>
                              </ol>
                            </header>
                            <div className="lesson-word-list">
                              {pageVocabulary.map((entry) => {
                                const manuallyRevealed =
                                  revealedWords.has(entry.id);
                                const showRomanization =
                                  hintMode !== "challenge" || manuallyRevealed;
                                const showMeaning =
                                  hintMode === "full" || manuallyRevealed;
                                const isWordAudio =
                                  activeAudio?.url === entry.audioA;
                                const isExampleAudio =
                                  activeAudio?.url === entry.audioB;
                                return (
                                  <article
                                    className={
                                      isWordAudio || isExampleAudio
                                        ? "is-listening"
                                        : ""
                                    }
                                    key={entry.id}
                                  >
                                    <span className="lesson-word-number">
                                      {entry.number}
                                    </span>
                                    <button
                                      className={`lesson-word-play ${
                                        isWordAudio ? "is-active" : ""
                                      }`}
                                      onClick={() =>
                                        playAudio(entry.audioA, entry.headword)
                                      }
                                      aria-label={`${isWordAudio && isPlaying ? "暫停" : "播放"}${entry.headword}`}
                                      aria-pressed={isWordAudio && isPlaying}
                                    >
                                      {isWordAudio && isPlaying ? "Ⅱ" : "▶"}
                                    </button>
                                    <div className="lesson-word-main">
                                      <strong>{entry.headword}</strong>
                                      <i>
                                        {showRomanization
                                          ? entry.romanization || "—"
                                          : "台羅先收起來"}
                                      </i>
                                    </div>
                                    <button
                                      className={`lesson-word-meaning ${
                                        showMeaning ? "revealed" : ""
                                      }`}
                                      onClick={() => {
                                        const next = new Set(revealedWords);
                                        if (manuallyRevealed) {
                                          next.delete(entry.id);
                                        } else {
                                          next.add(entry.id);
                                        }
                                        setRevealedWords(next);
                                      }}
                                    >
                                      <span>
                                        {showMeaning
                                          ? entry.meaning
                                          : "想看覓，閣揭答案"}
                                      </span>
                                      <small>
                                        {showMeaning && entry.examples
                                          ? entry.examples
                                          : "按一下顯示華語佮例詞"}
                                      </small>
                                    </button>
                                    <button
                                      className={`lesson-example-play ${
                                        isExampleAudio ? "is-active" : ""
                                      }`}
                                      onClick={() =>
                                        playAudio(
                                          entry.audioB,
                                          `${entry.headword}的例詞`,
                                        )
                                      }
                                      disabled={!entry.audioB}
                                      aria-pressed={
                                        isExampleAudio && isPlaying
                                      }
                                    >
                                      {isExampleAudio && isPlaying
                                        ? "Ⅱ 暫停例詞"
                                        : "B · 聽例詞"}
                                    </button>
                                  </article>
                                );
                              })}
                            </div>
                          </div>
                        ) : sentencePageGroups.some(
                            (group) => group.sentences.length > 0,
                          ) ? (
                          <div className="lesson-page sentence-lesson">
                            <header className="lesson-intro">
                              <div>
                                <span>生活情境 / PAGE {pageNumber}</span>
                                <h3>聽一句，跟講一句</h3>
                                <p>
                                  先按播放聽完整語氣，跟講了後才揭開提示。
                                </p>
                              </div>
                              <ol aria-label="建議學習順序">
                                <li><b>1</b> 聽語氣</li>
                                <li><b>2</b> 跟講</li>
                                <li><b>3</b> 揭答案</li>
                              </ol>
                            </header>
                            <div className="lesson-sentence-list">
                              {sentencePageGroups.flatMap((group) =>
                                group.sentences.map((sentence) => {
                                  const manuallyRevealed =
                                    revealedSentences.has(sentence.id);
                                  const showRomanization =
                                    hintMode !== "challenge" ||
                                    manuallyRevealed;
                                  const showMeaning =
                                    hintMode === "full" || manuallyRevealed;
                                  const sentenceUrl =
                                    sentenceAudio(sentence);
                                  const isSentenceAudio =
                                    activeAudio?.url === sentenceUrl;
                                  return (
                                    <article
                                      className={
                                        isSentenceAudio ? "is-listening" : ""
                                      }
                                      key={sentence.id}
                                    >
                                      <span>
                                        {String(sentence.order).padStart(2, "0")}
                                      </span>
                                      <button
                                        className={`lesson-sentence-play ${
                                          isSentenceAudio ? "is-active" : ""
                                        }`}
                                        onClick={() =>
                                          playAudio(
                                            sentenceUrl,
                                            sentence.hanji,
                                          )
                                        }
                                        aria-label={`${isSentenceAudio && isPlaying ? "暫停" : "播放"}${sentence.hanji}`}
                                        aria-pressed={
                                          isSentenceAudio && isPlaying
                                        }
                                      >
                                        {isSentenceAudio && isPlaying
                                          ? "Ⅱ"
                                          : "▶"}
                                      </button>
                                      <div>
                                        <strong>{sentence.hanji}</strong>
                                        {showRomanization && (
                                          <i>{sentence.lomaji}</i>
                                        )}
                                      </div>
                                      <button
                                        className={`lesson-sentence-hint ${
                                          showMeaning ? "revealed" : ""
                                        }`}
                                        onClick={() => {
                                          const next =
                                            new Set(revealedSentences);
                                          if (manuallyRevealed) {
                                            next.delete(sentence.id);
                                          } else {
                                            next.add(sentence.id);
                                          }
                                          setRevealedSentences(next);
                                        }}
                                      >
                                        {showMeaning
                                          ? sentence.huagi
                                          : "揭開華語提示"}
                                      </button>
                                    </article>
                                  );
                                }),
                              )}
                            </div>
                          </div>
                        ) : activeHtmlPage.text ? (
                          <div className="reading-flow">
                            {activeHtmlPage.columns.map((column) => (
                              <section key={column.side}>
                                {column.blocks.map((block, index) => {
                                  const blockAudio = audioForBlock(
                                    activeHtmlPage,
                                    column.side,
                                    block,
                                    activePage.hotspots,
                                  );
                                  const shortPlayable =
                                    blockAudio.length > 0 &&
                                    normalizeTeachingText(block.text).length <= 3;
                                  const blockKey = `${column.side}-${block.y}-${index}`;

                                  if (shortPlayable) {
                                    const hotspot = blockAudio[0];
                                    const isActive =
                                      activeAudio?.url === hotspot.audio;
                                    return (
                                      <article
                                        className={`sound-lesson ${
                                          isActive ? "is-active" : ""
                                        } ${isActive && isPlaying ? "is-playing" : ""}`}
                                        key={blockKey}
                                      >
                                        <button
                                          type="button"
                                          disabled={!hotspot.available}
                                          aria-label={`${isActive && isPlaying ? "暫停" : "播放"} ${block.text}`}
                                          aria-pressed={isActive && isPlaying}
                                          onClick={() =>
                                            playAudio(
                                              hotspot.audio,
                                              closestLine(
                                                activeHtmlPage,
                                                hotspot,
                                              ),
                                            )
                                          }
                                        >
                                          {isActive && isPlaying ? "Ⅱ" : "▶"}
                                        </button>
                                        <div>
                                          <strong>
                                            <Highlight
                                              text={block.text}
                                              query={readerQuery}
                                            />
                                          </strong>
                                          <small>點一下，邊看教材邊聽發音</small>
                                        </div>
                                        <span aria-hidden="true">
                                          {String(
                                            activePage.hotspots.findIndex(
                                              (item) =>
                                                item.id === hotspot.id,
                                            ) + 1,
                                          ).padStart(2, "0")}
                                        </span>
                                      </article>
                                    );
                                  }

                                  return (
                                    <div
                                      className={`integrated-teaching-block ${
                                        blockAudio.length > 0
                                          ? "has-audio"
                                          : ""
                                      }`}
                                      key={blockKey}
                                    >
                                      <RenderBlock
                                        block={block}
                                        query={readerQuery}
                                      />
                                      {blockAudio.length > 0 && (
                                        <div
                                          className="inline-block-audio"
                                          aria-label={`${block.text}的真人發音`}
                                        >
                                          {blockAudio.map((hotspot) => {
                                            const label = closestLine(
                                              activeHtmlPage,
                                              hotspot,
                                            );
                                            const isActive =
                                              activeAudio?.url ===
                                              hotspot.audio;
                                            return (
                                              <button
                                                type="button"
                                                key={hotspot.id}
                                                disabled={!hotspot.available}
                                                className={
                                                  isActive ? "is-active" : ""
                                                }
                                                aria-label={`${isActive && isPlaying ? "暫停" : "播放"} ${label}`}
                                                aria-pressed={
                                                  isActive && isPlaying
                                                }
                                                onClick={() =>
                                                  playAudio(
                                                    hotspot.audio,
                                                    label,
                                                  )
                                                }
                                              >
                                                <b aria-hidden="true">
                                                  {isActive && isPlaying
                                                    ? "Ⅱ"
                                                    : "▶"}
                                                </b>
                                                <span>{label}</span>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
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
                <div className="hint-controls" aria-label="提示顯示方式">
                  <span>提示</span>
                  {(
                    [
                      ["full", "完整"],
                      ["romanization", "台羅"],
                      ["challenge", "挑戰"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      className={hintMode === value ? "active" : ""}
                      onClick={() => {
                        setHintMode(value);
                        setRevealedWords(new Set());
                      }}
                    >
                      {label}
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
                    const manuallyRevealed = revealedWords.has(entry.id);
                    const showRomanization =
                      hintMode !== "challenge" || manuallyRevealed;
                    const showMeaning =
                      hintMode === "full" || manuallyRevealed;
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
                          <i>
                            {showRomanization
                              ? entry.romanization || "—"
                              : "台羅提示已收起"}
                          </i>
                        </div>
                        <button
                          className={`entry-meaning ${showMeaning ? "revealed" : ""}`}
                          onClick={() => {
                            const next = new Set(revealedWords);
                            if (manuallyRevealed) next.delete(entry.id);
                            else next.add(entry.id);
                            setRevealedWords(next);
                          }}
                        >
                          <span>
                            {showMeaning ? entry.meaning : "按一下看華語"}
                          </span>
                          <small>
                            {showMeaning && entry.examples
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
                <div className="hint-controls" aria-label="提示顯示方式">
                  <span>提示</span>
                  {(
                    [
                      ["full", "完整"],
                      ["romanization", "台羅"],
                      ["challenge", "挑戰"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      className={hintMode === value ? "active" : ""}
                      onClick={() => {
                        setHintMode(value);
                        setRevealedSentences(new Set());
                      }}
                    >
                      {label}
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
                  .map((sentence) => {
                    const manuallyRevealed = revealedSentences.has(sentence.id);
                    const showRomanization =
                      hintMode !== "challenge" || manuallyRevealed;
                    const showMeaning =
                      hintMode === "full" || manuallyRevealed;
                    return (
                      <article key={sentence.id}>
                        <span className="sentence-topic">
                          {sentence.volume === "上冊" ? "上" : "下"} ·
                          {chapterName(sentence.chapter)}
                        </span>
                        <div className="sentence-copy">
                          <strong>{sentence.hanji}</strong>
                          <i>
                            {showRomanization
                              ? sentence.lomaji
                              : "台羅提示已收起"}
                          </i>
                        </div>
                        <button
                          className={`sentence-meaning ${
                            showMeaning ? "revealed" : ""
                          }`}
                          onClick={() => {
                            const next = new Set(revealedSentences);
                            if (manuallyRevealed) next.delete(sentence.id);
                            else next.add(sentence.id);
                            setRevealedSentences(next);
                          }}
                        >
                          {showMeaning ? sentence.huagi : "按一下看華語"}
                        </button>
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
                    );
                  })}
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

          {mode === "games" && (
            <div className="database-mode game-mode section-pad">
              <header className="database-head">
                <div>
                  <p className="eyebrow">PLAYGROUND / REAL VOICES</p>
                  <h2>台語練功房</h2>
                </div>
                <p>
                  每一題都直接使用教材裡的真人錄音與正式語料。
                  程度愈高，畫面提供的文字提示愈少。
                </p>
              </header>

              <div
                className="game-console"
                style={
                  { "--level-color": learnerProfile.color } as CSSProperties
                }
              >
                <aside className="game-menu">
                  <header>
                    <span>揀一款</span>
                    <strong>GAME SELECT</strong>
                  </header>
                  <button
                    className={gameKind === "listening" ? "active" : ""}
                    onClick={() => startGame("listening", gameRound?.id)}
                  >
                    <span>01</span>
                    <strong>聽音揣意思</strong>
                    <small>真人語句 → 華語</small>
                  </button>
                  <button
                    className={gameKind === "word" ? "active" : ""}
                    onClick={() => startGame("word", gameRound?.id)}
                  >
                    <span>02</span>
                    <strong>語詞對對碰</strong>
                    <small>台語詞 → 華語</small>
                  </button>
                  <footer>
                    <span>目前難度</span>
                    <strong>{learnerProfile.name}</strong>
                    <small>{learnerProfile.pace}</small>
                  </footer>
                </aside>

                <article
                  className={`quiz-machine ${
                    gameChoice
                      ? gameChoice === gameRound?.answer
                        ? "is-correct"
                        : "is-wrong"
                      : ""
                  }`}
                >
                  <header className="game-scorebar">
                    <div>
                      <span>SCORE</span>
                      <strong>{String(gameStats.score).padStart(4, "0")}</strong>
                    </div>
                    <div>
                      <span>連勝</span>
                      <strong>{gameStats.streak}</strong>
                    </div>
                    <div>
                      <span>最高</span>
                      <strong>{gameStats.bestStreak}</strong>
                    </div>
                    <button onClick={resetGameStats}>歸零</button>
                  </header>

                  {gameRound ? (
                    <>
                      <div className="quiz-prompt">
                        <span>
                          {gameKind === "listening"
                            ? "聽真人發音，揣出正確意思"
                            : "看台語詞，揣出正確意思"}
                        </span>
                        <button
                          className="game-listen"
                          onClick={() =>
                            playAudio(gameRound.audio, gameRound.prompt)
                          }
                          disabled={!gameRound.audio}
                          aria-label={`播放題目：${gameRound.prompt}`}
                        >
                          <b>{isPlaying ? "Ⅱ" : "▶"}</b>
                          <small>聽題目</small>
                        </button>
                        {gameKind === "word" ||
                        learnerLevel === "starter" ||
                        gameChoice ? (
                          <h3>{gameRound.prompt}</h3>
                        ) : (
                          <h3 className="hidden-prompt">先聽，莫看文字</h3>
                        )}
                        {(learnerLevel === "starter" || gameChoice) && (
                          <i>{gameRound.romanization}</i>
                        )}
                        <div className="sound-bars" aria-hidden="true">
                          {Array.from({ length: 11 }, (_, index) => (
                            <span key={index} />
                          ))}
                        </div>
                      </div>

                      <div className="quiz-options">
                        {gameRound.options.map((option, index) => {
                          const correct =
                            gameChoice && option.id === gameRound.answer;
                          const wrong =
                            gameChoice === option.id &&
                            option.id !== gameRound.answer;
                          return (
                            <button
                              key={option.id}
                              className={`${correct ? "correct" : ""} ${
                                wrong ? "wrong" : ""
                              }`}
                              onClick={() => answerGame(option.id)}
                              disabled={Boolean(gameChoice)}
                            >
                              <span>
                                {String.fromCharCode(65 + index)}
                              </span>
                              <strong>{option.label}</strong>
                              <b aria-hidden="true">
                                {correct ? "✓" : wrong ? "×" : "→"}
                              </b>
                            </button>
                          );
                        })}
                      </div>

                      <footer className="game-feedback" aria-live="polite">
                        {!gameChoice ? (
                          <>
                            <span>準備好了無？</span>
                            <strong>
                              {gameKind === "listening"
                                ? "可以重播，聽清楚才作答。"
                                : "先讀台文，再想華語意思。"}
                            </strong>
                          </>
                        ) : gameChoice === gameRound.answer ? (
                          <>
                            <span>答著矣！ +{10 + (gameStats.streak - 1) * 2}</span>
                            <strong>
                              {gameRound.prompt} · {gameRound.answer}
                            </strong>
                          </>
                        ) : (
                          <>
                            <span>差一屑仔</span>
                            <strong>
                              正確答案：{gameRound.answer}
                            </strong>
                          </>
                        )}
                        {gameChoice && (
                          <button
                            onClick={() =>
                              startGame(gameKind, gameRound.id)
                            }
                          >
                            下一題 →
                          </button>
                        )}
                      </footer>
                    </>
                  ) : (
                    <div className="game-loading">
                      <span>LOADING</span>
                      <strong>咧準備教材題目⋯</strong>
                      <button onClick={() => startGame(gameKind)}>
                        開始出題 →
                      </button>
                    </div>
                  )}
                </article>

                <aside className="game-ledger">
                  <header>PLAY RECORD</header>
                  <dl>
                    <div>
                      <dt>答題</dt>
                      <dd>{gameStats.answered}</dd>
                    </div>
                    <div>
                      <dt>總分</dt>
                      <dd>{gameStats.score}</dd>
                    </div>
                    <div>
                      <dt>最高連勝</dt>
                      <dd>{gameStats.bestStreak}</dd>
                    </div>
                  </dl>
                  <p>
                    初學會顯示台文與台羅；生活程度先收起華語；
                    進階聽力題只播放聲音。
                  </p>
                </aside>
              </div>
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
        <div
          className="audio-dock"
          role="region"
          aria-label="發音播放器"
          aria-live="polite"
        >
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
