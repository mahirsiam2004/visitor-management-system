/** Mock provider for dev/test — logs to console, never sends real SMS */
import type { SmsProvider } from '../index'

export class MockSmsProvider implements SmsProvider {
  async send(to: string, message: string) {
    console.log(`[sms/mock] TO: ${to} | MSG: ${message}`)
    return { success: true, messageId: `mock-${Date.now()}` }
  }
}
