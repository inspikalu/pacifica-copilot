import { env } from "@/lib/env";

/**
 * Sends a message to a Telegram chat using the Telegram Bot API.
 * Uses HTML formatting for clean, professional-looking alerts.
 * 
 * @param text The message content (can include HTML syntax like <b>, <i>, <code>).
 */
export async function sendTelegramMessage(text: string) {
  const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = env;

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn("[Telegram] Bot token or Chat ID not configured. Skipping notification.");
    return;
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: "HTML",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Telegram API Error (${response.status}): ${errorText}`);
    }

    console.log("[Telegram] Message sent successfully.");
  } catch (error) {
    console.error("[Telegram] Failed to send message:", error);
  }
}

/**
 * Escapes characters for Telegram HTML formatting.
 */
export function escapeHTML(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
