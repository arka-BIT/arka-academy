#!/usr/bin/env python3
"""Arka Academy - live UPSC updates bot.

Every run (GitHub Actions runs it every 15 minutes):
  1. Reads new items from the sources in bot/feeds.json (RSS feeds, optionally X accounts).
  2. Asks Claude to check each item against bot/syllabus.md, tag it (paper + topic) and
     write a one-line headline in its own words. Unrelated items are dropped.
  3. Publishes to data/updates.json (mode "auto"), or sends each item to your Telegram
     for a one-tap Publish / Skip decision (mode "review").

Only the bot's own one-line headline, the source name and the link are published.
Article text is never copied to the website.

No third-party packages needed: standard library only.

Environment variables (set as GitHub secrets):
  ANTHROPIC_API_KEY    required for AI tagging (without it a simple keyword matcher is used)
  TELEGRAM_BOT_TOKEN   needed for review mode
  TELEGRAM_CHAT_ID     your chat id; only this chat can approve items
  X_BEARER_TOKEN       optional; only if you enable type "x" sources (paid per post read)
  ARKA_MODE            optional override of settings.mode ("auto" or "review")

Run locally:  python bot/arka_updates.py            (normal run)
              python bot/arka_updates.py --dry-run  (no AI calls, no Telegram, prints results)
"""
import datetime as dt
import hashlib
import html
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from pathlib import Path

BOT = Path(__file__).resolve().parent
# all files live together at the top level of the repository
DATA = BOT if (BOT / "feeds.json").exists() and not (BOT.parent / "bot").exists() else BOT.parent / "data"
UA = "ArkaAcademyUpdatesBot/1.0 (+https://www.youtube.com/@arkaacademy-forcivilservices)"
IST = dt.timezone(dt.timedelta(hours=5, minutes=30))
NOW = dt.datetime.now(dt.timezone.utc)

PAPERS = ["Prelims", "GS-I", "GS-II", "GS-III", "GS-IV", "Essay"]
TOPICS = ["History", "Art & Culture", "Geography", "Society", "Polity", "Governance", "Social Justice",
          "International Relations", "Economy", "Agriculture", "Infrastructure", "Science & Tech",
          "Space", "Defence", "Environment", "Disaster Management", "Internal Security", "Health",
          "Education", "Schemes", "Reports & Indices", "Ethics"]


# ---------------------------------------------------------------- utilities
def log(*a):
    print(*a, flush=True)


