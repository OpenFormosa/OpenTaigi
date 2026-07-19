#!/usr/bin/env python3
"""Convert every source-PDF page into searchable HTML-ready text data.

The source PDFs use optional-content and clipping layers. Generic text
extractors read hidden or clipped-away content, which produces overlapping
sentences. PyMuPDF follows the visible page display list and provides each
visible text span with its position. This script reduces those spans to
line-level layout data plus mobile-friendly reading blocks.
"""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
from pathlib import Path

try:
    import pymupdf
except ImportError as error:  # pragma: no cover - only used by the build tool
    raise SystemExit(
        "PyMuPDF is required. Install it with `python -m pip install PyMuPDF`."
    ) from error


REPO_ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = REPO_ROOT / "public" / "data"


def normalize_space(value: str) -> str:
    value = value.replace("\u00ad", "")
    value = value.replace("Ø", "◆")
    value = re.sub(r"[ \t]+", " ", value)
    return value.strip()


def allowed_letter(character: str) -> bool:
    codepoint = ord(character)
    return (
        codepoint < 0x0250
        or 0x0300 <= codepoint <= 0x036F
        or 0x2E80 <= codepoint <= 0x2FFF
        or 0x3000 <= codepoint <= 0x30FF
        or 0x3100 <= codepoint <= 0x312F
        or 0x3400 <= codepoint <= 0x4DBF
        or 0x4E00 <= codepoint <= 0x9FFF
        or 0xF900 <= codepoint <= 0xFAFF
        or 0x20000 <= codepoint <= 0x2FA1F
    )


def is_suspicious(value: str) -> bool:
    letters = [
        character
        for character in value
        if unicodedata.category(character).startswith("L")
    ]
    if not letters:
        return False
    unusual = sum(not allowed_letter(character) for character in letters)
    return unusual / len(letters) > 0.28


def join_segments(
    segments: list[tuple[float, float, str]], font_size: float
) -> str:
    if not segments:
        return ""
    output = segments[0][2]
    previous_x1 = segments[0][1]
    for x0, x1, text in segments[1:]:
        gap = x0 - previous_x1
        previous = output[-1:] if output else ""
        following = text[:1]
        needs_space = gap > max(2.2, font_size * 0.28)
        if (
            previous
            and following
            and previous.isascii()
            and following.isascii()
            and previous.isalnum()
            and following.isalnum()
            and gap > 0.8
        ):
            needs_space = True
        if needs_space and not output.endswith((" ", "\u3000")):
            output += " "
        output += text
        previous_x1 = max(previous_x1, x1)
    return output


def classify_line(
    text: str,
    size: float,
    x0: float,
    x1: float,
    page_width: float,
    y: float,
) -> str:
    stripped = text.strip(" \u3000")
    if y < 55 or re.fullmatch(r"[\d｜| ·•xX]+", stripped):
        return "meta"
    if size >= 15:
        return "title"
    if (
        len(stripped) <= 22
        and size >= 11.5
        and abs(((x0 + x1) / 2) - (page_width / 4 if x1 <= page_width / 2 else page_width * 0.75))
        < page_width * 0.13
    ):
        return "heading"
    if re.match(r"^\d+[.、．]", stripped) or stripped.startswith(("【", "※", "註")):
        return "note"
    return "body"


