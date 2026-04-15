import OpenAI from "openai";

import { getTokenSentiment } from "@/server/elfa";
import type { AlertRow, AgentInsight, PositionRow } from "@/types/domain";

// ---------------------------------------------------------------------------
// Rule-based fallback — always runs if no OPENAI_API_KEY is set, or if the
// LLM call fails. Ensures system safety in all operational environments.
// ---------------------------------------------------------------------------
function generateRuleBasedInsights(
  positions: PositionRow[],
  alerts: Omit<AlertRow, "id" | "status" | "triggeredAt">[],
  riskScore: number,
): AgentInsight[] {
  const insights: AgentInsight[] = [];
  const now = new Date();

  // Rule 1: High concentration
  const concentrated = positions.find((p) => p.concentrationPct >= 50);
  if (concentrated) {
    insights.push({
      id: `rule-conc-${concentrated.symbol}`,
      timestamp: now.toISOString(),
      text: `Portfolio is heavily overweight on ${concentrated.symbol} (${concentrated.concentrationPct}% of open notional). If this asset drops, your entire account will be impacted. Recommend a 25% surgical reduction to balance the risk.`,
      severity: "CRITICAL",
      actionPayload: {
        type: "REDUCE_POSITION",
        symbol: concentrated.symbol,
        side: concentrated.side,
        suggestedSize: Number((concentrated.size * 0.25).toFixed(4)),
      },
    });
  }

  // Rule 2: High leverage
  const highLev = positions.find((p) => p.leverage >= 10);
  if (highLev) {
    insights.push({
      id: `rule-tpsl-${highLev.symbol}`,
      timestamp: new Date(now.getTime() - 2000).toISOString(),
      text: `${highLev.symbol} is running at ${highLev.leverage.toFixed(1)}x leverage. This is aggressive; any 8-10% move against you will trigger liquidation. Setting a 2% protective stop-loss is strongly recommended.`,
      severity: "WARNING",
      actionPayload: {
        type: "SET_TPSL",
        symbol: highLev.symbol,
        side: highLev.side,
        suggestedTakeProfit: Number(
          (highLev.markPrice * (highLev.side === "LONG" ? 1.05 : 0.95)).toFixed(2),
        ),
        suggestedStopLoss: Number(
          (highLev.markPrice * (highLev.side === "LONG" ? 0.98 : 1.02)).toFixed(2),
        ),
      },
    });
  }

  // Rule 3: Tight liquidation buffer
  const tightLiq = positions.find(
    (p) => p.liquidationBufferPct !== null && p.liquidationBufferPct !== undefined && p.liquidationBufferPct <= 8,
  );
  if (tightLiq) {
    insights.push({
      id: `rule-liq-${tightLiq.symbol}`,
      timestamp: new Date(now.getTime() - 4000).toISOString(),
      text: `${tightLiq.symbol} Safety Gap is critical (${tightLiq.liquidationBufferPct}%). You are dangerously close to an automatic force-closure. Click below to instantly reduce exposure and widen your safety gap.`,
      severity: "CRITICAL",
      actionPayload: {
        type: "REDUCE_POSITION",
        symbol: tightLiq.symbol,
        side: tightLiq.side,
        suggestedSize: Number((tightLiq.size * 0.5).toFixed(4)),
      },
    });
  }

  // Rule 4: Elevated overall risk score with drawdown
  if (riskScore >= 72 && alerts.some((a) => a.title.includes("drawdown"))) {
    insights.push({
      id: `rule-cancel-${now.getTime()}`,
      timestamp: new Date(now.getTime() - 6000).toISOString(),
      text: `Composite risk is high (${riskScore}/100) and account equity is slipping. To protect your remaining balance, we recommend cancelling all open limit orders to prevent unintended further exposure.`,
      severity: "WARNING",
      actionPayload: { type: "CANCEL_ALL" },
    });
  }

  // Fallback: account is safe
  if (insights.length === 0) {
    insights.push({
      id: `rule-safe-${now.getTime()}`,
      timestamp: now.toISOString(),
      text: "Account is stable. Leverage is well-managed and funding rates are benign across all active positions.",
      severity: "INFO",
    });
  }

  return insights.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

// ---------------------------------------------------------------------------
// OpenAI-powered insight generation
// ---------------------------------------------------------------------------
const LLM_SYSTEM_PROMPT = `You are a Senior Risk Officer embedded inside a real-time trading dashboard for Pacifica. 

Your mission: Translate complex derivatives data into plain-English, executive-level insights that protect the trader's capital.

Context:
- PACIFICA metrics: Leverage, Concentration, Liquidation Buffer, PnL.
- ELFA AI metrics: Social sentiment (Bullish/Bearish).

Rules:
1. EDUCATORS' FIRST: Translate technical terms into impact. For 'Liquidation Buffer', always use terms like 'Safety Gap' or 'Danger Zone'. Explain that liquidation means 'automatic force-closure of your position'.
2. SENTIMENT WEIGHTING: Treat Elfa AI sentiment as a 'Leading Indicator'. If Bearish sentiment is >70% and the trader is LONG, you MUST recommend a protective reduction (25-50% cut), even if the PnL is currently positive.
3. ACTIONABLE: Every insight except strictly informational ones MUST have an actionPayload. 
4. SURGICAL REDUCTION: Recommending 'REDUCE_POSITION' is your primary tool. Suggest specific percentages (e.g. 'Reduce by 25% to widen your safety gap to 15%').
5. TERMINOLOGY: 
   - Liquidation Buffer -> 'Safety Gap' (The room you have before price hits your liquidation point).
   - Drawdown -> 'Account Slide' (Loss from your recent peak).
   - Funding -> 'Holding Cost' (The daily interest paid to stay leveraged).

Your response MUST be a valid JSON array of insight objects. Each object has this exact shape:
{
  "id": "string (unique, e.g. llm-1)",
  "timestamp": "ISO 8601 string",
  "text": "1-3 sentences. Educational, urgent but professional. Start with the 'So What' (e.g. 'Safety Gap is critical on BTC...')",
  "severity": "INFO" | "WARNING" | "CRITICAL",
  "actionPayload": {
    "type": "REDUCE_POSITION" | "SET_TPSL" | "CANCEL_ALL" | "PANIC_MODE",
    "symbol": "string (optional)",
    "side": "LONG" | "SHORT" (optional),
    "suggestedSize": number (optional, for REDUCE_POSITION),
    "suggestedTakeProfit": number (optional, for SET_TPSL),
    "suggestedStopLoss": number (optional, for SET_TPSL)
  }
}

Output ONLY valid JSON.`;

async function generateLlmInsights(
  positions: PositionRow[],
  alerts: Omit<AlertRow, "id" | "status" | "triggeredAt">[],
  riskScore: number,
  apiKey: string,
): Promise<AgentInsight[]> {
  // Support both Groq (gsk_) and OpenAI (sk-) keys seamlessly for hackathons
  const isOpenAI = apiKey.startsWith("sk-");
  const baseURL = isOpenAI ? "https://api.openai.com/v1" : "https://api.groq.com/openai/v1";
  const model = isOpenAI ? "gpt-4o-mini" : "llama-3.1-8b-instant";

  const client = new OpenAI({
    apiKey,
    baseURL,
  });

  const uniqueSymbols = Array.from(new Set(positions.map((p) => p.symbol)));
  const sentimentsResponse = await Promise.all(
    uniqueSymbols.map((sym) => getTokenSentiment(sym))
  );
  const socialSentiment = sentimentsResponse.filter(Boolean);

  const userContent = JSON.stringify(
    {
      currentTime: new Date().toISOString(),
      riskScore,
      positions: positions.map((p) => ({
        symbol: p.symbol,
        side: p.side,
        size: p.size,
        leverage: p.leverage,
        markPrice: p.markPrice,
        entryPrice: p.entryPrice,
        unrealizedPnl: p.unrealizedPnl,
        liquidationPrice: p.liquidationPrice,
        liquidationBufferPct: p.liquidationBufferPct,
        concentrationPct: p.concentrationPct,
        estimatedFundingHourlyUsd: p.estimatedFundingHourlyUsd,
      })),
      activeAlerts: alerts.map((a) => ({
        title: a.title,
        message: a.message,
        severity: a.severity,
        symbol: a.symbol,
      })),
      socialSentiment,
    },
    null,
    2,
  );

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.3,
    max_tokens: 800,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: LLM_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Here is the current account state:\n\n${userContent}\n\nReturn a JSON object with a single key "insights" containing the array.`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as { insights?: AgentInsight[] };
  const insights = parsed.insights;

  if (!Array.isArray(insights) || insights.length === 0) {
    throw new Error("LLM returned empty or malformed insights array.");
  }

  return insights;
}

// ---------------------------------------------------------------------------
// Public export — orchestrates LLM with rule-based fallback
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Cache & Throttling logic — ensures we don't bleed Groq tokens on every sync
// ---------------------------------------------------------------------------
let cachedInsights: AgentInsight[] = [];
let lastInsightTime = 0;
let lastStateHash = "";

const INSIGHT_CACHE_TTL = 60_000; // 60 seconds

export async function generateAgentInsights(
  positions: PositionRow[],
  alerts: Omit<AlertRow, "id" | "status" | "triggeredAt">[],
  riskScore: number,
): Promise<AgentInsight[]> {
  const { env } = await import("@/lib/env");
  const apiKey = env.GROQ_API_KEY;

  if (!apiKey) {
    console.warn("[Agent] GROQ_API_KEY not set — using rule-based insights.");
    return generateRuleBasedInsights(positions, alerts, riskScore);
  }

  // Create a fingerprint of the current state to detect significant changes
  const currentStateHash = `${positions.length}-${riskScore}-${alerts.length}`;
  const now = Date.now();
  const isStale = now - lastInsightTime > INSIGHT_CACHE_TTL;
  const hasChangedSignificantly = currentStateHash !== lastStateHash;

  if (!isStale && !hasChangedSignificantly && cachedInsights.length > 0) {
    console.log("[Agent] Returning cached insights (token conservation mode).");
    return cachedInsights;
  }

  try {
    const insights = await generateLlmInsights(positions, alerts, riskScore, apiKey);
    console.log(`[Agent] Groq/Llama returned ${insights.length} NEW insights.`);
    
    cachedInsights = insights;
    lastInsightTime = now;
    lastStateHash = currentStateHash;
    
    return insights;
  } catch (error) {
    console.error("[Agent] LLM call failed, falling back to rule-based or cache:", error);
    if (cachedInsights.length > 0) return cachedInsights;
    return generateRuleBasedInsights(positions, alerts, riskScore);
  }
}
