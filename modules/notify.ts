// Sends notifications to messaging platforms.
// Tags: built-in
//
// Usage Example (Telegram):
// {
//   "module": "notify",
//   "params": {
//     "type": "telegram",
//     "token": "${env.TG_BOT_TOKEN}",
//     "chatId": "${env.TG_CHAT_ID}",
//     "message": "Pipeline completed successfully!"
//   }
// }
//
// Full params:
// {
//   "module": "notify",
//   "params": {
//     "type": "telegram",              // Notification type (required)
//     "token": "123456:ABC...",        // Bot API token (required)
//     "chatId": "-1001234567890",      // Chat/channel ID (required)
//     "message": "Hello!",             // Message text (required)
//     "parseMode": "HTML"              // Optional: "HTML" or "Markdown"
//   }
// }
//
// Returns: { "success": true, "messageId": 12345 }
//
// Usage in Pipeline:
// {
//   "name": "Build and Notify",
//   "env": "production",
//   "steps": [
//     {
//       "name": "build",
//       "module": "shell",
//       "params": { "cmd": "npm run build" }
//     },
//     {
//       "name": "notify_success",
//       "description": "Send Telegram notification on build success",
//       "module": "notify",
//       "params": {
//         "type": "telegram",
//         "token": "${env.TG_BOT_TOKEN}",
//         "chatId": "${env.TG_CHAT_ID}",
//         "message": "<b>✅ Build successful!</b>\n\nPipeline: ${pipelineId}\nExit code: ${results.build.code}",
//         "parseMode": "HTML"
//       }
//     }
//   ]
// }
//
// Note: To get a Telegram bot token, talk to @BotFather.
// To get chat ID, add the bot to a chat and use the getUpdates API.
// For group chats, the chat ID is usually negative (e.g., -1001234567890).
// For channels, use @channel_username or the numeric ID.

import type { PipelineContext } from "../server/types/index.ts";

/** Schema for editor hints */
export const schema = {
  params: {
    type: {
      type: "string",
      required: true,
      enum: ["telegram"],
      description: "Notification platform type"
    },
    token: {
      type: "string",
      required: true,
      description: "Bot API token (use ${env.TG_BOT_TOKEN} for security)"
    },
    chatId: {
      type: "string",
      required: true,
      description: "Chat or channel ID (use ${env.TG_CHAT_ID} for security)"
    },
    message: {
      type: "string",
      required: true,
      description: "Message text. Supports interpolation: ${results.build.code}"
    },
    parseMode: {
      type: "string",
      required: false,
      enum: ["HTML", "Markdown"],
      description: "Message parse mode for formatting"
    }
  }
};

export interface NotifyParams {
  type: "telegram";
  token: string;
  chatId: string;
  message: string;
  parseMode?: "HTML" | "Markdown";
}

export async function run(
  ctx: PipelineContext,
  params: NotifyParams
): Promise<{ success: true; messageId: number }> {
  if (!params.type) {
    throw new Error("Notify module requires 'type' parameter");
  }

  if (params.type === "telegram") {
    return await sendTelegram(ctx, params);
  }

  throw new Error(`Unknown notification type: ${params.type}`);
}

async function sendTelegram(
  ctx: PipelineContext,
  params: NotifyParams
): Promise<{ success: true; messageId: number }> {
  if (!params.token) {
    throw new Error("Telegram notification requires 'token' parameter");
  }
  if (!params.chatId) {
    throw new Error("Telegram notification requires 'chatId' parameter");
  }
  if (!params.message) {
    throw new Error("Telegram notification requires 'message' parameter");
  }

  if (ctx.log) ctx.log(`[Notify] Sending Telegram message to chat ${params.chatId}...`);

  const url = `https://api.telegram.org/bot${params.token}/sendMessage`;

  const body: Record<string, string> = {
    chat_id: params.chatId,
    text: params.message,
  };

  if (params.parseMode) {
    body.parse_mode = params.parseMode;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctx.signal,
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      const errorDesc = data.description || "Unknown error";
      throw new Error(`Telegram API error: ${errorDesc}`);
    }

    const messageId = data.result?.message_id;
    if (ctx.log) ctx.log(`[Notify] Telegram message sent, ID: ${messageId}`);

    return { success: true, messageId };
  } catch (e: unknown) {
    if (ctx.signal?.aborted) {
      throw new Error("Pipeline stopped by user");
    }
    throw e;
  }
}

