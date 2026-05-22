---
name: new-slash-command
description: Use when asked to add a new Discord slash command to the Anime Arena bot
---
When adding a new Discord slash command:
1. Register the command via Discord REST API:
   PUT https://discord.com/api/v10/applications/{APP_ID}/commands
   with the command name, description, and options in the body
2. Add a handler case in bot/src/index.ts matching the command name
3. The handler should call the appropriate Supabase RPC with service role key
4. Return a Discord interaction response (type 4 for immediate, type 5 for deferred)
5. Deploy with: wrangler deploy bot/
