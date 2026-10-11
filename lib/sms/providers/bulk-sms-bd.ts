/**
 * BulkSMSBD / Alpha SMS Bangladesh provider
 * Docs: https://bulksmsbd.net/
 * Env vars: BULK_SMS_BD_API_KEY, BULK_SMS_BD_SENDER_ID
 */
import type { SmsProvider } from '../index'

const API_URL = 'https://bulksmsbd.net/api/smsapi'

export class BulkSmsBdProvider implements SmsProvider {
  private readonly apiKey: string
  private readonly senderId: string

  constructor() {
    this.apiKey   = process.env.BULK_SMS_BD_API_KEY ?? ''
    this.senderId = process.env.BULK_SMS_BD_SENDER_ID ?? '8809617612345'

    if (!this.apiKey) {
      console.warn('[bulk-sms-bd] Missing BULK_SMS_BD_API_KEY')
    }
  }

  async send(to: string, message: string): Promise<{ success: boolean; error?: string; messageId?: string }> {
    try {
      const msisdn = to.replace(/\D/g, '')  // keep all digits including 880 prefix

      const params = new URLSearchParams({
        api_key:   this.apiKey,
        type:      'text',
        number:    msisdn,
        senderid:  this.senderId,
        message,
      })

      const res  = await fetch(`${API_URL}?${params.toString()}`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      })

      const json = await res.json().catch(() => null)
      // BulkSMSBD returns { response_code: "202", success_message: "SMS Submitted Successfully", ... }
      const success = json?.response_code === '202'

      if (!success) {
        return { success: false, error: json?.error_message ?? 'Send failed' }
      }
      return { success: true, messageId: json?.send_id }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
}
