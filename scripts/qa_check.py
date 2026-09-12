from __future__ import annotations

import re
import sys
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
EXTERNAL_SCHEMES = {"http", "https", "mailto", "tel", "javascript", "data"}
LEGACY_FONTS = ("Manrope", "Cormorant", "DM Sans", "Instrument Serif", "Plus Jakarta Sans")
LEGACY_EMOJI = ("📞", "✉️", "📍", "🕐", "⭐", "🔥", "⚡", "🎉", "🚀")
DYNAMIC_PLACEHOLDER_HREF_IDS = {"btnPayUpiApp"}

errors: list[str] = []
warnings: list[str] = []


def err(msg: str) -> None:
    errors.append(msg)


def warn(msg: str) -> None:
    warnings.append(msg)


class PageParser(HTMLParser):
    def __init__(self, path: Path) -> None:
        super().__init__(convert_charrefs=True)
        self.path = path
        self.ids: list[str] = []
        self.refs: list[tuple[str, str, str, dict[str, str]]] = []
        self.imgs: list[dict[str, str]] = []
        self.anchors: list[dict[str, str]] = []
        self.options: list[dict[str, str]] = []
        self.divs: list[dict[str, str]] = []
        self.selects: list[dict[str, str]] = []

    def handle_starttag(self, tag: str, attrs_list) -> None:
        attrs = {k: (v or "") for k, v in attrs_list}
        if attrs.get("id"):
            self.ids.append(attrs["id"])
        for attr in ("href", "src"):
            if attrs.get(attr):
                self.refs.append((tag, attr, attrs[attr], attrs))
        if tag == "img":
            self.imgs.append(attrs)
        if tag == "a":
            self.anchors.append(attrs)
        if tag == "option":
            self.options.append(attrs)
        if tag == "div":
            self.divs.append(attrs)
        if tag == "select":
            self.selects.append(attrs)


def rel(path: Path) -> str:
    try:
        return path.relative_to(ROOT).as_posix()
    except ValueError:
        return path.as_posix()


all_files = [p for p in ROOT.rglob("*") if p.is_file() and ".git" not in p.parts]
file_map = {rel(p): p for p in all_files}
file_map_lower = {name.lower(): name for name in file_map}

html_files = sorted(ROOT.glob("*.html"))
css_files = sorted(ROOT.glob("*.css"))

parsers: dict[str, PageParser] = {}
html_texts: dict[str, str] = {}

for path in html_files:
    name = rel(path)
    text = path.read_text(encoding="utf-8")
    html_texts[name] = text
    parser = PageParser(path)
    try:
        parser.feed(text)
    except Exception as exc:
        err(f"{name}: HTML parser error: {exc}")
    parsers[name] = parser

    dupes = [value for value, count in Counter(parser.ids).items() if count > 1]
    for value in dupes:
        err(f"{name}: duplicate id #{value}")

    if "<title" not in text.lower():
        warn(f"{name}: missing <title>")
    if 'name="viewport"' not in text.lower() and "name='viewport'" not in text.lower():
        warn(f"{name}: missing viewport meta")

    for img in parser.imgs:
        if "alt" not in img:
            warn(f"{name}: image missing alt attribute ({img.get('src', 'unknown src')})")

    for anchor in parser.anchors:
        href = anchor.get("href", "")
        if href == "#" and anchor.get("id") not in DYNAMIC_PLACEHOLDER_HREF_IDS:
            warn(f"{name}: placeholder href=\"#\"")
        if anchor.get("target") == "_blank":
            rel_tokens = set(anchor.get("rel", "").lower().split())
            if "noopener" not in rel_tokens:
                warn(f"{name}: target=\"_blank\" link missing rel=\"noopener\" ({href})")

    for font in LEGACY_FONTS:
        if font.lower().replace(" ", "+") in text.lower() or font.lower() in text.lower():
            if "fonts.googleapis.com" in text:
                warn(f"{name}: legacy font reference still present: {font}")

    for emoji in LEGACY_EMOJI:
        if emoji in text:
            warn(f"{name}: legacy emoji UI token still present: {emoji}")

# Local link/src and anchor validation.
for name, parser in parsers.items():
    source_dir = Path(name).parent
    for tag, attr, raw, attrs in parser.refs:
        raw = raw.strip()
        if not raw or raw.startswith("//"):
            continue
        parsed = urlsplit(raw)
        if parsed.scheme.lower() in EXTERNAL_SCHEMES:
            continue

        fragment = unquote(parsed.fragment)
        path_part = unquote(parsed.path)

        if not path_part:
            target_name = name
        else:
            target = (ROOT / path_part.lstrip("/")) if path_part.startswith("/") else (ROOT / source_dir / path_part)
            try:
                target_name = target.resolve().relative_to(ROOT.resolve()).as_posix()
            except ValueError:
                err(f"{name}: {attr} escapes repository root: {raw}")
                continue

            if target_name not in file_map:
                case_match = file_map_lower.get(target_name.lower())
                if case_match:
                    err(f"{name}: case mismatch for {raw}; repository file is {case_match}")
                else:
                    err(f"{name}: broken local {attr}: {raw}")
                continue

        if fragment and target_name.endswith(".html"):
            target_parser = parsers.get(target_name)
            if target_parser and fragment not in set(target_parser.ids):
                err(f"{name}: broken anchor {raw}; #{fragment} not found in {target_name}")

