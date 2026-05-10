// Telegram bot push helper — ใช้ใน cron alerts
//
// ENV ที่ต้องตั้งใน Vercel:
//   TELEGRAM_BOT_TOKEN  จาก @BotFather
//   TELEGRAM_CHAT_ID    chat id ของคุณเอง (ดู docs/SOLAR_ALERTS.md)

export type TelegramSendOptions = {
  parseMode?: "Markdown" | "HTML";
  disablePreview?: boolean;
};

export async function sendTelegramMessage(text: string, options: TelegramSendOptions = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    throw new Error("TELEGRAM_BOT_TOKEN หรือ TELEGRAM_CHAT_ID ยังไม่ได้ตั้งใน Vercel env");
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: options.parseMode ?? "Markdown",
      disable_web_page_preview: options.disablePreview ?? true,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram API ${res.status}: ${body.slice(0, 200)}`);
  }

  return res.json() as Promise<{ ok: boolean; result?: { message_id: number } }>;
}
