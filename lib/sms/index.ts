/**
 * SMS abstraction layer.
 * Provider is selected by SMS_PROVIDER env var: 'ssl_wireless' | 'bulk_sms_bd' | 'mock'
 * All providers implement SmsProvider interface.
 * Cost guard: max SMS per resident per day enforced at send() call site.
 */

export interface SmsProvider {
  send(to: string, message: string): Promise<{ success: boolean; error?: string; messageId?: string }>
}

export interface SmsSendResult {
  success: boolean
  error?: string
  messageId?: string
  skipped?: boolean   // true when cost guard blocked the send
  skipReason?: string
}

// ─── Lazy-load provider by env var ────────────────────────────────────────
let _provider: SmsProvider | null = null

async function getProvider(): Promise<SmsProvider> {
  if (_provider) return _provider
  const name = (process.env.SMS_PROVIDER ?? 'mock').toLowerCase()

  if (name === 'ssl_wireless') {
    const { SslWirelessProvider } = await import('./providers/ssl-wireless')
    _provider = new SslWirelessProvider()
  } else if (name === 'bulk_sms_bd') {
    const { BulkSmsBdProvider } = await import('./providers/bulk-sms-bd')
    _provider = new BulkSmsBdProvider()
  } else {
    const { MockSmsProvider } = await import('./providers/mock')
    _provider = new MockSmsProvider()
  }
  return _provider
}

// ─── Cost guard ────────────────────────────────────────────────────────────
/**
 * Check + increment daily SMS counter for a user.
 * Returns { allowed, remaining } based on max_sms_per_resident_per_day from policy.
 */
export async function checkSmsQuota(
  supabase: any,
  userId: string
): Promise<{ allowed: boolean; remaining: number }> {
  const todayStr = new Date().toISOString().slice(0, 10)

  // Get current prefs + max from policy
  const [{ data: prefs }, { data: policy }] = await Promise.all([
    supabase.from('notification_preferences').select('sms_sent_today, sms_last_reset_date').eq('user_id', userId).single(),
    supabase.from('policy_settings').select('max_sms_per_resident_per_day').single(),
  ])

  const maxPerDay: number = policy?.max_sms_per_resident_per_day ?? 5

  // Reset counter if new day
  let sentToday: number = prefs?.sms_sent_today ?? 0
  if (prefs?.sms_last_reset_date !== todayStr) {
    await supabase.from('notification_preferences').upsert({
      user_id:            userId,
      sms_sent_today:     0,
      sms_last_reset_date: todayStr,
    })
    sentToday = 0
  }

  const allowed = sentToday < maxPerDay
  return { allowed, remaining: Math.max(0, maxPerDay - sentToday) }
}

/**
 * Top-level send function used by notify().
 * Applies cost guard and increments counter on success.
 */
export async function sendSms(
  supabase: any,
  userId: string,
  toPhone: string,
  message: string
): Promise<SmsSendResult> {
  try {
    const { allowed, remaining } = await checkSmsQuota(supabase, userId)
    if (!allowed) {
      return { success: false, skipped: true, skipReason: 'Daily SMS quota reached' }
    }

    const provider = await getProvider()
    const result   = await provider.send(toPhone, message)

    if (result.success) {
      // Increment counter
      await supabase.from('notification_preferences').upsert({
        user_id:        userId,
        sms_sent_today: (remaining <= 0 ? 0 : (5 - remaining)) + 1,  // safe increment
      })
    }

    return result
  } catch (err: any) {
    console.error('[sms] send error:', err.message)
    return { success: false, error: err.message }
  }
}
