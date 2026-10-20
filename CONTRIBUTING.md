# DrillKe — Contributing

Thanks for helping. You do not need to be a developer to contribute.

## Ways to help

| If you are... | You can... |
|---|---|
| A fan who knows the language | Submit lyrics, timestamps and Sheng/slang annotations |
| A listener | Report errors, suggest songs and artists |
| An artist or rights holder | Submit or approve lyrics for your own songs |
| A designer | Improve the player, mobile layouts and accessibility |
| A developer | Pick up a `good first issue` |
| A writer or journalist | Contribute interviews and scene stories |

## Developer workflow

### Option A — Containerized (recommended)

```bash
cp .env.example .env
npm run dev:stack      # hot-reloading web (:3000) & api (:4000) inside Docker
npm run docker:check   # containerized typecheck + test + lint
```

### Option B — Local processes

```bash
npm install
cp .env.example .env
npm run db:up
npm run prisma:migrate
npm run db:seed
npm run dev        # web  :3000
npm run dev:api    # api  :4000
```

1. Branch: `feat/short-description` or `fix/short-description`.
2. Write tests for new logic — especially lyrics parsing and timing
   (`packages/shared`), which is pure and must stay dependency-free.
3. Run `npm run docker:check` (or `npm run typecheck && npm test`) before opening a PR.
4. Open a PR describing the change, the motivation and any screenshots.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/):
`feat(player): add click-to-seek` · `fix(parser): handle missing millis`.

## Lyrics contributions

- Only submit lyrics you have the right to share.
- Follow the format in [`docs/lyrics-format.md`](docs/lyrics-format.md).
- Be accurate; prefer the artist's own published lines.
- Keep annotations factual and respectful.

## Code conventions

- TypeScript everywhere, `strict` on. No `any` in new code without a comment.
- Pure logic goes in `packages/shared` with a `.test.ts` beside it; Nest
  modules stay thin and delegate to their service.
- Public reads are server-rendered and cacheable; never put secrets in
  `NEXT_PUBLIC_*`.
- Docs move with the code: change a contract, update `docs/api.md` or
  `docs/lyrics-format.md` in the same PR.
