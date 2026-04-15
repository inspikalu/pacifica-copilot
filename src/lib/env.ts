import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  USE_TESTNET_MODE: z.enum(["true", "false"]).default("true"),
  
  // Security
  SESSION_SECRET: z.string().min(32).default("your-secret-must-be-32-chars-long-!!!"),

  PACIFICA_TESTNET_API_URL: z.string().url().default("https://test-api.pacifica.fi/api/v1"),
  PACIFICA_TESTNET_WS_URL: z.string().min(1).default("wss://test-ws.pacifica.fi/ws"),
  PACIFICA_TESTNET_ACCOUNT_ADDRESS: z.string().optional(),
  PACIFICA_TESTNET_AGENT_PRIVATE_KEY: z.string().optional(),
  PACIFICA_TESTNET_AGENT_WALLET: z.string().optional(),

  PACIFICA_MAINNET_API_URL: z.string().url().default("https://api.pacifica.fi/api/v1"),
  PACIFICA_MAINNET_WS_URL: z.string().min(1).default("wss://api.pacifica.fi/ws"),
  PACIFICA_MAINNET_ACCOUNT_ADDRESS: z.string().optional(),
  PACIFICA_MAINNET_AGENT_PRIVATE_KEY: z.string().optional(),
  PACIFICA_MAINNET_AGENT_WALLET: z.string().optional(),

  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),

  GROQ_API_KEY: z.string().optional(),
  ELFA_API_KEY: z.string().optional(),

  // Builder Program
  PACIFICA_BUILDER_ENABLED: z.coerce.string().transform(v => v === "true").default("false"),
  PACIFICA_BUILDER_CODE: z.string().optional(),
  PACIFICA_BUILDER_FEE_RATE: z.coerce.number().optional(),
});

const parsed = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  USE_TESTNET_MODE: process.env.USE_TESTNET_MODE,
  SESSION_SECRET: process.env.SESSION_SECRET,
  
  PACIFICA_TESTNET_API_URL: process.env.PACIFICA_TESTNET_API_URL,
  PACIFICA_TESTNET_WS_URL: process.env.PACIFICA_TESTNET_WS_URL,
  PACIFICA_TESTNET_ACCOUNT_ADDRESS: process.env.PACIFICA_TESTNET_ACCOUNT_ADDRESS,
  PACIFICA_TESTNET_AGENT_PRIVATE_KEY: process.env.PACIFICA_TESTNET_AGENT_PRIVATE_KEY,
  PACIFICA_TESTNET_AGENT_WALLET: process.env.PACIFICA_TESTNET_AGENT_WALLET,

  PACIFICA_MAINNET_API_URL: process.env.PACIFICA_MAINNET_API_URL,
  PACIFICA_MAINNET_WS_URL: process.env.PACIFICA_MAINNET_WS_URL,
  PACIFICA_MAINNET_ACCOUNT_ADDRESS: process.env.PACIFICA_MAINNET_ACCOUNT_ADDRESS,
  PACIFICA_MAINNET_AGENT_PRIVATE_KEY: process.env.PACIFICA_MAINNET_AGENT_PRIVATE_KEY,
  PACIFICA_MAINNET_AGENT_WALLET: process.env.PACIFICA_MAINNET_AGENT_WALLET,

  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,

  GROQ_API_KEY: process.env.GROQ_API_KEY,
  ELFA_API_KEY: process.env.ELFA_API_KEY,

  PACIFICA_BUILDER_ENABLED: process.env.PACIFICA_BUILDER_ENABLED,
  PACIFICA_BUILDER_CODE: process.env.PACIFICA_BUILDER_CODE,
  PACIFICA_BUILDER_FEE_RATE: process.env.PACIFICA_BUILDER_FEE_RATE,
});

const isTestnet = parsed.USE_TESTNET_MODE === "true";

export const env = {
  ...parsed,
  PACIFICA_API_URL: isTestnet ? parsed.PACIFICA_TESTNET_API_URL : parsed.PACIFICA_MAINNET_API_URL,
  PACIFICA_WS_URL: isTestnet ? parsed.PACIFICA_TESTNET_WS_URL : parsed.PACIFICA_MAINNET_WS_URL,
  PACIFICA_ACCOUNT_ADDRESS: isTestnet ? parsed.PACIFICA_TESTNET_ACCOUNT_ADDRESS : parsed.PACIFICA_MAINNET_ACCOUNT_ADDRESS,
  PACIFICA_AGENT_PRIVATE_KEY: isTestnet ? parsed.PACIFICA_TESTNET_AGENT_PRIVATE_KEY : parsed.PACIFICA_MAINNET_AGENT_PRIVATE_KEY,
  PACIFICA_AGENT_WALLET: isTestnet ? parsed.PACIFICA_TESTNET_AGENT_WALLET : parsed.PACIFICA_MAINNET_AGENT_WALLET,
};
