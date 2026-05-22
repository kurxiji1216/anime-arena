---
name: deploy
description: Use ONLY when explicitly asked to deploy — requires confirmation
disable-model-invocation: true
---
STOP — deployment requires explicit user confirmation before proceeding.

Ask the user: "Are you sure you want to deploy? Please confirm with yes/no."

If confirmed:
- Web app: git push to main (Vercel auto-deploys)
- Discord bot: wrangler deploy bot/
- Always run pnpm typecheck before deploying