def parse_page(
    page: pymupdf.Page,
) -> dict:
    page_width = float(page.rect.width)
    page_height = float(page.rect.height)
    lines = []
    page_dict = page.get_text("dict", sort=False)
    for block in page_dict.get("blocks", []):
        if block.get("type") != 0:
            continue
        for source_line in block.get("lines", []):
            spans = source_line.get("spans", [])
            parsed_spans = []
            sizes = []
            for span in spans:
                text = span.get("text", "")
                if not text:
                    continue
                x0, y0, x1, y1 = (float(item) for item in span["bbox"])
                parsed_spans.append((x0, x1, text))
                sizes.append(float(span.get("size", 11)))
            if not parsed_spans:
                continue
            parsed_spans.sort(key=lambda item: item[0])
            size = max(sizes) if sizes else 11
            text = join_segments(parsed_spans, size)
            x0 = min(item[0] for item in parsed_spans)
            x1 = max(item[1] for item in parsed_spans)
            y0 = min(float(span["bbox"][1]) for span in spans if span.get("text"))
            suspicious = is_suspicious(text)
            role = classify_line(text, size, x0, x1, page_width, y0)
            lines.append(
                {
                    "text": normalize_space(text),
                    "raw": text,
                    "x": round(x0 / page_width * 100, 3),
                    "y": round(y0 / page_height * 100, 3),
                    "width": round(
                        max(x1 - x0, size) / page_width * 100, 3
                    ),
                    "size": round(size, 2),
                    "role": role,
                    "column": (
                        "left"
                        if (x0 + x1) / 2 < page_width / 2
                        else "right"
                    ),
                    "_top": y0,
                    "_suspicious": suspicious,
                }
            )

    lines.sort(key=lambda line: (line["_top"], line["x"]))
    reading_columns = []
    for column_name in ("left", "right"):
        column_lines = [
            line
            for line in lines
            if line["column"] == column_name
            and not line["_suspicious"]
            and line["text"]
            and line["role"] != "meta"
            and line["_top"] < page_height - 28
        ]
        blocks = []
        current = None
        previous_top = None
        previous_size = None
        for line in column_lines:
            raw = line["raw"]
            text = line["text"].lstrip(" \u3000")
            paragraph_indent = raw.startswith(("\u3000", "  "))
            gap = (
                line["_top"] - previous_top
                if previous_top is not None
                else 0
            )
            start_new = (
                current is None
                or line["role"] in {"title", "heading", "note"}
                or current["role"] in {"title", "heading"}
                or paragraph_indent
                or (
                    previous_size is not None
                    and gap > max(previous_size, line["size"]) * 2.05
                )
            )
            if start_new:
                current = {
                    "role": line["role"],
                    "text": text,
                    "y": line["y"],
                }
                blocks.append(current)
            else:
                previous = current["text"][-1:] if current["text"] else ""
                following = text[:1]
                separator = (
                    " "
                    if previous
                    and following
                    and previous.isascii()
                    and following.isascii()
                    and previous.isalnum()
                    and following.isalnum()
                    else ""
                )
                current["text"] += separator + text
            previous_top = line["_top"]
            previous_size = line["size"]
        reading_columns.append(
            {
                "side": column_name,
                "blocks": blocks,
            }
        )

    public_lines = [
        {key: value for key, value in line.items() if not key.startswith("_") and key != "raw"}
        for line in lines
        if line["text"] and not line["_suspicious"]
    ]
    searchable_text = "\n".join(
        block["text"]
        for column in reading_columns
        for block in column["blocks"]
    )
    return {
        "lines": public_lines,
        "columns": reading_columns,
        "text": searchable_text,
    }


def is_latin_letter(character: str) -> bool:
    return (
        unicodedata.category(character).startswith("L")
        and ord(character) < 0x0250
    )


def split_headword_romanization(value: str) -> tuple[str, str]:
    value = normalize_space(value)
    for index, character in enumerate(value):
        if (
            is_latin_letter(character)
            and index > 0
            and value[index - 1].isspace()
        ):
            return value[:index].strip(), value[index:].strip()
    return value, ""