def load_json(path, default):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def save_json(path, obj):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    tmp = Path(str(path) + ".tmp")
    tmp.write_text(json.dumps(obj, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(path)


BROWSER = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
                         "Chrome/130.0 Safari/537.36",
           "Accept": "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5",
           "Accept-Language": "en-IN,en;q=0.9"}


def http(url, data=None, headers=None, timeout=30):
    h = {"User-Agent": UA} if data is not None else dict(BROWSER)
    h.update(headers or {})
    body = None
    if data is not None:
        body = json.dumps(data).encode()
        h.setdefault("content-type", "application/json")
    req = urllib.request.Request(url, data=body, headers=h, method="POST" if body else "GET")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def clean(text, limit=None):
    text = html.unescape(re.sub(r"<[^>]+>", " ", text or ""))
    text = re.sub(r"\s+", " ", text).strip()
    return text[:limit] if limit else text


def item_id(link, title):
    return hashlib.sha1((link or title).strip().encode()).hexdigest()[:16]


def parse_date(s):
    if not s:
        return NOW
    try:
        d = parsedate_to_datetime(s)
    except (TypeError, ValueError):
        try:
            d = dt.datetime.fromisoformat(s.replace("Z", "+00:00"))
        except ValueError:
            return NOW
    if d.tzinfo is None:
        d = d.replace(tzinfo=IST)
    return min(d.astimezone(dt.timezone.utc), NOW)


# ---------------------------------------------------------------- sources
def fetch_rss(src):
    """Try the main feed, then any backup feeds listed under "backup"."""
    urls = [src["url"]] + list(src.get("backup", []))
    last = None
    for n, url in enumerate(urls):
        try:
            items = parse_rss(src, http(url))
            if n:
                log(f"  {src['name']}: main feed blocked, used backup feed")
            return items
        except (urllib.error.URLError, ET.ParseError, ValueError, TimeoutError) as e:
            last = e
    raise last


def parse_rss(src, raw):
    raw = re.sub(rb"^\s+", b"", raw)
    root = ET.fromstring(raw)
    out = []
    strip = lambda t: t.split("}", 1)[-1]
    for node in root.iter():
        tag = strip(node.tag)
        if tag not in ("item", "entry"):
            continue
        f = {}
        for ch in node:
            k = strip(ch.tag)
            if k == "link" and ch.get("href"):
                f.setdefault("link", ch.get("href"))
            elif ch.text and k not in f:
                f[k] = ch.text
        title = clean(f.get("title"), 300)
        if src.get("strip_source_suffix"):
            title = re.sub(r"\s+[-|–]\s+[^-|–]{2,60}$", "", title)
        link = (f.get("link") or f.get("guid") or "").strip()
        if not title or not link.startswith("http"):
            continue
        out.append({
            "id": item_id(link, title), "source": src["name"], "title": title, "url": link,
            "text": clean(f.get("description") or f.get("summary") or f.get("encoded"), 700),
            "published": parse_date(f.get("pubDate") or f.get("published") or f.get("updated") or f.get("date")),
        })
    return out


def fetch_x(src, state):
    token = os.environ.get("X_BEARER_TOKEN")
    if not token:
        log(f"  skip {src['name']} (X): no X_BEARER_TOKEN")
        return []
    hdr = {"Authorization": f"Bearer {token}"}
    user = src["username"]
    ids = state.setdefault("x_user_ids", {})
    if user not in ids:
        ids[user] = json.loads(http(f"https://api.x.com/2/users/by/username/{user}", headers=hdr))["data"]["id"]
    q = {"max_results": "10", "exclude": "retweets,replies", "tweet.fields": "created_at"}
    since = state.setdefault("x_since", {}).get(user)
    if since:
        q["since_id"] = since
    res = json.loads(http(f"https://api.x.com/2/users/{ids[user]}/tweets?" + urllib.parse.urlencode(q), headers=hdr))
    out = []
    for t in res.get("data", []):
        link = f"https://x.com/{user}/status/{t['id']}"
        out.append({"id": item_id(link, t["text"]), "source": src["name"], "title": clean(t["text"], 300),
                    "url": link, "text": "", "published": parse_date(t.get("created_at"))})
    if res.get("meta", {}).get("newest_id"):
        state["x_since"][user] = res["meta"]["newest_id"]
    return out


# ---------------------------------------------------------------- classification
SYSTEM = """You help a UPSC Civil Services coaching institute (Arka Academy) pick news worth a student's time.
For each news item decide whether it is useful for UPSC CSE preparation, using the syllabus map below.

Rules:
- relevant=true only for items with clear policy, governance, economy, international, science, environment,
  security, social or constitutional content that a UPSC aspirant should know.
- Greetings, condolences, ceremonial visits, routine crime, entertainment, sports results and party politics are not relevant.
- headline: ONE line, at most 16 words, in your own words. Do not copy the original sentence. Neutral, factual, no clickbait.
- paper: one of %s. topic: one of %s.
- exam: "Prelims", "Mains" or "Both".
- score: 0-100, how useful for UPSC.

Answer with JSON only: a list with one object per item, in the same order:
[{"i": 0, "relevant": true, "score": 80, "headline": "...", "paper": "GS-II", "topic": "Polity", "exam": "Both"}]

SYLLABUS MAP:
%s"""


def classify_ai(items, settings):
    key = os.environ["ANTHROPIC_API_KEY"]
    syllabus = (BOT / "syllabus.md").read_text(encoding="utf-8")
    system = SYSTEM % (", ".join(PAPERS), ", ".join(TOPICS), syllabus)
    results = {}
    for start in range(0, len(items), 8):
        batch = items[start:start + 8]
        listing = "\n\n".join(f"[{n}] SOURCE: {it['source']}\nTITLE: {it['title']}\nSNIPPET: {it['text'][:500]}"
                              for n, it in enumerate(batch))
        body = {"model": settings.get("model", "claude-haiku-5-5"), "max_tokens": 1500, "system": system,
                "messages": [{"role": "user", "content": "Items:\n\n" + listing}]}
        try:
            res = json.loads(http("https://api.anthropic.com/v1/messages", data=body, timeout=90,
                                  headers={"x-api-key": key, "anthropic-version": "2023-06-01"}))
            text = "".join(c.get("text", "") for c in res.get("content", []))
            arr = json.loads(text[text.index("["): text.rindex("]") + 1])
        except (urllib.error.URLError, ValueError, KeyError) as e:
            log(f"  AI batch failed ({e}); falling back to keywords for this batch")
            for it in batch:
                results[it["id"]] = classify_keywords(it)
            continue
        for r in arr:
            try:
                it = batch[int(r["i"])]
            except (KeyError, ValueError, IndexError, TypeError):
                continue
            results[it["id"]] = {
                "relevant": bool(r.get("relevant")), "score": int(r.get("score", 0)),
                "headline": clean(r.get("headline") or it["title"], 160),
                "paper": r.get("paper") if r.get("paper") in PAPERS else "Prelims",
                "topic": r.get("topic") if r.get("topic") in TOPICS else "Governance",
                "exam": r.get("exam") if r.get("exam") in ("Prelims", "Mains", "Both") else "Both"}
    return results


KEYWORDS = {
    ("GS-II", "Polity"): "constitution|parliament|lok sabha|rajya sabha|supreme court|high court|amendment|election commission|governor|bill|act,|ordinance|fundamental right",
    ("GS-II", "International Relations"): "bilateral|summit|treaty|mou|agreement|united nations|g20|brics|sco|quad|asean|diaspora|foreign minister|external affairs",
    ("GS-III", "Economy"): "gdp|inflation|rbi|repo|fiscal|budget|gst|export|import|trade deficit|investment|fdi|msme|startup|bank",
    ("GS-III", "Agriculture"): "agricultur|farmer|farming|crop|msp|kharif|rabi|fertili|irrigation|fisheries|dairy|food processing",
    ("GS-III", "Environment"): "climate|emission|forest|wildlife|biodiversity|pollution|tiger|wetland|renewable|solar|net zero|cop",
    ("GS-III", "Science & Tech"): "isro|satellite|space|ai |artificial intelligence|semiconductor|quantum|vaccine|biotech|research|drdo",
    ("GS-III", "Internal Security"): "terror|naxal|insurgen|cyber|border|money laundering|security forces",
    ("GS-III", "Disaster Management"): "cyclone|earthquake|flood|landslide|disaster|ndma|heatwave",
    ("GS-I", "Art & Culture"): "heritage|unesco|temple|festival of|classical|archaeolog|manuscript",
    ("GS-II", "Health"): "health|hospital|disease|ayushman|nutrition|tb |malaria",
    ("GS-II", "Education"): "education|school|university|nep|skill",
    ("GS-II", "Schemes"): "scheme|yojana|mission|abhiyan",
}
NOISE = r"condolence|greets|wishes|birthday|anniversary greetings|pays tribute|cricket|film|actor|rally"


def classify_keywords(it):
    t = f" {it['title']} {it['text']} ".lower()
    if re.search(NOISE, t):
        return {"relevant": False, "score": 0}
    for (paper, topic), pat in KEYWORDS.items():
        if re.search(pat, t):
            return {"relevant": True, "score": 65, "headline": it["title"][:160], "paper": paper,
                    "topic": topic, "exam": "Both"}
    return {"relevant": False, "score": 20}


# ---------------------------------------------------------------- telegram review
def tg(method, **params):
    token = os.environ["TELEGRAM_BOT_TOKEN"]
    return json.loads(http(f"https://api.telegram.org/bot{token}/{method}", data=params))


def tg_process_decisions(state, pending, updates):
    """Apply Publish/Skip taps made since the last run."""
    chat = str(os.environ.get("TELEGRAM_CHAT_ID", ""))
    res = tg("getUpdates", offset=state.get("tg_offset", 0), timeout=0, allowed_updates=["callback_query"])
    for u in res.get("result", []):
        state["tg_offset"] = u["update_id"] + 1
        cq = u.get("callback_query")
        if not cq:
            continue
        msg = cq.get("message", {})
        if str(msg.get("chat", {}).get("id")) != chat:
            continue
        action, _, iid = (cq.get("data") or "").partition(":")
        entry = pending.pop(iid, None)
        if entry and action == "p":
            publish(updates, entry)
            note = "✅ Published"
        else:
            note = "❌ Skipped" if entry else "Already handled"
        try:
            tg("answerCallbackQuery", callback_query_id=cq["id"], text=note)
            tg("editMessageText", chat_id=msg["chat"]["id"], message_id=msg["message_id"],
               text=(msg.get("text") or "") + f"\n\n{note}")
        except urllib.error.URLError:
            pass


def tg_send_for_review(entry):
    text = (f"{entry['source']} · {entry['paper']} · {entry['topic']} · {entry['exam']}\n\n"
            f"{entry['title']}\n\nOriginal: {entry['url']}")
    tg("sendMessage", chat_id=os.environ["TELEGRAM_CHAT_ID"], text=text, disable_web_page_preview=True,
       reply_markup={"inline_keyboard": [[{"text": "✅ Publish", "callback_data": "p:" + entry["id"]},
                                          {"text": "❌ Skip", "callback_data": "s:" + entry["id"]}]]})


# ---------------------------------------------------------------- publishing
def publish(updates, entry):
    if any(x["id"] == entry["id"] for x in updates["items"]):
        return
    updates["items"].append({k: entry[k] for k in ("id", "time", "source", "title", "url", "paper", "topic", "exam")})


def prune(updates, settings):
    limit = NOW - dt.timedelta(hours=settings.get("max_age_hours", 96))
    items = [x for x in updates["items"] if dt.datetime.fromisoformat(x["time"]) >= limit]
    items.sort(key=lambda x: x["time"], reverse=True)
    updates["items"] = items[: settings.get("max_items_on_site", 40)]


# ---------------------------------------------------------------- main
def main():
    dry = "--dry-run" in sys.argv
    cfg = load_json(os.environ.get("ARKA_FEEDS") or BOT / "feeds.json", {})
    settings = cfg.get("settings", {})
    mode = os.environ.get("ARKA_MODE") or settings.get("mode", "review")
    if mode == "review" and not (os.environ.get("TELEGRAM_BOT_TOKEN") and os.environ.get("TELEGRAM_CHAT_ID")) and not dry:
        log("Review mode needs TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID; publishing automatically this run.")
        mode = "auto"

    state = load_json(DATA / "state.json", {})
    updates = load_json(DATA / "updates.json", {"items": []})
    pending = load_json(DATA / "pending.json", {})
    seen = set(state.get("seen", []))

    if mode == "review" and not dry:
        try:
            tg_process_decisions(state, pending, updates)
        except (urllib.error.URLError, KeyError) as e:
            log("Telegram check failed:", e)
    # forget review requests older than 48 hours
    old = (NOW - dt.timedelta(hours=48)).isoformat()
    pending = {k: v for k, v in pending.items() if v.get("queued", v["time"]) >= old}

    fresh = []
    for src in cfg.get("sources", []):
        if not src.get("enabled"):
            continue
        try:
            got = fetch_x(src, state) if src["type"] == "x" else fetch_rss(src)
        except (urllib.error.URLError, ET.ParseError, ValueError, KeyError, TimeoutError) as e:
            log(f"  {src['name']}: could not read ({e})")
            continue
        oldest = NOW - dt.timedelta(hours=settings.get("max_age_hours", 96))
        new = [g for g in got if g["id"] not in seen and g["published"] >= oldest]
        new = new[: settings.get("max_new_per_source_per_run", 15)]
        log(f"  {src['name']}: {len(got)} items, {len(new)} new")
        fresh += new

    if fresh:
        use_ai = bool(os.environ.get("ANTHROPIC_API_KEY")) and not dry
        verdicts = classify_ai(fresh, settings) if use_ai else {it["id"]: classify_keywords(it) for it in fresh}
        kept = 0
        for it in fresh:
            seen.add(it["id"])
            v = verdicts.get(it["id"]) or classify_keywords(it)
            if not v.get("relevant") or v.get("score", 0) < settings.get("min_score", 60):
                continue
            entry = {"id": it["id"], "time": it["published"].isoformat(), "source": it["source"],
                     "title": v["headline"], "url": it["url"], "paper": v["paper"], "topic": v["topic"],
                     "exam": v["exam"]}
            kept += 1
            if dry:
                log(f"  KEEP [{entry['paper']} · {entry['topic']}] {entry['title']}")
            elif mode == "review":
                pending[entry["id"]] = dict(entry, queued=NOW.isoformat())
                try:
                    tg_send_for_review(entry)
                except (urllib.error.URLError, KeyError) as e:
                    log("  Telegram send failed:", e)
            else:
                publish(updates, entry)
        log(f"{len(fresh)} new items checked, {kept} relevant ({mode} mode)")

    if dry:
        return
    prune(updates, settings)
    updates["updated"] = NOW.isoformat()
    state["seen"] = list(seen)[-4000:]
    save_json(DATA / "updates.json", updates)
    save_json(DATA / "pending.json", pending)
    save_json(DATA / "state.json", state)


if __name__ == "__main__":
    main()
