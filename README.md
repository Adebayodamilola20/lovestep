# LoveStep

Two-player online games you play with a friend from a link, like iMessage games, but in the browser.

**Between Us:** 8 question games (Most Likely To, Would You Rather, Never Have I Ever, How Well Do You Know Me?, Finish the Sentence…), 32 packs, 480 questions, 10 per round, scored by how in sync you are.

**Quiz Duel:** live trivia across 8 categories (about 40 questions each; Music covers 2024 to now). The host picks 5 to 20 questions and 10 to 30 seconds each. Every right answer is a point, and a rematch avoids questions the pair has already had. The server holds the answers and the clock; leaving the app for more than 5 seconds forfeits.

**Games:** 8 Ball Pool, Darts, Archery, Cup Pong, Basketball (all 3D) · Whot · Chess · Checkers · Four in a Row · Sea Battle · Reversi · Dots & Boxes · Mancala · Gomoku · Tic-Tac-Toe · Rock Paper Scissors

**Accounts:** username + password (scrypt-hashed), profile photo, gender. Head-to-head records and presence ("was here 2h ago") are kept in `data/`.

No API keys or accounts needed. It's a small Node server (Express + Socket.io) that keeps the rooms and checks every move.

## Run it

```bash
npm install
npm start          # http://localhost:3000
```

To play someone on the same Wi-Fi, open `http://<your-mac's-LAN-IP>:3000` on their phone.

## How it works

- `server.js` creates rooms with 5-letter codes, seats two players, validates moves, and handles rematches, chat, resigning and reconnects (refreshing the page puts you back in your seat).
- `shared/games/*.js` holds each game's rules. The server uses them to validate moves and the browser uses them to show legal moves.
- `public/render/*.js` draws each game. Boards are CSS 3D surfaces; pool is a three.js scene (`public/js/pool3d.js`).
- `public/js/chat.js` is the floating chat (typing indicator, unread badge, message banner).
- `public/css/tokens.css` holds the design tokens; everything else references them.
- Fonts (Geist), icons (Phosphor) and three.js are served from `node_modules` under `/vendor`, so there are no CDN calls.
- Pool physics is deterministic (only `+ - * /` and `sqrt`), so the server and both browsers simulate every shot identically. The server's result is the official one.

## Add a game

1. Create `shared/games/<id>.js` exporting `meta`, `init()`, and `move(state, player, move)` (throw an `Error` for illegal moves; set `state.winner` to `0`, `1` or `'draw'`). Optionally export `view(state, player)` to hide information.
2. Create `public/render/<id>.js` exporting `mount(el, { send })` that returns `{ update(state, meta) }`.
3. Register it in `shared/games/index.js` and add card art in `public/js/art.js`.

## Deploy

Socket.io needs a long-running server, so use a host like **Render**, **Railway** or **Fly.io** rather than serverless (for example, Vercel functions).
On Render: New → Web Service → connect the repo → build `npm install`, start `npm start`. Done.

Rooms are kept in memory, so a server restart ends games in progress.

## Deploying

The site is two parts:

- **Game server** (`server.js`) on **Render**: accounts, rooms and live play over Socket.io. `render.yaml` describes it.
  Set `MONGODB_URI` (a MongoDB Atlas connection string) so data survives restarts, and `CORS_ORIGIN` to the website's address.
- **Website** (`public/`, built by `build.mjs` into `dist/`) on **Vercel**. Set `API_URL` to the Render server's address, e.g. `https://lovestep-api.onrender.com`.
- **Movie Night** searches YouTube for full films on the server; set `YOUTUBE_API_KEY` on Render (and in an untracked `.env` locally).

Locally, `npm run dev` serves both from one place and keeps data in `./data`.
