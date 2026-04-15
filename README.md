# 🏄 Pacifica Risk Copilot

The **Pacifica Risk Copilot** is an institutional-grade, real-time risk management terminal for Pacifica traders. It combines sub-second market data integration with automated defensive heuristics to protect traders from liquidation during high-volatility events.

## 🔐 Security Model: Non-Custodial Multi-Tenancy

Unlike typical server-side trading bots, the Copilot uses a **Zero-Knowledge Private Key Architecture**:

1. **Client-Side Encryption**: Your Agent private key is encrypted in your browser using AES-256-GCM and a PBKDF2-derived key from your session passphrase.
2. **Encrypted Storage**: The server only ever stores the ciphertext, salt, and IV. Your plaintext private key **never** touches our database.
3. **In-Memory Execution**: The private key is only decrypted in the server's volatile memory for the duration of a single trade request (Reduce, Cancel, Panic), using the passphrase you provide in-flight.
4. **Non-Custodial**: Without your session passphrase, the server is a read-only risk dashboard.

## 🛠 Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: Prisma + Postgres (Neon recommended)
- **Auth**: Sign-In with Solana (SIWS) + JWT
- **Crypto**: Web Crypto API (Client) / Node:Crypto (Server)
- **Market Data**: Direct Pacifica REST & WebSocket
- **Styling**: Vanilla CSS (Terminal Aesthetic)

## 🚀 Self-Hosted Deployment

To run your own instance of the Copilot:

### 1. Prerequisites
- A Pacifica account and an **Agent Wallet** (delegated sub-wallet).
- A Postgres database (e.g., Supabase or Neon).
- API Keys for Groq (AI Insights) and Elfa AI (Social Sentiment).

### 2. Environment Setup
Rename `.env.example` to `.env` and configure:

```env
DATABASE_URL="postgresql://..."
NEXT_PUBLIC_PACIFICA_WS_URL="wss://test-ws.pacifica.fi/ws"
PACIFICA_API_URL="https://test-api.pacifica.fi"
# Auth Secret (generate a long random string)
SESSION_SECRET="your-32-character-secret-key"
# AI Providers
GROQ_API_KEY="gsk_..."
ELFA_API_KEY="elfa_..."
# Notifications
TELEGRAM_BOT_TOKEN="optional"
TELEGRAM_CHAT_ID="optional"
```

### 3. Install & Initialize
```bash
npm install
npx prisma db push
npm run dev
```

### 4. Connect
1. Navigate to `http://localhost:3000/onboard`.
2. **Establish Identity**: Sign in with your Solana wallet (SIWS).
3. **Link Account**: Enter your main Pacifica account address.
4. **Authorize Agent**: Enter your Agent Wallet address and its private key. Set a strong **Session Passphrase**.
5. Your dashboard is now live!

## 🌪 Action Commands

- **Risk Score**: Real-time composite score based on leverage, concentration, and liquidation room.
- **TP/SL**: Rapidly set protective triggers on any open position.
- **Reduce**: Instantly shrink exposure on specific symbols.
- **Panic Mode**: A 3-phase emergency sequence (Cancel All → Reduce Largest 50% → Harden all SL).
- **AI Insights**: Contextual risk analysis using live position state and social sentiment.

---

*This project was built for the Pacifica Hackathon.*
