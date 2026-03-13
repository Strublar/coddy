# Coddy - Discord Bot for Automated Coding

Coddy is a Discord bot that orchestrates Claude CLI to automate coding tasks and open Pull Requests on GitHub.

## How it works

1. **`/plan`** → Haiku breaks the directive into 2-6 atomic PRs → displayed for approval
2. **`/execute`** → for each step: clone repo, run Claude CLI, commit, push, open PR, wait for `/approve`
3. **`/approve`** → merge PR, move to next step

## Commands

- `/plan directive:"..." repo:my-repo` — generate a PR plan (no code written yet)
- `/execute [from_step:N]` — execute the plan step by step
- `/approve` — merge current PR and continue
- `/reject reason:"..."` — close current PR and stop
- `/revise feedback:"..."` — ask Claude CLI to revise the current PR
- `/status` — list active tasks

## Prerequisites

- Node.js 18+
- Claude CLI installed and configured
- Discord Bot with appropriate permissions
- GitHub Personal Access Token

## Setup

1. Clone this repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and fill in your tokens
4. Run: `npm start`

## Environment Variables

See `.env.example` for required configuration:

- `DISCORD_TOKEN` - Your Discord bot token
- `DISCORD_CLIENT_ID` - Your Discord application client ID
- `DISCORD_GUILD_ID` - Your Discord server guild ID
- `GITHUB_TOKEN` - GitHub Personal Access Token
- `GITHUB_OWNER` - Your GitHub username or organization
- `ANTHROPIC_API_KEY` - Your Anthropic API key
- `WORK_DIR` - Directory for temporary workspaces

## Project Structure

```
coddy/
├── src/
│   ├── bot/           # Discord bot implementation
│   ├── orchestrator/  # Plan generation and orchestration
│   ├── claude/        # Claude CLI subprocess wrapper
│   ├── github/        # GitHub API operations
│   └── utils/         # Task store and logging utilities
├── package.json
└── .env.example
```

## Development

- `npm start` - Start the bot
- `npm run dev` - Start with file watching

## License

MIT