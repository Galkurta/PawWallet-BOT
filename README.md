# PAW Wallet Bot Automation

A Node.js automation script for PAW Wallet mining game.

## Features

- Automatic mining session management
- Mission verification and rewards claiming
- Heart replenishment
- Player upgrades
- Referral system integration
- Auto-claim optimization
- Leaderboard tracking

## Prerequisites

- Node.js 16 or higher
- NPM (Node Package Manager)

## Installation

1. Clone this repository:

```bash
git clone https://github.com/Galkurta/PawWallet-BOT
cd PawWallet-BOT
```

2. Install dependencies:

```bash
npm install
```

3. Register for PAW Wallet:

   - Visit [PAW Wallet Bot](https://t.me/Pawwalletbot?start=g6944804952)
   - Follow the registration process
   - Copy your authorization token

4. Configure the bot:
   - Create `data.txt` in the project root
   - Paste your authorization token

## Usage

Run the bot:

```bash
node main.js
```

The bot will:

- Auto-manage mining sessions
- Claim rewards at optimal times
- Purchase hearts when needed
- Process available missions
- Track leaderboard position

## Configuration

- Default refresh interval: 1 hour
- Mining claim threshold: 95% of bag capacity
- Heart purchase threshold: < 3 hearts

## Dependencies

- axios: HTTP client
- winston: Logging
- figlet: CLI banner
- luxon: DateTime handling

## License

MIT License - feel free to use and modify
