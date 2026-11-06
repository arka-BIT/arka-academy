# Arka Academy: Live UPSC Updates bot

This folder is a ready-made GitHub repository. It holds your website (`index.html`) and a bot that,
every 15 minutes:

1. reads new items from PIB, The Hindu and Indian Express (free RSS feeds; X accounts are optional),
2. checks each item against the UPSC syllabus in `bot/syllabus.md` using Claude, drops anything
   unrelated, and writes a one-line headline in its own words with tags such as **GS-II · Polity**,
3. publishes it to `data/updates.json`, which the "Live UPSC Updates" panel on your home page reads.

Only the bot's own headline, the source name and a link to the original are shown. Article text is never copied.

---

## One-time setup (about 30 minutes)

### 1. Put this folder on GitHub
1. Create a free account at github.com.
2. Click **New repository**, name it (for example `arka-academy`), keep it **Public**, and create it.
3. Click **uploading an existing file**, drag in everything from this folder (including the hidden
   `.github` folder; on Windows turn on "show hidden items" first), and click **Commit changes**.

### 2. Turn on the website (GitHub Pages)
1. In the repository, open **Settings → Pages**.
2. Under **Branch**, choose `main` and `/ (root)`, then **Save**.
3. After a minute your site is live at `https://<your-username>.github.io/arka-academy/`.
   You can later connect your own domain on the same page.

### 3. Add your keys (Settings → Secrets and variables → Actions → New repository secret)
| Name | What it is | Needed? |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude API key from console.anthropic.com (add a small prepaid balance) | Yes, for syllabus tagging. Without it a simple keyword matcher is used. |
| `TELEGRAM_BOT_TOKEN` | Create a bot by messaging **@BotFather** on Telegram, send `/newbot`, copy the token | Only for review mode |
| `TELEGRAM_CHAT_ID` | Send any message to your new bot, then open `https://api.telegram.org/bot<TOKEN>/getUpdates` and copy `"chat":{"id": ...}` | Only for review mode |
| `X_BEARER_TOKEN` | From the X developer console (paid per post read) | Only if you enable X sources |

### 4. Start the bot
1. Open the **Actions** tab and click **I understand my workflows, go ahead and enable them**.
2. Open **Live UPSC updates → Run workflow** to run it once by hand.
3. After that it runs by itself every 15 minutes.

---

## Review mode (recommended for the first weeks)
`bot/feeds.json` starts with `"mode": "review"`. Each relevant item is sent to your Telegram with
**✅ Publish** and **❌ Skip** buttons. Your tap is applied on the bot's next run (within about 15 minutes).
Requests you do not answer expire after 48 hours.

When you trust the tagging, change `"mode": "review"` to `"mode": "auto"` and items go straight to the site.
If the Telegram secrets are missing, the bot publishes automatically.

## Changing what the bot reads
Edit `bot/feeds.json`:
- set `"enabled": false` to pause a source, or add another RSS feed with its URL;
- `min_score` (0-100) controls how strict the filter is; raise it to 70 for fewer, more important items;
- `max_items_on_site` and `max_age_hours` control how many items the panel keeps.

Edit `bot/syllabus.md` to change what counts as relevant.

## Costs
- GitHub hosting and the 15-minute runs: free for a public repository.
- Claude tagging: small; the bot sends items in batches of 8 to a low-cost model.
- RSS feeds: free. X accounts: paid per post read, so they are switched off by default.

## If the panel shows "Preview: sample items"
The website could not read `data/updates.json` yet. Check that:
- the bot has run at least once (Actions tab, green tick),
- the site is opened from its GitHub Pages address, not as a file on your computer,
- if the website is hosted somewhere else, `UPDATES_URL` near the bottom of `index.html` points to
  `https://raw.githubusercontent.com/<your-username>/arka-academy/main/data/updates.json`.

## Good to know
- GitHub pauses scheduled runs in repositories with no activity for 60 days; the bot's own commits keep it active.
- Run the bot on your own computer without spending anything: `python bot/arka_updates.py --dry-run`
  prints what it would publish using the keyword matcher.
