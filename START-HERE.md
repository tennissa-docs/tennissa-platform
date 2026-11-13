# Start here: building TENNISSA with Claude Code on your computer

This folder is the starting point of your codebase. It holds the plan, the database design, the design system and your logo. Claude Code reads `CLAUDE.md` automatically, so it knows every decision already made.

## 1. Install what you need (once)

- **Claude Code**
  - macOS, Linux or WSL: `curl -fsSL https://claude.ai/install.sh | bash` (or `brew install --cask claude-code`)
  - Windows PowerShell: `irm https://claude.ai/install.ps1 | iex`
  - Then run `claude` once and sign in with your Claude account.
- **Git** and **Node.js 20 or newer** (https://nodejs.org).
- **Postgres** for the local database (optional at first): Postgres.app on Mac, or Docker. Only needed to run `replica/db-tests/run.sh` locally.

## 2. Put this folder in your GitHub repo

Unzip this folder, then in a terminal inside it:

```bash
git init
git add .
git commit -m "Plan, schema, design system and brand from the Replica recon"
git branch -M main
git remote add origin https://github.com/tennissa-docs/tennissa-platform.git
git push -u origin main
```

(Use the account that has access to `tennissa-docs`. If the push is refused, add yourself as a collaborator with Write access first.)

## 3. Start Claude Code and add the Replica skills

```bash
cd tennissa-platform
claude
```

Inside Claude Code:

```
/plugin marketplace add Jakeschincariol/replica-skill
/plugin install replica-skill@replica-skill
```

## 4. Build

Inside Claude Code, type:

```
/replica-build Start with the vertical slice described in CLAUDE.md.
```

Claude Code will scaffold the Next.js app, apply `replica/schema.sql`, and build the first gift end to end in Stripe test mode. It will ask before installing packages or running commands.

## 5. Accounts (when Claude Code asks for them, not before)

Supabase (database + sign-in) · Stripe (test mode first) · Resend (email) · Vercel (hosting). Keys go in a `.env.local` file that is never committed. Claude Code will tell you exactly which values to copy; never paste passwords into the chat.

## Useful commands

- Check the database rules: `cd replica/db-tests && ./run.sh` (needs local Postgres; uses a throwaway database)
- Check colour contrast after any colour change: `python3 replica/design/contrast.py replica/design/tokens.json`
- See the design system: open `replica/design/preview.html` in your browser
