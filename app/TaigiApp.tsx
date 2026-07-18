"use client";

import {
  CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Volume = "上冊" | "下冊";

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
const RAW_AUDIO_ROOT =
  "https://raw.githubusercontent.com/Taiwanese-Corpus/Lan-Lai-Oh-Taigi/master/mp3/03";

const fallbackSentence: Sentence = {
  id: "上冊-0301_01_01_03.mp3",
  page: "3",
  chapter: "一人際",
  order: 1,
  hanji: "多謝你！",
  lomaji: "To-siā--lí!",
  huagi: "謝謝你！",
  audio: "0301_01_01_03.mp3",
  volume: "上冊",
};

const materials = [
  {
    no: "01",
    symbol: "聲",
    title: "學拼音有撇步",
    subtitle: "Phing-im",
    href: `${SOURCE_ROOT}/blob/master/pdf/01%E6%8B%BC%E9%9F%B3.pdf`,
  },
  {
    no: "02",
    symbol: "詞",
    title: "學語詞真輕鬆",
    subtitle: "Gí-sû",
    href: `${SOURCE_ROOT}/blob/master/pdf/02%E8%AA%9E%E8%A9%9E1.pdf`,
  },
  {
    no: "03",
    symbol: "句",
    title: "讀語句上簡單",
    subtitle: "Kù",
    href: `${SOURCE_ROOT}/blob/master/pdf/03%E8%AA%9E%E5%8F%A51.pdf`,
  },
  {
    no: "04",
    symbol: "文",
    title: "讀文章蓋趣味",
    subtitle: "Bûn",
    href: `${SOURCE_ROOT}/blob/master/pdf/04%E6%96%87%E7%AB%A01.pdf`,
  },
];

const waveHeights = [
  13, 24, 35, 18, 29, 11, 33, 21, 38, 26, 14, 31, 19, 34, 16, 27, 38, 22,
  13, 30, 18, 35, 25, 12, 28, 20, 37, 16, 31, 23, 11, 34, 19, 29, 15, 36,
];

function parseCsvLine(line: string) {
  const values: string[] = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const character = line[i];
    if (character === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"';
        i += 1;
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

function parseCsv(text: string, volume: Volume): Sentence[] {
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

function chapterLabel(chapter: string) {
  return chapter.replace(
    /^(十一|十二|十三|十四|十五|十六|十|一|二|三|四|五|六|七|八|九)/,
    "",
  );
}

function chapterEmoji(chapter: string) {
  if (chapter.includes("人際")) return "👋";
  if (chapter.includes("交通")) return "🚌";
  if (chapter.includes("食物")) return "🍚";
  if (chapter.includes("動作")) return "🏃";
  if (chapter.includes("徛家")) return "🏠";
  if (chapter.includes("天文")) return "🌤";
  if (chapter.includes("用品")) return "🧺";
  if (chapter.includes("娛樂")) return "🎵";
  if (chapter.includes("行業")) return "🛠";
  if (chapter.includes("品行")) return "🙂";
  if (chapter.includes("思想")) return "💭";
  if (chapter.includes("時間")) return "🕰";
  if (chapter.includes("動物")) return "🌿";
  if (chapter.includes("教育")) return "📚";
  if (chapter.includes("經濟")) return "🪙";
  return "🩺";
}

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function loadSet(key: string) {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(key) ?? "[]"));
  } catch {
    return new Set<string>();
  }
}

export function TaigiApp() {
  const [sentences, setSentences] = useState<Sentence[]>([fallbackSentence]);
  const [current, setCurrent] = useState<Sentence>(fallbackSentence);
  const [search, setSearch] = useState("");
  const [volume, setVolume] = useState<"全部" | Volume>("全部");
  const [chapter, setChapter] = useState("全部");
  const [showRomanization, setShowRomanization] = useState(true);
  const [showTranslation, setShowTranslation] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [quizSentence, setQuizSentence] =
    useState<Sentence>(fallbackSentence);
  const [quizOptions, setQuizOptions] = useState<string[]>([
    "謝謝你！",
    "你好嗎？",
    "明天見！",
  ]);
  const [quizAnswer, setQuizAnswer] = useState<string | null>(null);
  const [quizScore, setQuizScore] = useState({ right: 0, total: 0 });
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    Promise.all([
      fetch("./data/3-1.csv").then((response) => response.text()),
      fetch("./data/3-2.csv").then((response) => response.text()),
    ])
      .then(([volumeOne, volumeTwo]) => {
        const parsed = [
          ...parseCsv(volumeOne, "上冊"),
          ...parseCsv(volumeTwo, "下冊"),
        ];
        if (parsed.length > 0) {
          setSentences(parsed);
          setCurrent(parsed[0]);
        }
      })
      .catch(() => {
        setSentences([fallbackSentence]);
      });

    setFavorites(loadSet("opentaigi-favorites"));
    setCompleted(loadSet("opentaigi-completed"));
  }, []);

  const chapters = useMemo(
    () => Array.from(new Set(sentences.map((sentence) => sentence.chapter))),
    [sentences],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return sentences.filter((sentence) => {
      const matchesVolume =
        volume === "全部" || sentence.volume === volume;
      const matchesChapter =
        chapter === "全部" || sentence.chapter === chapter;
      const matchesSearch =
        !query ||
        `${sentence.hanji} ${sentence.lomaji} ${sentence.huagi}`
          .toLocaleLowerCase()
          .includes(query);
      return matchesVolume && matchesChapter && matchesSearch;
    });
  }, [chapter, search, sentences, volume]);

  const makeQuiz = useCallback(
    (source?: Sentence) => {
      if (sentences.length < 3) return;
      const next =
        source ??
        sentences[Math.floor(Math.random() * sentences.length)] ??
        fallbackSentence;
      const distractors = shuffle(
        sentences
          .filter(
            (sentence) =>
              sentence.id !== next.id && sentence.huagi !== next.huagi,
          )
          .map((sentence) => sentence.huagi),
      ).slice(0, 2);
      setQuizSentence(next);
      setQuizOptions(shuffle([next.huagi, ...distractors]));
      setQuizAnswer(null);
    },
    [sentences],
  );

  useEffect(() => {
    if (sentences.length > 3) makeQuiz(sentences[3]);
  }, [makeQuiz, sentences]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.playbackRate = speed;
    }
    setIsPlaying(false);
  }, [current.id, speed]);

  const audioUrl = `${RAW_AUDIO_ROOT}/${current.volume === "上冊" ? "01" : "02"}/${current.audio}`;

  function persistSet(key: string, value: Set<string>) {
    localStorage.setItem(key, JSON.stringify(Array.from(value)));
  }

  function toggleFavorite() {
    const next = new Set(favorites);
    if (next.has(current.id)) next.delete(current.id);
    else next.add(current.id);
    setFavorites(next);
    persistSet("opentaigi-favorites", next);
  }

  function markCompleted(sentence: Sentence) {
    const next = new Set(completed);
    next.add(sentence.id);
    setCompleted(next);
    persistSet("opentaigi-completed", next);
  }

  function nextLesson() {
    const collection = filtered.length > 0 ? filtered : sentences;
    const currentIndex = collection.findIndex(
      (sentence) => sentence.id === current.id,
    );
    const nextIndex =
      currentIndex < 0 ? 0 : (currentIndex + 1) % collection.length;
    markCompleted(current);
    setCurrent(collection[nextIndex] ?? fallbackSentence);
    document
      .querySelector("#learn")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function chooseSentence(sentence: Sentence) {
    setCurrent(sentence);
    document
      .querySelector("#learn")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function toggleAudio() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = speed;
    if (audio.paused) {
      audio.play().then(() => setIsPlaying(true)).catch(() => {
        setIsPlaying(false);
      });
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }

  function answerQuiz(option: string) {
    if (quizAnswer) return;
    setQuizAnswer(option);
    setQuizScore((score) => ({
      right: score.right + Number(option === quizSentence.huagi),
      total: score.total + 1,
    }));
    if (option === quizSentence.huagi) markCompleted(quizSentence);
  }

  const completionPercent = Math.min(
    100,
    Math.round((completed.size / Math.max(sentences.length, 1)) * 100),
  );

  return (
    <div className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="咱來學台語首頁">
          <span className="brand-mark" aria-hidden="true">
            台
          </span>
          <span className="brand-copy">
            <strong>咱來學台語</strong>
            <small>LÁN LÂI O̍H TÂI-GÍ</small>
          </span>
        </a>
        <nav className="desktop-nav" aria-label="主要選單">
          <a href="#learn">開始學習</a>
          <a href="#library">語句庫</a>
          <a href="#materials">教材</a>
        </nav>
        <a className="start-button" href="#learn">
          今仔日學一句
        </a>
      </header>

      <main id="top">
        <section className="hero page-width" aria-labelledby="hero-title">
          <div>
            <p className="eyebrow">台語，就從今仔日開始</p>
            <h1 id="hero-title">
              一句一句，
              <br />
              <span className="accent">講出</span>台語。
            </h1>
            <p className="hero-description">
              把教育部《咱來學臺灣閩南語》變成隨身互動教材。
              聽發音、看羅馬字、做小測驗，每工十分鐘，愈講愈自然。
            </p>
            <div className="hero-actions">
              <a className="primary-button" href="#learn">
                <span aria-hidden="true">▶</span> 開始今仔日課程
              </a>
              <a className="secondary-button" href="#library">
                瀏覽 840 句 <span aria-hidden="true">→</span>
              </a>
            </div>
            <div className="hero-notes" aria-label="網站特色">
              <span className="hero-note">
                <span>✓</span> 免費開放
              </span>
              <span className="hero-note">
                <span>✓</span> 真人發音
              </span>
              <span className="hero-note">
                <span>✓</span> 手機電腦攏好用
              </span>
            </div>
          </div>

          <div className="hero-visual" aria-label="今日台語預覽">
            <div className="float-chip top">
              <span className="float-icon" aria-hidden="true">
                🔊
              </span>
              <span>聽・唸・閣聽一擺</span>
            </div>
            <div className="phrase-poster">
              <div className="poster-top">
                <span>今仔日一句</span>
                <span className="poster-tag">人際</span>
              </div>
              <div className="poster-main">
                <small>To-siā--lí!</small>
                <h2>多謝你！</h2>
                <p>謝謝你！</p>
              </div>
              <div className="poster-bottom">
                <button
                  className="poster-play"
                  type="button"
                  aria-label="播放多謝你發音"
                  onClick={() => {
                    setCurrent(fallbackSentence);
                    window.setTimeout(toggleAudio, 0);
                  }}
                >
                  ▶
                </button>
                <div className="poster-progress">
                  <span>今日進度 2 / 5</span>
                  <span className="mini-track">
                    <i />
                  </span>
                </div>
              </div>
            </div>
            <div className="float-chip bottom">
              <span className="float-icon" aria-hidden="true">
                🌱
              </span>
              <span>每日 10 分鐘</span>
            </div>
          </div>
        </section>

        <section
          className="learning-section"
          id="learn"
          aria-labelledby="learn-title"
        >
          <div className="learning-inner">
            <p className="section-kicker">TSIT KÙ / 這一句</p>
            <div className="section-heading">
              <h2 id="learn-title">先聽，再開喙講。</h2>
              <p>
                按播放聽真人發音，切換羅馬字與華語提示。聽熟了就按下一句，
                進度會留在這台裝置。
              </p>
            </div>

            <div className="learning-grid">
              <article className="lesson-card" aria-live="polite">
                <div className="lesson-toolbar">
                  <div className="lesson-meta">
                    <span className="tag">
                      {chapterEmoji(current.chapter)}{" "}
                      {chapterLabel(current.chapter)}
                    </span>
                    <span className="tag alt">{current.volume}</span>
                  </div>
                  <button
                    className={`icon-button ${favorites.has(current.id) ? "active" : ""}`}
                    type="button"
                    aria-label={
                      favorites.has(current.id) ? "取消收藏" : "收藏這一句"
                    }
                    aria-pressed={favorites.has(current.id)}
                    onClick={toggleFavorite}
                  >
                    {favorites.has(current.id) ? "★" : "☆"}
                  </button>
                </div>

                <div className="sentence-stage">
                  <h3>{current.hanji}</h3>
                  <p className="romanization">
                    {showRomanization ? (
                      current.lomaji
                    ) : (
                      <span className="hidden-line" aria-label="羅馬字已隱藏" />
                    )}
                  </p>
                  <p className="translation">
                    {showTranslation ? (
                      current.huagi
                    ) : (
                      <span className="hidden-line" aria-label="華語已隱藏" />
                    )}
                  </p>
                </div>

                <div className="audio-console">
                  <button
                    className="audio-play"
                    type="button"
                    aria-label={isPlaying ? "暫停發音" : "播放發音"}
                    onClick={toggleAudio}
                  >
                    {isPlaying ? "Ⅱ" : "▶"}
                  </button>
                  <div
                    className={`waveform ${isPlaying ? "playing" : ""}`}
                    aria-hidden="true"
                  >
                    {waveHeights.map((height, index) => (
                      <i
                        key={`${height}-${index}`}
                        style={
                          {
                            "--wave-height": `${height}px`,
                            "--wave-delay": `${(index % 8) * -70}ms`,
                          } as CSSProperties
                        }
                      />
                    ))}
                  </div>
                  <div className="speed-controls" aria-label="播放速度">
                    {[0.75, 1, 1.25].map((rate) => (
                      <button
                        className={speed === rate ? "active" : ""}
                        type="button"
                        key={rate}
                        aria-pressed={speed === rate}
                        onClick={() => setSpeed(rate)}
                      >
                        {rate}×
                      </button>
                    ))}
                  </div>
                  <audio
                    ref={audioRef}
                    src={audioUrl}
                    preload="none"
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => {
                      setIsPlaying(false);
                      markCompleted(current);
                    }}
                  />
                </div>

                <div className="lesson-actions">
                  <div className="view-toggles">
                    <button
                      className={`toggle-button ${showRomanization ? "active" : ""}`}
                      type="button"
                      aria-pressed={showRomanization}
                      onClick={() => setShowRomanization((visible) => !visible)}
                    >
                      羅馬字
                    </button>
                    <button
                      className={`toggle-button ${showTranslation ? "active" : ""}`}
                      type="button"
                      aria-pressed={showTranslation}
                      onClick={() => setShowTranslation((visible) => !visible)}
                    >
                      華語提示
                    </button>
                  </div>
                  <button
                    className="next-button"
                    type="button"
                    onClick={nextLesson}
                  >
                    我會曉矣，下一句 →
                  </button>
                </div>
              </article>

              <aside className="quiz-card" aria-labelledby="quiz-title">
                <div className="quiz-head">
                  <div className="quiz-label">
                    <span aria-hidden="true">✦</span>
                    <span id="quiz-title">隨堂小練習</span>
                  </div>
                  <span className="score-pill">
                    答著 {quizScore.right}/{quizScore.total}
                  </span>
                </div>

                <div className="quiz-prompt">
                  <small>這句是啥物意思？</small>
                  <h3>{quizSentence.hanji}</h3>
                </div>

                <div className="quiz-options">
                  {quizOptions.map((option, index) => {
                    const isCorrect = option === quizSentence.huagi;
                    const isWrong =
                      quizAnswer === option && option !== quizSentence.huagi;
                    return (
                      <button
                        className={`quiz-option ${
                          quizAnswer && isCorrect ? "correct" : ""
                        } ${isWrong ? "wrong" : ""}`}
                        type="button"
                        key={`${option}-${index}`}
                        disabled={Boolean(quizAnswer)}
                        onClick={() => answerQuiz(option)}
                      >
                        {option}
                        <span className="quiz-option-mark">
                          {quizAnswer && isCorrect
                            ? "✓"
                            : isWrong
                              ? "×"
                              : String.fromCharCode(65 + index)}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <p className="quiz-feedback" role="status">
                  {quizAnswer ? (
                    quizAnswer === quizSentence.huagi ? (
                      <>
                        <strong>誠𠢕！答著矣。</strong>
                        <br />
                        {quizSentence.lomaji}
                      </>
                    ) : (
                      <>
                        正確答案是「{quizSentence.huagi}」。
                        <br />
                        閣看一擺羅馬字：{quizSentence.lomaji}
                      </>
                    )
                  ) : (
                    "揀一个上適合的華語意思。"
                  )}
                </p>

                <button
                  className="next-button quiz-next"
                  type="button"
                  onClick={() => makeQuiz()}
                >
                  換一題 →
                </button>
              </aside>
            </div>
          </div>
        </section>

        <section
          className="section page-width"
          id="library"
          aria-labelledby="library-title"
        >
          <p className="section-kicker">840 KÙ / 840 句</p>
          <div className="section-heading">
            <h2 id="library-title">生活語句，隨時揣。</h2>
            <p>
              從人際、食物、交通到健康，共 16 類。可用漢字、羅馬字或華語搜尋，
              點一句就開始聽。
            </p>
          </div>

          <div className="library-controls">
            <label className="search-field">
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                value={search}
                placeholder="搜尋：多謝、食飯、tshē..."
                aria-label="搜尋台語語句"
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <select
              className="volume-select"
              value={volume}
              aria-label="選擇冊別"
              onChange={(event) =>
                setVolume(event.target.value as "全部" | Volume)
              }
            >
              <option value="全部">頂下冊攏總</option>
              <option value="上冊">上冊</option>
              <option value="下冊">下冊</option>
            </select>
          </div>

          <div className="chapter-scroller" aria-label="生活主題">
            <button
              className={`chapter-chip ${chapter === "全部" ? "active" : ""}`}
              type="button"
              aria-pressed={chapter === "全部"}
              onClick={() => setChapter("全部")}
            >
              全部主題
            </button>
            {chapters.map((item) => (
              <button
                className={`chapter-chip ${chapter === item ? "active" : ""}`}
                type="button"
                aria-pressed={chapter === item}
                key={item}
                onClick={() => setChapter(item)}
              >
                {chapterEmoji(item)} {chapterLabel(item)}
              </button>
            ))}
          </div>

          <div className="library-grid">
            {filtered.slice(0, 12).map((sentence) => (
              <button
                className={`phrase-card ${
                  current.id === sentence.id ? "active" : ""
                }`}
                type="button"
                key={sentence.id}
                onClick={() => chooseSentence(sentence)}
              >
                <small>
                  {sentence.volume}・{chapterLabel(sentence.chapter)}・
                  {sentence.order}
                </small>
                <h3>{sentence.hanji}</h3>
                <p>{sentence.lomaji}</p>
                <footer>
                  <span>{sentence.huagi}</span>
                  <span
                    className={
                      completed.has(sentence.id) ? "completed-dot" : ""
                    }
                  >
                    {completed.has(sentence.id) ? "✓ 已學" : "▶ 聽看覓"}
                  </span>
                </footer>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="empty-state">
                <strong>揣無這句</strong>
                <p>換一个關鍵字，抑是選「全部主題」閣試一擺。</p>
              </div>
            )}
          </div>
          <p className="result-count">
            顯示 {Math.min(filtered.length, 12)} 句，共 {filtered.length} 句符合
            ・ 已學 {completed.size} 句（{completionPercent}%）・ 收藏{" "}
            {favorites.size} 句
          </p>
        </section>

        <section
          className="section page-width materials-section"
          id="materials"
          aria-labelledby="materials-title"
        >
          <p className="section-kicker">SIŌNG KHÂN / 教材冊</p>
          <div className="section-heading">
            <h2 id="materials-title">四階段，練好台語。</h2>
            <p>
              從聲音、語詞、語句一路讀到文章。點開原始教材 PDF，
              搭配本站互動語句練習。
            </p>
          </div>

          <div className="material-grid">
            {materials.map((material) => (
              <a
                className="material-card"
                href={material.href}
                target="_blank"
                rel="noreferrer"
                key={material.no}
              >
                <span className="material-number">STEP {material.no}</span>
                <span className="material-symbol" aria-hidden="true">
                  {material.symbol}
                </span>
                <h3>{material.title}</h3>
                <p>{material.subtitle}</p>
                <span className="material-arrow" aria-hidden="true">
                  ↗
                </span>
              </a>
            ))}
          </div>

          <div className="source-banner">
            <div>
              <h3>教材有根據，內容可追溯</h3>
              <p>
                本站整理自教育部《咱來學臺灣閩南語》與
                Taiwanese-Corpus 公開資料庫；語句、羅馬字與發音皆保留來源。
              </p>
            </div>
            <div className="source-links">
              <a href={SOURCE_ROOT} target="_blank" rel="noreferrer">
                GitHub 資料源 ↗
              </a>
              <a
                href="https://language.moe.gov.tw/uploads/files/17580025581006.pdf"
                target="_blank"
                rel="noreferrer"
              >
                教育部手冊 ↗
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div>
          <div className="footer-brand">咱來學台語</div>
          <div>Lán lâi o̍h Tâi-gí — 台語，咱做伙講。</div>
        </div>
        <div>
          教材內容來源：教育部、Taiwanese-Corpus
          <br />
          學習進度僅儲存在你的裝置
        </div>
      </footer>

      <nav className="mobile-nav" aria-label="手機快速選單">
        <a href="#learn">
          <span aria-hidden="true">▶</span>學一句
        </a>
        <a href="#library">
          <span aria-hidden="true">⌕</span>語句庫
        </a>
        <a href="#materials">
          <span aria-hidden="true">冊</span>教材
        </a>
      </nav>
    </div>
  );
}
