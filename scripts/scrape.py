import requests
from bs4 import BeautifulSoup
import re
import json
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data"
CONFIG_FILE = ROOT_DIR / "papers.json"
IST = timezone(timedelta(hours=5, minutes=30))

MONTHS_MAP = {
    "Jan": "01", "Feb": "02", "Mar": "03", "Apr": "04", "May": "05", "Jun": "06",
    "Jul": "07", "Aug": "08", "Sep": "09", "Oct": "10", "Nov": "11", "Dec": "12",
}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    )
}


def parse_date_from_text(text):
    pattern = r"(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})"
    match = re.search(pattern, text)
    if match:
        day, month_str, year = match.groups()
        month = MONTHS_MAP[month_str]
        return f"{int(day):02d}-{month}-{year}", f"{int(day):02d} {month_str} {year}"
    return None, None


def scrape_paper(name, slug, page_url):
    today = datetime.now(IST)
    today_display = today.strftime("%d %b %Y")

    try:
        resp = requests.get(page_url, headers=HEADERS, timeout=30)
        resp.raise_for_status()
    except Exception as exc:
        print(f"[scrape] {name}: ERROR {exc}")
        return {
            "name": name,
            "slug": slug,
            "url": page_url,
            "error": str(exc),
            "latest": {
                "date": today.strftime("%d-%m-%Y"),
                "date_display": today_display,
                "drive_url": None,
                "drive_id": None,
                "note": f"Page fetch failed: {exc}",
            },
            "archive": [],
        }

    soup = BeautifulSoup(resp.text, "html.parser")
    entries = []

    for a_tag in soup.find_all("a", href=re.compile(r"drive\.google\.com")):
        href = a_tag.get("href", "").strip()
        drive_id = None
        match_id = re.search(r"/file/d/([^/]+)", href)
        if match_id:
            drive_id = match_id.group(1)

        parent = a_tag.find_parent(["p", "div", "li", "td"]) or a_tag.parent
        parent_text = parent.get_text(separator=" ", strip=True) if parent else ""

        date_key, date_display = parse_date_from_text(parent_text)
        if date_key:
            entries.append({
                "date": date_key,
                "date_display": date_display,
                "drive_url": href,
                "drive_id": drive_id,
            })

    entries.sort(key=lambda e: e["date"], reverse=True)

    today_entry = next(
        (e for e in entries if today_display in e["date_display"]), None
    )
    if not today_entry:
        today_entry = {
            "date": today.strftime("%d-%m-%Y"),
            "date_display": today_display,
            "drive_url": None,
            "drive_id": None,
            "note": "Not available — may be Sunday or holiday",
        }

    print(f"[scrape] {name}: {today_entry['date_display']} -> {today_entry.get('drive_id', 'N/A')}")

    return {
        "name": name,
        "slug": slug,
        "url": page_url,
        "latest": today_entry,
        "archive": entries,
    }


def main():
    config = json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    papers = []
    for paper in config:
        papers.append(scrape_paper(paper["name"], paper["slug"], paper["url"]))
        time.sleep(1)

    output = {
        "updated_at": datetime.now(IST).isoformat(),
        "papers": papers,
    }

    out_file = DATA_DIR / "papers.json"
    out_file.write_text(
        json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(f"[scrape] Done - {len(papers)} papers saved to {out_file}")


if __name__ == "__main__":
    main()