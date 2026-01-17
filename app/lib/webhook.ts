import { WEBHOOK_CONFIG } from "@/config"

export interface EmailMessage {
  emailId: string
  messageId: string
  fromAddress: string
  subject: string
  content: string
  html: string
  receivedAt: string
  toAddress: string
}

export interface WebhookPayload {
  event: typeof WEBHOOK_CONFIG.EVENTS[keyof typeof WEBHOOK_CONFIG.EVENTS]
  data: EmailMessage
}

export async function callWebhook(url: string, payload: WebhookPayload) {
  const isDingTalk = /oapi\.dingtalk\.com\/robot\/send/i.test(url)

  const finalBody = isDingTalk
    ? {
      msgtype: "markdown",
      markdown: {
        title: `新邮件: ${payload.data.subject}`,
        text: [
          "#### **收到一封新邮件**",
          `**发件人:** ${payload.data.fromAddress}`,
          `**收件人:** ${payload.data.toAddress}`,
          `**主题:** ${payload.data.subject}`,
          `**时间:** ${payload.data.receivedAt}`,
        ].join("\n\n"),
      },
    }
    : {
      fromAddress: payload.data.fromAddress,
      toAddress: payload.data.toAddress,
      subject: payload.data.subject,
      receivedAt: payload.data.receivedAt
    }

  let lastError: Error | null = null
  
  for (let i = 0; i < WEBHOOK_CONFIG.MAX_RETRIES; i++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_CONFIG.TIMEOUT)

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Event": payload.event,
        },
        body: JSON.stringify(finalBody),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        return true
      }

      lastError = new Error(`HTTP error! status: ${response.status}`)
    } catch (error) {
      lastError = error as Error
      
      if (i < WEBHOOK_CONFIG.MAX_RETRIES - 1) {
        await new Promise(resolve => setTimeout(resolve, WEBHOOK_CONFIG.RETRY_DELAY))
      }
    }
  }

  throw lastError
} 