# CSS imports, local URLs, and custom properties.
css_text = {}
defined_vars: set[str] = set()
used_vars: set[str] = set()

for path in css_files:
    name = rel(path)
    text = path.read_text(encoding="utf-8")
    css_text[name] = text
    defined_vars.update(re.findall(r"(?<![\w-])--([A-Za-z0-9_-]+)\s*:", text))
    used_vars.update(re.findall(r"var\(\s*--([A-Za-z0-9_-]+)", text))

    for match in re.finditer(r"@import\s+(?:url\()?['\"]([^'\"]+)['\"]\)?", text):
        raw = match.group(1)
        parsed = urlsplit(raw)
        if parsed.scheme or raw.startswith("//"):
            continue
        target = (path.parent / unquote(parsed.path)).resolve()
        if not target.exists():
            err(f"{name}: missing CSS import {raw}")

    for match in re.finditer(r"url\(\s*['\"]?([^'\"\)]+)", text):
        raw = match.group(1).strip()
        if raw.startswith("#"):
            continue
        parsed = urlsplit(raw)
        if parsed.scheme or raw.startswith("//") or parsed.path.startswith("data:"):
            continue
        target = (path.parent / unquote(parsed.path)).resolve()
        if not target.exists():
            err(f"{name}: broken local CSS url {raw}")

for var_name in sorted(used_vars - defined_vars):
    warn(f"CSS: custom property --{var_name} is used but not defined in root CSS files")

# Inline JS ID references: warn if a page script names an element that does not exist.
for name, text in html_texts.items():
    ids = set(parsers[name].ids)
    js_ids = set(re.findall(r"getElementById\(\s*['\"]([^'\"]+)['\"]\s*\)", text))
    for js_id in sorted(js_ids - ids):
        warn(f"{name}: inline JS references missing id #{js_id}")

# Menu-specific structural checks.
menu_name = "menu.html"
if menu_name in html_texts:
    text = html_texts[menu_name]

    row_ids = re.findall(r'<div\s+class="[^"]*\bmenu-row\b[^"]*"[^>]*\bdata-id="([^"]+)"', text)
    for value, count in Counter(row_ids).items():
        if count > 1:
            err(f"menu.html: duplicate menu row data-id {value}")

    option_values = [attrs.get("value", "") for attrs in parsers[menu_name].options if attrs.get("value")]
    combo_option_ids: list[str] = []
    for value in option_values:
        parts = value.split("|", 2)
        if len(parts) != 3:
            err(f"menu.html: malformed combo option value: {value}")
            continue
        item_id, price, full_name = parts
        combo_option_ids.append(item_id)
        if not re.fullmatch(r"\d+", price):
            err(f"menu.html: combo option price is not numeric: {value}")
        if not item_id or not full_name.strip():
            err(f"menu.html: incomplete combo option value: {value}")

    for value, count in Counter(combo_option_ids).items():
        if count > 1:
            err(f"menu.html: duplicate combo variant id {value}")

    combo_rows = sum(1 for attrs in parsers[menu_name].divs if "combo-row" in attrs.get("class", "").split())
    combo_selects = sum(1 for attrs in parsers[menu_name].selects if "combo-select" in attrs.get("class", "").split())
    if combo_rows != combo_selects:
        err(f"menu.html: combo row/select count mismatch ({combo_rows} rows vs {combo_selects} selects)")

    for required in ("cat-starters", "cat-noodles", "cat-rice", "cat-soups", "cat-combos"):
        if required not in set(parsers[menu_name].ids):
            err(f"menu.html: missing required menu category id #{required}")

# High-signal business-flow assertions.
if "menu.html" in html_texts:
    m = html_texts["menu.html"]
    if "supabase-config.js" not in m:
        err("menu.html: supabase-config.js is not loaded")
    if "custPhone" not in m or "custAddress" not in m:
        err("menu.html: checkout contact/address fields are missing")
    if "btnConfirmPayment" not in m or "btnConfirmCod" not in m:
        err("menu.html: payment confirmation controls are missing")

print("TCB AUTOMATED QA")
print("=" * 72)
print(f"HTML files checked: {len(html_files)}")
print(f"CSS files checked:  {len(css_files)}")
print(f"Errors: {len(errors)}")
print(f"Warnings: {len(warnings)}")

if errors:
    print("\nERRORS")
    for item in errors:
        print(f"  - {item}")

if warnings:
    print("\nWARNINGS")
    for item in warnings:
        print(f"  - {item}")

print("\nRESULT:", "FAIL" if errors else "PASS")
sys.exit(1 if errors else 0)
