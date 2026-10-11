/**
 * SSL Wireless Bangladesh SMS provider
 * Docs: https://www.sslwireless.com/
 * Env vars: SSL_WIRELESS_API_TOKEN, SSL_WIRELESS_SID, SSL_WIRELESS_CSMS_ID
 */
import type { SmsProvider } from '../index'

const API_URL = 'http://sms.sslwireless.com/pushapi/dynamic/server.php'

export class SslWirelessProvider implements SmsProvider {
  private readonly apiToken: string
  private readonly sid: string
  private readonly csmsId: string

  constructor() {
    this.apiToken = process.env.SSL_WIRELESS_API_TOKEN ?? ''
    this.sid      = process.env.SSL_WIRELESS_SID ?? ''
    this.csmsId   = process.env.SSL_WIRELESS_CSMS_ID ?? 'SecureEntry'

    if (!this.apiToken || !this.sid) {
      console.warn('[ssl-wireless] Missing SSL_WIRELESS_API_TOKEN or SSL_WIRELESS_SID')
    }
  }

  async send(to: string, message: string): Promise<{ success: boolean; error?: string; messageId?: string }> {
    try {
      // Normalize BD number: strip leading + and spaces
      const msisdn = to.replace(/\D/g, '').replace(/^880/, '')

      const body = new URLSearchParams({
        api_token: this.apiToken,
        sid:       this.sid,
        msisdn,
        sms:       message,
        csms_id:   `${this.csmsId}-${Date.now()}`,
      })

      const res = await fetch(API_URL, {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal:  AbortSignal.timeout(10000),
      })

      const text = await res.text()
      // SSL Wireless returns XML-like: <api_response><status>SUCCESS</status><sid_no>...</sid_no></api_response>
      const success = text.toLowerCase().includes('success')
      const sidMatch = text.match(/<sid_no>([^<]+)<\/sid_no>/)
      const msgId = sidMatch?.[1]

      if (!success) {
        console.error('[ssl-wireless] send failed:', text)
        return { success: false, error: text.slice(0, 200) }
      }

      return { success: true, messageId: msgId }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
}
