#!/usr/bin/env python3
"""Build the complete interactive curriculum from the source PDFs.

The PDFs contain URI annotations around every playable phrase. This script
renders each spread and preserves those annotations as responsive HTML hotspot
coordinates, so no printed content or audio cue is lost in the web edition.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import tempfile
import unicodedata
from collections import defaultdict
from pathlib import Path
from urllib.parse import quote, unquote, urlparse

import pdfplumber
from pypdf import PdfReader


REPO_ROOT = Path(__file__).resolve().parents[1]
PUBLIC_ROOT = REPO_ROOT / "public"
DATA_ROOT = PUBLIC_ROOT / "data"
BOOK_ROOT = PUBLIC_ROOT / "books"
RAW_ROOT = (
    "https://raw.githubusercontent.com/"
    "Taiwanese-Corpus/Lan-Lai-Oh-Taigi/master"
)

# Two source-PDF links point to filenames that do not exist in the archive.
# Route them to the matching recorded item instead of leaving dead controls.
AUDIO_ALIASES = {
    ("01/01", "0101-28-tshiuo.mp3"): "0101-28-tshio.mp3",
    ("02/01", "0201_476_A.mp3"): "0201_476_B.mp3",
}

BOOKS = [
    {
        "id": "pronunciation",
        "number": "01",
        "series": "拼音",
        "title": "學拼音有撇步",
        "subtitle": "Ha̍k phing-im ū phiat-pōo",
        "pdf": "01拼音.pdf",
        "audio": "01/01",
        "accent": "#8076B5",
        "description": "聲母、韻母、聲調與變調，用原頁發音熱點逐項練習。",
    },
    {
        "id": "vocabulary-1",
        "number": "02·上",
        "series": "語詞",
        "title": "學語詞真輕鬆",
        "subtitle": "Siōng-chheh",
        "pdf": "02語詞1.pdf",
        "audio": "02/01",
        "accent": "#877461",
        "description": "上冊生活語詞，含詞義、例詞與真人發音。",
    },
    {
        "id": "vocabulary-2",
        "number": "02·下",
        "series": "語詞",
        "title": "學語詞真輕鬆",
        "subtitle": "Ē-chheh",
        "pdf": "02語詞2.pdf",
        "audio": "02/02",
        "accent": "#877461",
        "description": "下冊生活語詞，接續擴充常用詞彙。",
    },
    {
        "id": "sentences-1",
        "number": "03·上",
        "series": "語句",
        "title": "讀語句上簡單",
        "subtitle": "Siōng-chheh",
        "pdf": "03語句1.pdf",
        "audio": "03/01",
        "accent": "#D6A622",
        "description": "上冊 420 句生活台語，依主題聽讀與跟講。",
    },
    {
        "id": "sentences-2",
        "number": "03·下",
        "series": "語句",
        "title": "讀語句上簡單",
        "subtitle": "Ē-chheh",
        "pdf": "03語句2.pdf",
        "audio": "03/02",
        "accent": "#D6A622",
        "description": "下冊 420 句生活台語，完整保留課本編排。",
    },
    {
        "id": "articles-1",
        "number": "04·上",
        "series": "文章",
        "title": "讀文章蓋趣味",
        "subtitle": "Siōng-chheh",
        "pdf": "04文章1.pdf",
        "audio": "04/01",
        "accent": "#D77A3D",
        "description": "上冊短文、語詞解說與逐段真人發音。",
    },
    {
        "id": "articles-2",
        "number": "04·下",
        "series": "文章",
        "title": "讀文章蓋趣味",
        "subtitle": "Ē-chheh",
        "pdf": "04文章2.pdf",
        "audio": "04/02",
        "accent": "#D77A3D",
        "description": "下冊閱讀篇章，從原頁直接點讀內容。",
    },
    {
        "id": "supplement",
        "number": "附",
        "series": "補充",
        "title": "主管機關補充資料",
        "subtitle": "Chham-khó",
        "pdf": "tsuguan-book.pdf",
        "audio": None,
        "accent": "#2F6B54",
        "description": "原教材附錄與出版資訊。",
    },
]


def normalized_filename(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).casefold()
    return re.sub(r"[^a-z0-9]", "", value)


def uri_filename(uri: str) -> str:
    return Path(unquote(urlparse(uri).path)).name


def clean_text(value: str | None) -> str:
    if not value:
        return ""
    value = value.replace("\u00ad", "").replace("\n", " ")
    return re.sub(r"\s+", " ", value).strip(" \u3000")


def annotation_label(
    plumber_page: pdfplumber.page.Page,
    bbox: tuple[float, float, float, float],
    fallback: str,
) -> str:
    x0, top, x1, bottom = bbox
    padding = 2
    crop = (
        max(0, x0 - padding),
        max(0, top - padding),
        min(plumber_page.width, x1 + padding),
        min(plumber_page.height, bottom + padding),
    )
    try:
        label = clean_text(plumber_page.crop(crop).extract_text())
    except Exception:
        label = ""
    return label or fallback


def audio_index(source_root: Path, relative_dir: str | None):
    if not relative_dir:
        return {}, {}
    directory = source_root / "mp3" / relative_dir
    exact = {item.name: item for item in directory.glob("*.mp3")}
    normalized: dict[str, list[Path]] = defaultdict(list)
    for item in exact.values():
        normalized[normalized_filename(item.name)].append(item)
    return exact, normalized


def resolve_audio(
    requested: str,
    source_root: Path,
    relative_dir: str | None,
    exact: dict[str, Path],
    normalized: dict[str, list[Path]],
) -> tuple[str, str, bool]:
    alias = AUDIO_ALIASES.get((relative_dir or "", requested), requested)
    chosen = exact.get(alias)
    if chosen is None:
        candidates = normalized.get(normalized_filename(requested), [])
        if len(candidates) == 1:
            chosen = candidates[0]
    actual_filename = chosen.name if chosen else requested
    if not relative_dir:
        return requested, "", False
    url = f"{RAW_ROOT}/mp3/{relative_dir}/{quote(actual_filename)}"
    return requested, url, chosen is not None


def render_book(
    pdf_path: Path,
    output_dir: Path,
    expected_pages: int,
    force: bool = False,
):
    output_dir.mkdir(parents=True, exist_ok=True)
    existing = list(output_dir.glob("page-*.webp"))
    if len(existing) == expected_pages and not force:
        return
    for item in existing:
        item.unlink()
    with tempfile.TemporaryDirectory(prefix="opentaigi-pages-") as temp_dir:
        pattern = Path(temp_dir) / "page-%03d.jpg"
        subprocess.run(
            [
                "gs",
                "-q",
                "-dSAFER",
                "-dBATCH",
                "-dNOPAUSE",
                "-sDEVICE=jpeg",
                "-r150",
                "-dJPEGQ=88",
                f"-sOutputFile={pattern}",
                str(pdf_path),
            ],
            check=True,
            stderr=subprocess.DEVNULL,
        )
        rendered = sorted(Path(temp_dir).glob("page-*.jpg"))
        if len(rendered) != expected_pages:
            raise RuntimeError(
                f"{pdf_path.name}: expected {expected_pages} pages, got {len(rendered)}"
            )
        for index, jpeg in enumerate(rendered, start=1):
            target = output_dir / f"page-{index:03d}.webp"
            subprocess.run(
                [
                    "magick",
                    str(jpeg),
                    "-strip",
                    "-quality",
                    "82",
                    "-define",
                    "webp:method=5",
                    str(target),
                ],
                check=True,
            )


def parse_vocabulary_line(
    page: pdfplumber.page.Page,
    top: float,
    bottom: float,
    x0: float,
) -> tuple[str, str, str, str]:
    half_start = 0 if x0 < page.width / 2 else page.width / 2
    half_end = page.width / 2 if x0 < page.width / 2 else page.width
    words = page.extract_words()
    line = [
        word
        for word in words
        if word["x0"] >= half_start
        and word["x1"] <= half_end
        and word["bottom"] >= top - 2
        and word["top"] <= bottom + 2
    ]
    line.sort(key=lambda word: word["x0"])
    number = next(
        (word["text"] for word in line if re.fullmatch(r"\d{3}", word["text"])),
        "",
    )
    headword = "".join(
        word["text"]
        for word in line
        if half_start + 58 <= word["x0"] < half_start + 110
        and word["text"] != number
    )
    romanization = " ".join(
        word["text"]
        for word in line
        if half_start + 110 <= word["x0"] < half_start + 180
        and word["text"] != "華語"
    )
    meaning = "".join(
        word["text"]
        for word in line
        if word["x0"] >= half_start + 202 and word["text"] != "華語"
    )
    return (
        clean_text(number),
        clean_text(headword),
        clean_text(romanization),
        clean_text(meaning),
    )


def build(
    source_root: Path,
    skip_render: bool,
    force_render: bool = False,
    render_only: bool = False,
):
    DATA_ROOT.mkdir(parents=True, exist_ok=True)
    BOOK_ROOT.mkdir(parents=True, exist_ok=True)
    curriculum_books = []
    vocabulary = []
    totals = {"books": len(BOOKS), "pages": 0, "hotspots": 0, "audioFiles": 0}

    sentence_labels: dict[str, str] = {}
    for csv_name in ("3-1.csv", "3-2.csv"):
        rows = (DATA_ROOT / csv_name).read_text(encoding="utf-8-sig").splitlines()[1:]
        for row in rows:
            # Audio filename is always the final CSV field; Hanji is the fourth.
            parts = [part.strip('"') for part in re.split(r",(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)", row)]
            if len(parts) >= 7:
                sentence_labels[parts[-1]] = parts[3]

    for config in BOOKS:
        pdf_path = source_root / "pdf" / config["pdf"]
        if not pdf_path.exists():
            raise FileNotFoundError(pdf_path)
        reader = PdfReader(pdf_path)
        plumber = pdfplumber.open(pdf_path)
        page_count = len(reader.pages)
        output_dir = BOOK_ROOT / config["id"]
        if not skip_render:
            render_book(pdf_path, output_dir, page_count, force=force_render)
        if render_only:
            print(f"{config['id']}: rendered {page_count} pages")
            plumber.close()
            continue

        exact, normalized = audio_index(source_root, config["audio"])
        totals["audioFiles"] += len(exact)
        pages = []
        pending_vocab: dict[str, dict] = {}

        for page_index, (pdf_page, plumber_page) in enumerate(
            zip(reader.pages, plumber.pages), start=1
        ):
            is_vocabulary = config["id"].startswith("vocabulary-")
            text_page = (
                plumber_page.dedupe_chars(tolerance=1)
                if is_vocabulary
                else plumber_page
            )
            page_width = float(pdf_page.mediabox.width)
            page_height = float(pdf_page.mediabox.height)
            hotspots = []
            seen = set()
            for annot_index, annot_ref in enumerate(pdf_page.get("/Annots", [])):
                annot = annot_ref.get_object()
                action = annot.get("/A") or {}
                uri = str(action.get("/URI") or "")
                if not uri.lower().endswith(".mp3"):
                    continue
                requested = uri_filename(uri)
                rect = tuple(float(value) for value in annot["/Rect"])
                x0, y0, x1, y1 = rect
                top = page_height - y1
                bottom = page_height - y0
                dedupe_key = (
                    requested,
                    round(x0, 2),
                    round(top, 2),
                    round(x1, 2),
                    round(bottom, 2),
                )
                if dedupe_key in seen:
                    continue
                seen.add(dedupe_key)
                filename, audio_url, available = resolve_audio(
                    requested,
                    source_root,
                    config["audio"],
                    exact,
                    normalized,
                )
                fallback = sentence_labels.get(filename, "播放這段發音")
                label = (
                    annotation_label(
                        text_page,
                        (x0, top, x1, bottom),
                        fallback,
                    )
                    if is_vocabulary
                    else fallback
                )
                if filename in sentence_labels:
                    label = sentence_labels[filename]
                kind = "audio"
                if re.search(r"_A\.mp3$", filename, re.I):
                    kind = "headword"
                elif re.search(r"_B\.mp3$", filename, re.I):
                    kind = "example"
                hotspot = {
                    "id": f"{config['id']}-{page_index}-{annot_index}",
                    "label": label,
                    "filename": filename,
                    "audio": audio_url,
                    "available": available,
                    "kind": kind,
                    "x": round(x0 / page_width * 100, 4),
                    "y": round(top / page_height * 100, 4),
                    "width": round((x1 - x0) / page_width * 100, 4),
                    "height": round((bottom - top) / page_height * 100, 4),
                }
                hotspots.append(hotspot)

                if is_vocabulary:
                    match = re.search(r"_(\d{3})_([AB])\.mp3$", filename, re.I)
                    if match:
                        entry_number, part = match.groups()
                        key = f"{config['id']}-{entry_number}"
                        entry = pending_vocab.setdefault(
                            key,
                            {
                                "id": key,
                                "bookId": config["id"],
                                "volume": "上冊"
                                if config["id"].endswith("-1")
                                else "下冊",
                                "number": entry_number,
                                "page": page_index,
                                "headword": "",
                                "romanization": "",
                                "meaning": "",
                                "examples": "",
                                "audioA": "",
                                "audioB": "",
                            },
                        )
                        if part.upper() == "A":
                            number, headword, romanization, meaning = (
                                parse_vocabulary_line(
                                    text_page, top, bottom, x0
                                )
                            )
                            entry["number"] = number or entry_number
                            entry["headword"] = headword or label
                            entry["romanization"] = romanization
                            entry["meaning"] = meaning
                            entry["audioA"] = audio_url
                        else:
                            examples = label
                            if entry["meaning"] and examples.startswith(
                                entry["meaning"]
                            ):
                                examples = examples[len(entry["meaning"]) :].strip()
                            entry["examples"] = examples
                            entry["audioB"] = audio_url

            pages.append(
                {
                    "number": page_index,
                    "image": f"./books/{config['id']}/page-{page_index:03d}.webp",
                    "width": page_width,
                    "height": page_height,
                    "hotspots": hotspots,
                }
            )
            totals["hotspots"] += len(hotspots)

        plumber.close()
        totals["pages"] += page_count
        vocabulary.extend(
            entry
            for _, entry in sorted(pending_vocab.items())
            if entry["headword"]
        )
        curriculum_books.append(
            {
                key: value
                for key, value in config.items()
                if key not in {"pdf", "audio"}
            }
            | {
                "pdfFile": config["pdf"],
                "sourcePdf": (
                    "https://github.com/Taiwanese-Corpus/Lan-Lai-Oh-Taigi/"
                    f"blob/master/pdf/{quote(config['pdf'])}"
                ),
                "pageCount": page_count,
                "audioCount": len(exact),
                "pages": pages,
            }
        )
        print(
            f"{config['id']}: {page_count} pages, "
            f"{sum(len(page['hotspots']) for page in pages)} hotspots"
        )

    if render_only:
        return

    curriculum = {
        "title": "咱來學台語完整互動教材",
        "source": "Taiwanese-Corpus/Lan-Lai-Oh-Taigi",
        "stats": totals,
        "books": curriculum_books,
    }
    (DATA_ROOT / "curriculum.json").write_text(
        json.dumps(curriculum, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    (DATA_ROOT / "vocabulary.json").write_text(
        json.dumps(vocabulary, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(
        f"Complete: {totals['pages']} pages, {totals['hotspots']} hotspots, "
        f"{totals['audioFiles']} audio files, {len(vocabulary)} vocabulary entries"
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "source",
        nargs="?",
        type=Path,
        default=Path("/tmp/Lan-Lai-Oh-Taigi-source-019f73bd"),
    )
    parser.add_argument("--skip-render", action="store_true")
    parser.add_argument("--force-render", action="store_true")
    parser.add_argument("--render-only", action="store_true")
    args = parser.parse_args()
    source = args.source.expanduser().resolve()
    if not source.exists():
        raise FileNotFoundError(source)
    build(
        source,
        args.skip_render,
        force_render=args.force_render,
        render_only=args.render_only,
    )


if __name__ == "__main__":
    main()