def rebuild_vocabulary(payload: dict) -> int:
    vocabulary_path = DATA_ROOT / "vocabulary.json"
    vocabulary = json.loads(vocabulary_path.read_text(encoding="utf-8"))
    books = {book["id"]: book for book in payload["books"]}
    fixed = 0

    for entry in vocabulary:
        book = books.get(entry["bookId"])
        if not book:
            continue
        page_number = int(entry["page"])
        if not 1 <= page_number <= len(book["pages"]):
            continue
        page = book["pages"][page_number - 1]
        number_pattern = re.compile(
            rf"^{re.escape(str(entry['number']).zfill(3))}\s+(.+)$"
        )
        starts = [
            line
            for line in page["lines"]
            if number_pattern.match(line["text"])
        ]
        if not starts:
            continue
        start = starts[0]
        same_column = [
            line
            for line in page["lines"]
            if line["column"] == start["column"]
        ]
        next_starts = [
            line["y"]
            for line in same_column
            if re.match(r"^\d{3}\s+", line["text"])
            and line["y"] > start["y"] + 0.5
        ]
        next_y = min(next_starts) if next_starts else 101
        cluster = sorted(
            (
                line
                for line in same_column
                if start["y"] - 0.75 <= line["y"] < next_y - 0.45
            ),
            key=lambda line: (line["y"], line["x"]),
        )

        first = number_pattern.match(start["text"]).group(1)
        first, inline_meaning = (
            first.split("華語", 1) if "華語" in first else (first, "")
        )
        headword, romanization = split_headword_romanization(first)
        meaning = normalize_space(inline_meaning)
        examples = ""
        collecting_examples = False

        for line in cluster:
            if (
                line["text"] == start["text"]
                and line["y"] == start["y"]
                and line["x"] == start["x"]
            ):
                continue
            text = normalize_space(line["text"])
            if not text:
                continue
            if text.startswith("華語"):
                meaning = normalize_space(text.removeprefix("華語"))
                collecting_examples = False
            elif text.startswith("詞彙"):
                examples = normalize_space(text.removeprefix("詞彙"))
                collecting_examples = True
            elif (
                not romanization
                and line["size"] >= 12
                and any(is_latin_letter(character) for character in text)
                and not any("\u3400" <= character <= "\u9fff" for character in text)
            ):
                romanization = text
            elif collecting_examples:
                examples = normalize_space(f"{examples} {text}")

        if headword:
            entry["headword"] = headword
            if romanization:
                entry["romanization"] = romanization
            if meaning:
                entry["meaning"] = meaning
            if examples:
                entry["examples"] = examples
            fixed += 1

    vocabulary_path.write_text(
        json.dumps(vocabulary, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    return fixed


def build(source_root: Path, output_path: Path) -> None:
    curriculum = json.loads(
        (DATA_ROOT / "curriculum.json").read_text(encoding="utf-8")
    )
    books = []
    total_lines = 0
    total_characters = 0
    searchable_pages = 0

    for book in curriculum["books"]:
        pdf_path = source_root / "pdf" / book["pdfFile"]
        document = pymupdf.open(pdf_path)
        if len(document) != book["pageCount"]:
            raise RuntimeError(
                f"{book['id']}: expected {book['pageCount']} pages, "
                f"received {len(document)}"
            )

        pages = []
        for page_index, page in enumerate(document, start=1):
            converted = parse_page(page)
            converted["number"] = page_index
            converted["width"] = round(float(page.rect.width), 3)
            converted["height"] = round(float(page.rect.height), 3)
            pages.append(converted)
            total_lines += len(converted["lines"])
            total_characters += len(converted["text"])
            if converted["text"]:
                searchable_pages += 1

        books.append(
            {
                "id": book["id"],
                "number": book["number"],
                "series": book["series"],
                "title": book["title"],
                "pages": pages,
            }
        )
        print(
            f"{book['id']}: {len(pages)} pages, "
            f"{sum(len(page['lines']) for page in pages)} HTML lines"
        )
        document.close()

    payload = {
        "format": "html-text-layout-v1",
        "source": curriculum["source"],
        "stats": {
            "books": len(books),
            "pages": sum(len(book["pages"]) for book in books),
            "searchablePages": searchable_pages,
            "lines": total_lines,
            "characters": total_characters,
        },
        "books": books,
    }
    rebuilt_vocabulary = rebuild_vocabulary(payload)
    payload["stats"]["vocabularyEntries"] = rebuilt_vocabulary
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(
        f"Complete: {payload['stats']['pages']} pages, "
        f"{total_lines} lines, {total_characters} characters, "
        f"{rebuilt_vocabulary} vocabulary entries rebuilt"
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "source",
        nargs="?",
        type=Path,
        default=Path("/tmp/Lan-Lai-Oh-Taigi-source-019f73bd"),
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DATA_ROOT / "html-curriculum.json",
    )
    args = parser.parse_args()
    build(args.source.expanduser().resolve(), args.output.expanduser().resolve())


if __name__ == "__main__":
    main()
