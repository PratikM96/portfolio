#!/usr/bin/env python3
"""Pre-merge checks for mehtapratik.com. Runs in CI on every pull request to main.
Pure standard library, no install needed.

HARD FAILS (exit 1):
  - an internal link or asset reference that resolves to no file on disk
  - a site.css / site.js reference whose ?v= stamp does not match the file's
    current content hash, but only when _headers caches those files immutably.
    That means you edited the CSS/JS and forgot to run bump-assets.ps1.

WARNINGS (printed, do not fail the build):
  - an indexable page missing from sitemap.xml
  - a page missing <title>, meta description, or canonical
"""
import sys, re, hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REF_RE = re.compile(r'(?:href|src)\s*=\s*"([^"]+)"')
EXTERNAL = ("http://", "https://", "//", "mailto:", "tel:", "#", "data:")
NOINDEX = {"reel", "404"}

errors, warnings = [], []

def html_files():
    return [p for p in ROOT.rglob("*.html") if ".github" not in p.parts]

def read(p):
    return p.read_text(encoding="utf-8", errors="replace")

# 1. Internal links and assets resolve to a real file
def resolves(value, html_file):
    v = value.split("#")[0].split("?")[0]
    if not v:
        return True
    base = ROOT / v.lstrip("/") if v.startswith("/") else html_file.parent / v
    candidates = [base, Path(str(base) + ".html"), base / "index.html"]
    if v == "/":
        candidates.append(ROOT / "index.html")
    return any(c.is_file() for c in candidates)

for f in html_files():
    for m in REF_RE.finditer(read(f)):
        val = m.group(1).strip()
        if val.lower().startswith(EXTERNAL):
            continue
        if not resolves(val, f):
            errors.append(f"{f.relative_to(ROOT).as_posix()}: broken internal reference -> {val}")

# 2. CSS/JS cache-stamp integrity (only enforced when _headers caches them immutable)
def content_stamp(p):
    b = p.read_bytes()
    if b.startswith(b"\xef\xbb\xbf"):
        b = b[3:]
    return hashlib.sha1(b.replace(b"\r\n", b"\n")).hexdigest()[:8]

headers = ROOT / "_headers"
immutable = headers.is_file() and bool(
    re.search(r"/assets/\*\.(?:css|js).*?immutable", read(headers), re.S)
)
if immutable:
    for name in ("site.css", "site.js"):
        p = ROOT / "assets" / name
        if not p.is_file():
            continue
        want = content_stamp(p)
        ref_re = re.compile(r'(?:href|src)="[^"]*assets/' + re.escape(name) + r'(?:\?v=([^"]*))?"')
        for f in html_files():
            for m in ref_re.finditer(read(f)):
                if m.group(1) != want:
                    errors.append(
                        f"{f.relative_to(ROOT).as_posix()}: {name} stamp is "
                        f"'{m.group(1)}', expected '{want}'. Run .github/scripts/bump-assets.ps1."
                    )

# 3. Sitemap sync (warning)
sm = ROOT / "sitemap.xml"
if sm.is_file():
    listed = {loc.rstrip("/") for loc in re.findall(r"<loc>https?://[^/]+/([^<]*)</loc>", read(sm))}
    for f in html_files():
        rel = f.relative_to(ROOT).as_posix()
        if f.stem in NOINDEX:
            continue
        page = "" if rel == "index.html" else rel[:-5]
        if page not in listed:
            warnings.append(f"sitemap.xml: missing entry for /{page} ({rel})")

# 4. Required head tags (warning)
for f in html_files():
    if f.stem in NOINDEX:
        continue
    head = read(f).split("</head>")[0]
    for label, pat in (("<title>", r"<title>"), ("meta description", r'name="description"'), ("canonical", r'rel="canonical"')):
        if not re.search(pat, head):
            warnings.append(f"{f.relative_to(ROOT).as_posix()}: missing {label}")

for w in warnings:
    print("WARN:", w)
if errors:
    print()
    for e in errors:
        print("FAIL:", e)
    print(f"\n{len(errors)} error(s) found.")
    sys.exit(1)
print(f"\nOK: {len(html_files())} pages checked, no broken references or stale asset stamps."
      + (f" ({len(warnings)} warning(s) above)" if warnings else ""))
