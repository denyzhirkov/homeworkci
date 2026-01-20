import { Notifications } from "@mui/icons-material";
import { ModuleDoc } from "../../../components/DocumentationComponents.tsx";

export function NotifyModule() {
  return (
    <ModuleDoc
      id="mod-notify"
      icon={<Notifications fontSize="small" />}
      title="notify"
      description="Sends notifications to messaging platforms. Supports Telegram and Slack."
      params={[
        { name: 'type', type: '"telegram" | "slack"', required: true, description: 'Notification platform' },
        { name: 'message', type: 'string', required: true, description: 'Message text' },
        { name: 'token', type: 'string', description: 'Telegram: Bot API token' },
        { name: 'chatId', type: 'string', description: 'Telegram: Chat or channel ID' },
        { name: 'parseMode', type: '"HTML" | "Markdown"', description: 'Telegram: Message formatting mode' },
        { name: 'webhook', type: 'string', description: 'Slack: Incoming Webhook URL' },
        { name: 'channel', type: 'string', description: 'Slack: Channel override (e.g., #deploys)' },
        { name: 'username', type: 'string', description: 'Slack: Username override' },
        { name: 'iconEmoji', type: 'string', description: 'Slack: Icon emoji (e.g., :rocket:)' },
        { name: 'attachments', type: 'array', description: 'Slack: Rich message attachments' }
      ]}
      returns='Telegram: { "success": true, "messageId": 12345 }. Slack: { "success": true }'
      example={`// Telegram notification
{
  "module": "notify",
  "params": {
    "type": "telegram",
    "token": "\${env.TG_BOT_TOKEN}",
    "chatId": "\${env.TG_CHAT_ID}",
    "message": "<b>Build completed!</b>\\nStatus: ✅",
    "parseMode": "HTML"
  }
}

// Slack notification
{
  "module": "notify",
  "params": {
    "type": "slack",
    "webhook": "\${env.SLACK_WEBHOOK_URL}",
    "message": "✅ Deploy successful!",
    "channel": "#deploys",
    "iconEmoji": ":rocket:"
  }
}`}
    />
  );
}
