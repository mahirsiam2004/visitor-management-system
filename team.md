# SecureEntry প্রজেক্ট গাইড — MERN ডেভেলপারের জন্য

এই ডকুমেন্টটি বর্তমান source code ও Supabase migration দেখে লেখা। পুরোনো
`ARCHITECTURE.md`/`PROJECT_COMPLETE.md`-এর কিছু বর্ণনা এখনকার implementation-এর
সাথে মেলে না; তাই কোনো flow বুঝতে এই ফাইলের পাশাপাশি নিচের source-গুলোকে
source of truth ধরো।

## ১. এক কথায় প্রজেক্টটি কী

SecureEntry হলো আবাসিক ভবনের visitor management system। Resident অতিথির pass
তৈরি করে, pass-এ QR ও ৬-সংখ্যার gate code থাকে; Security QR/code যাচাই করে
check-in/check-out করে; Admin user, guard, building, policy, event, report ও
audit তথ্য পরিচালনা করে।

**এটি MERN নয়।** এখানে MongoDB/Mongoose/Express নেই। বর্তমান stack:

| স্তর | প্রজেক্টে যা আছে | MERN-এর সাথে মিল |
| --- | --- | --- |
| UI | React 19 + Next.js 16 App Router | React |
| ভাষা | TypeScript | JavaScript-এর type-safe সংস্করণ |
| Server/API logic | Next.js Server Actions ও Route Handlers | Express controller/route-এর কাছাকাছি |
| Database | Supabase-hosted PostgreSQL | MongoDB-এর ভূমিকা, তবে relational SQL |
| Auth | Supabase Auth | নিজে Express-এ auth/JWT middleware লেখার বিকল্প |
| Data access | Supabase JS/SSR client, PostgREST ও SQL RPC | Mongoose model/query ও backend DB access-এর বিকল্প |
| Form validation | React Hook Form + Zod | Client validation + Express/Joi/Zod validation |
| Styling | Tailwind CSS ও নিজস্ব UI components | React UI layer |

## ২. MERN developer হিসেবে request flow-টা এভাবে ভাবো

```text
Browser/React component
  -> Server Action অথবা Next.js Route Handler
  -> Zod input validation
  -> Supabase server client (cookie-সহ current user)
  -> Supabase API/PostgREST অথবা PostgreSQL RPC
  -> PostgreSQL table + RLS policy/constraint/trigger
  -> ActionResult/JSON ফেরত
  -> UI state update, toast, revalidatePath
```

Express-এ হয়তো `POST /api/passes` route, controller, service, Mongoose model
লিখতে; এখানে `app/actions/guest-passes.ts`-এর `createGuestPass()` সেই
server-side কাজ করে। `"use server"` function-টি client থেকে call করা গেলেও
এটি browser-এ চলে না—Next.js server-এ চলে। আলাদা HTTP endpoint দরকার হলে
`app/api/**/route.ts` Route Handler আছে।

সব data fetch server action দিয়ে হয় না: dashboard-এর Server Component সরাসরি
server Supabase client ব্যবহার করতে পারে, আর কিছু page-এ browser Supabase client
আছে। `app/auth/login/page.tsx`-এর login এর উদাহরণ।

## ৩. কোন জিনিস কোথায়

| Path | কী থাকে |
| --- | --- |
| `app/` | Route, page, layout, Server Action ও API Route |
| `app/actions/` | Authentication, guest pass, check-in, event, admin ইত্যাদির server logic |
| `app/dashboard/resident/` | Resident dashboard, pass, history, event, profile, staff |
| `app/dashboard/security/` | Guard dashboard, QR scanner, entry logs, quick-entry flows |
| `app/dashboard/admin/` | Admin dashboard, users, security, policy, audit, event, penalty ও reports |
| `components/features/` | QR scanner, pass form, notification, offline banner-এর মতো feature UI |
| `components/ui/` | Button, card, input-এর reusable UI building blocks |
| `lib/supabase/` | Browser/server Supabase client, session refresh ও admin client |
| `lib/validations/schemas.ts` | Zod validation schema |
| `lib/utils/guest-pass.ts` | QR token, gate code, expiry ও pass helper |
| `lib/visit-status.ts` | Dhaka timezone, visit status ও overstay calculation |
| `types/index.ts` | Role, pass, log, notification ইত্যাদির TypeScript type |
| `constants/index.ts` | Route, role-route, status label ও policy default |
| `supabase/migrations/` | Database schema, RPC, RLS policy, trigger ও constraint |
| `public/sw.js` | Service worker/offline support |

## ৪. Supabase-এ database connection কীভাবে

### Client দুই রকম

1. `lib/supabase/client.ts`-এর `createClient()` browser-এর জন্য।
   `NEXT_PUBLIC_SUPABASE_URL` ও `NEXT_PUBLIC_SUPABASE_ANON_KEY` ব্যবহার করে।
2. `lib/supabase/server.ts`-এর `createClient()` Server Component/Action/Route
   Handler-এর জন্য। `next/headers` থেকে cookie পড়ে এবং Supabase session cookie
   পড়া/লেখা করে।
3. `lib/supabase/proxy.ts`-এর `updateSession()` request-এ `auth.getUser()` করে
   মেয়াদোত্তীর্ণ session refresh করতে পারে। Root `proxy.ts` প্রায় সব app request-এ
   এটি চালায়। **এটি নিজে role-based route blocking নয়**; dashboard layout ও
   server action-এ auth/role check করা হয়।
4. `lib/supabase/admin.ts` service-role client তৈরি করতে পারে; service key
   RLS bypass করতে সক্ষম। এটি browser bundle-এ কখনো দেওয়া যাবে না। বর্তমানে
   health route-এ admin client ব্যবহৃত হয়েছে।

Connection-এর জন্য `.env.local`-এ `.env.example` অনুসারে নিজের Supabase project
URL/key বসাতে হয়. `NEXT_PUBLIC_` prefix থাকা value browser-এ প্রকাশ পায়, তাই
anon/publishable key-ই সেখানে ব্যবহার করতে হবে; service-role key কেবল server
environment secret।

এখানে Node process থেকে সরাসরি PostgreSQL connection string দিয়ে Mongoose-জাতীয়
connection pool খোলা হয়নি। Supabase JS client Supabase API-র সাথে কথা বলে;
Supabase সেটিকে PostgreSQL query-তে রূপান্তর করে। RPC call হলে PostgreSQL-এর
function চলে।

### Data insert/update-এর উদাহরণ

```ts
const { data, error } = await supabase
  .from('guest_passes')
  .insert(passPayload)
  .select()
  .single()
```

- `.from('guest_passes')` table নির্বাচন।
- `.insert()` insert করে; `.update()` update করে; `.select()` result ফেরত আনে।
- `.eq()`, `.gte()`, `.is()` query filter।
- Supabase client parameterized request তৈরি করে; string জুড়ে SQL বানানো হয় না।
- Supabase response সাধারণত `{ data, error }`; error পরীক্ষা করা জরুরি।
- `supabase.rpc('verify_guest_token', { p_token })` database function invoke করে।

**কোনো Mongoose model/schema নেই।** Database-এর আসল shape SQL migration-এ;
`types/index.ts` হলো TypeScript-এর compile-time type, database validation নয়।

### Migration ও schema

`supabase/migrations/001_initial_schema.sql`-এ প্রাথমিক `profiles`,
`guest_passes`, `entry_logs` schema শুরু হয়। পরের migration-গুলো feature যোগ,
RLS ঠিক ও schema extend করে; `010_unified_schema_fix.sql` বর্তমান unified
schema alignment-এর বড় migration। এতে মোটামুটি ২৩টি table-র definition আছে:

- Core: `buildings`, `apartments`, `profiles`, `guest_passes`,
  `guest_pass_members`, `entry_logs`
- Operations: `visit_requests`, `recurring_visitors`,
  `recurring_visitor_apartments`, `events`, `event_guests`,
  `event_coordinators`, `guard_shifts`, `family_members`, `blacklist`
- Policy/records: `pass_extensions`, `penalties`, `policy_settings`,
  `notifications`, `notification_preferences`, `access_attempts`,
  `guard_rate_limits`, `audit_log`

Migration-গুলো শুধু table তৈরি করে না: column, index, foreign key, check
constraint, timestamp trigger, role helper, expiry/verification/overstay RPC,
RLS policy ও immutability trigger-ও সংজ্ঞায়িত করে। নতুন Supabase project-এ
migration-গুলো সঠিক ক্রমে চালানো দরকার; শুধু `001` চালালে বর্তমান app-এর
প্রয়োজনীয় schema তৈরি হবে না।

`DB_GAP.md`-এ live database নিয়ে আগে করা gap analysis আছে; সেটা ওই audit-এর
সময়কার তথ্য, এখনকার Supabase instance-এর live অবস্থা নিজে যাচাই করে না। Deploy
করার আগে dashboard/SQL editor-এ migration status, columns, policies, RPC এবং
storage বাস্তবে মিলে কি না যাচাই করতে হবে।

## ৫. Login, signup ও session

### Signup

1. `app/auth/sign-up/page.tsx`-এ React Hook Form + Zod দিয়ে form validate হয়।
2. `signUp()` Server Action (`app/actions/auth.ts`) আবার server-এ
   `signUpSchema.parse()` চালায়।
3. Supabase Auth-এ email/password account তৈরি হয়। Metadata-তে নাম, ফোন,
   apartment ও `role: 'resident'` পাঠানো হয়। Public signup-এ role resident-ই।
4. Migration-এ `auth.users`-এর insert trigger `handle_new_user()` profile
   row বানায়। Trigger না থাকলে বা trigger শেষ হওয়ার আগেই profile দরকার হলে
   Action-টিও upsert করে profile তৈরি করার চেষ্টা করে।
5. Email confirmation চালু থাকলে confirm email-এ callback code আসে।
   `app/auth/callback/route.ts` সেই code session-এ exchange করে profile role
   দেখে নিজ নিজ dashboard-এ redirect করে। Confirmation বন্ধ থাকলে signup UI
   browser client দিয়ে সঙ্গে সঙ্গে sign-in করে resident dashboard-এ যায়।

### Login

বর্তমান login screen `app/auth/login/page.tsx`-এ browser Supabase client-এর
`auth.signInWithPassword()` সরাসরি call হয়—`app/actions/auth.ts`-এর `login()`
action থাকলেও login screen সেটি ব্যবহার করছে না। Login-এর পরে `profiles` থেকে
role পড়ে route বেছে নেয়:

```text
resident -> /dashboard/resident
security -> /dashboard/security
admin    -> /dashboard/admin
```

Supabase Auth password যাচাই/session তৈরি করে; app password নিজে database-এ
সংরক্ষণ বা hash করে না। SSR client session cookie-তে রাখে/পড়ে; proxy request-এ
session refresh করতে পারে।

`rememberMe` checkbox-টি form-এ আছে, তবে বর্তমান login handler-এ সেটির উপর
ভিত্তি করে আলাদা session lifetime নির্ধারণ দেখা যায় না।

### Password recovery/profile

- Forgot/reset password Supabase Auth-এর email ও `updateUser()` flow ব্যবহার করে।
- Password পরিবর্তনের আগে বর্তমান password দিয়ে sign-in করে পুনরায় যাচাই হয়।
- Profile update action `full_name`, `phone_number`, `apartment_number`-এর মতো
  অনুমোদিত field map করে `profiles` update করে।

## ৬. Role-based access control (RBAC)

Role type: `types/index.ts`-এ `'resident' | 'security' | 'admin'`।
নতুন signup resident; admin-এর `updateUserRole()` action দিয়ে role বদলানোর
feature আছে।

| Role | সাধারণ কাজ |
| --- | --- |
| Resident | নিজের profile, অতিথির pass তৈরি/দেখা/revoke, event, visit request-এ সাড়া, extension, notification, penalty/history দেখা |
| Security | QR/gate code যাচাই, check-in/out, visitor log, delivery/walk-in/emergency/recurring visitor flow |
| Admin | user/role/guard, policy, audit, event approval, blacklist, penalty, report ও system management |

Access check এক জায়গায় নয়—কয়েকটি স্তর আছে:

1. Dashboard `layout.tsx`-গুলো `auth.getUser()` ও `profiles.role` দেখে ভুল role-কে
   সঠিক dashboard-এ redirect করে।
2. Server Action-গুলো নিজের `requireAuth()`/`requireAdmin()` helper অথবা
   explicit `profile.role` check চালায়। উদাহরণ: `createGuestPass()` resident
   ছাড়া অন্যকে আটকায়; `checkInGuest()` security/admin ছাড়া অন্যকে আটকায়।
3. PostgreSQL RLS (`010_unified_schema_fix.sql`) `auth.uid()`/`get_my_role()`
   দিয়ে কোন row পড়া/লেখা যাবে তা database স্তরে সীমিত করে। যেমন resident-এর
   guest pass select নিজের `resident_id`-এর row-তে; security/admin pass ও
   entry log দেখতে পারে।
4. Foreign key/check constraint row relationship ও data invariant আটকায়।

গুরুত্বপূর্ণ: root `proxy.ts` শুধু session refresh করে; page layout/action-ই
মূল route/action authorization। UI-তে button লুকানো থাকাকে authorization
ধরা যাবে না। RLS-ও migration অনুযায়ী feature ভেদে আলাদা; সব table-এ সমান
restrictive policy আছে ধরে নেওয়া ঠিক নয়।

## ৭. Guest pass ও QR — শুরু থেকে শেষ পর্যন্ত

### Pass বানানো

1. Resident `CreateGuestPassForm`-এ অতিথির নাম, ঐচ্ছিক BD ফোন, তারিখ/সময়,
   duration, purpose, allowed persons, companions ও ঐচ্ছিক photo দেয়।
2. `createGuestPassSchema` server-এ input যাচাই করে।
3. `createGuestPass()` authenticated profile resident কি না দেখে এবং profile-এ
   apartment আছে কি না যাচাই করে।
4. `lib/utils/guest-pass.ts`-এর helper দিয়ে তৈরি হয়:
   - `guest_id`: UI/পরিচিতির জন্য `G-...` identifier
   - `qr_token`: UUID v4 opaque identifier
   - `gate_code`: crypto random থেকে ছয় অঙ্কের code
   - `valid_from`: Dhaka visit time-এর ৩০ মিনিট আগের UTC সময়
   - `expiry_time`: Dhaka visit time + duration, UTC ISO timestamp
5. `guest_passes` row Supabase-এ insert হয়। Companions থাকলে আলাদা
   `guest_pass_members` row insert করার চেষ্টা হয়। Audit log-এ
   `pass.created` event লেখা হয়।
6. React `react-qr-code` দিয়ে QR image render করে। QR-এর payload guest info JSON
   নয়; `NEXT_PUBLIC_APP_URL/verify/{qr_token}` URL। QR image download, print,
   pass link copy/share/WhatsApp করা যায়।

### QR আর pass link এক জিনিস নয়

- QR code payload: `/verify/{qr_token}` — guard scanner এই URL থেকে token
  বের করে যাচাই করে।
- Guest-facing pass page link: `/pass/{qr_token}` — details, QR ও gate code
  দেখানোর জন্য।
- QR token ও gate code একই pass-কে খুঁজে পেতে দুইটি আলাদা credential।
  `guest_id` নিজে QR token নয়।

### Gate-এ scan/verification

1. `components/features/QRScanner.tsx` `html5-qrcode` lazy import করে camera
   scan চালায়; camera কাজ না করলে manual token/code লেখা যায়।
2. QR URL হলে scanner `/verify/`-এর পরের token নেয়; gate code হলে text-টাই নেয়।
3. `verifyGuestToken()` Supabase RPC `verify_guest_token(p_token)` চালায়।
   Migration 010-এর function ছয় অঙ্ক হলে gate code, অন্যথায় UUID token খোঁজে।
4. RPC pass আছে কি না, archived/revoked/used কি না, valid_from-এর আগে কি না,
   expiry হয়েছে কি না, active entry আছে কি না, allowed headcount পূর্ণ কি না
   দেখে status/message দেয়। Verification-এর জন্য guard login আবশ্যক নয়; কিন্তু
   check-in-এর জন্য আবশ্যক।
5. `valid` হলে guard “Allow Entry” চাপলে `checkInGuest()` আবার server-এ
   authenticated security/admin role যাচাই ও Zod validation করে। Pass, time,
   existing inside log পরীক্ষা করে `entry_logs`-এ check-in row লেখে; pass-এর
   `entered_count` বাড়ায়, audit ও resident notification লেখে।
6. Check-out-এ entry log-এ `exit_time`, `status: completed`,
   `checkout_type: manual` update হয়। Admin stuck entry force-close করতে পারে।
7. `verify_guest_token` public page-এও ব্যবহৃত হয়: `app/verify/[token]/page.tsx`।

একটি বাস্তব পার্থক্য: `verify_guest_token` RPC invalid token-কে অনেক ক্ষেত্রে
`success: true` + `status: not_found/expired/...` data হিসেবে ফেরায়; action
transport/database error হলে `success: false` হয়। UI-তে তাই `success` আর
business status—দুটিই বুঝতে হবে।

### Pass status ও visit status

- Pass status: `valid`, `expired`, `revoked`, `used`.
- Entry log status: `inside`, `overstay`, `completed`.
- `lib/visit-status.ts` stored status একা বিশ্বাস না করে সময়, exit ও
  allowed/entered count দিয়ে computed status দেয়।
- Default overstay grace ১৫ মিনিট; policy settings-এ override থাকতে পারে।
- সব date/time input Dhaka (+06:00) হিসাবে ব্যাখ্যা করে UTC timestamp-এ রাখা হয়;
  display ও “আজ” গণনা `Asia/Dhaka` ধরে।

## ৮. Validation কোথায় এবং কী কী

Validation একাধিক স্তরে হওয়া উচিত; এই app-এ মূলত Zod form/server validation
এবং Postgres constraint/RLS আছে।

### Frontend/form

`react-hook-form` + `zodResolver` error-গুলো field-এর কাছে দেখায়। Client
validation UX-জন্য—request-কে বিশ্বাস করার কারণ নয়।

### Server Action

Action-গুলো `unknown` input-এ `schema.parse()` চালায়। Invalid হলে action
error result ফেরায়; authorization check-ও server-side। `createGuestPass()`,
`checkInGuest()`, signup, profile update-এর উদাহরণ আছে।

### গুরুত্বপূর্ণ Zod rules

- Password: ন্যূনতম ৮ অক্ষর, অন্তত uppercase, lowercase, number; confirm password
  মিলতে হবে।
- BD phone: `01XXXXXXXXX`/`+8801XXXXXXXXX` ধাঁচের ১৩ digit normalized format।
- Apartment: `A-101`-জাতীয় letter-hyphen-number format, uppercase normalize।
- Guest name: ২–১০০ অক্ষর; purpose: ৩–২০০ অক্ষর।
- Visit date আজ বা ভবিষ্যৎ; time `HH:MM`; duration ১–২৪ ঘণ্টা।
- Allowed persons: integer ১–১০; companions: সর্বোচ্চ ৯; companion-এ name,
  relation, minor flag।
- Check-in token আবশ্যক; ID type নির্দিষ্ট enum-এ; `identityVerified` অবশ্যই
  `true`; admitted persons ১–১০।
- Check-out entry ID UUID হতে হবে; revoke pass ID UUID হতে হবে।

### Database validation

Migration-এ status check, duration/headcount range, `entered_count <=
allowed_persons`, valid time window, BD phone format, `exit_time >= entry_time`,
foreign key, active gate-code unique index, unique QR token ইত্যাদি আছে।
`updated_at` trigger update timestamp বদলায়। Guest pass/entry evidence delete
বন্ধ করার trigger এবং audit log mutation আটকানোর trigger-ও সংজ্ঞায়িত।

## ৯. অন্য business feature-গুলোর সারাংশ

- **Guest pass:** `app/actions/guest-passes.ts`; create/list/stats/revoke,
  verify/check-in/check-out, logs, overstays, search, public pass data।
- **Delivery ও walk-in:** guard apartment খুঁজে resident-এর কাছে timed
  approval request পাঠায়; resident approve/reject/leave at gate করতে পারে।
  Delivery-এর auto-allow window preference আছে।
- **Emergency:** guard emergency entry flow থেকে request/log করতে পারে।
- **Recurring visitor/staff:** পরিচিত visitor ও apartment association রেখে
  guard দ্রুত lookup/check-in করতে পারে।
- **Events:** resident event ও guest list/coordinator তৈরি করে; expected guest
  count threshold-এর বেশি হলে admin approval দরকার; guest-দের আলাদা QR/code হয়।
- **Pass extension:** resident extension চাইতে পারে; policy limit অনুযায়ী
  প্রথমটি auto-approve এবং পরেরটি admin review-এ যেতে পারে; max total stay
  সীমাও আছে।
- **Overstay/penalty:** `detect_overstays_full()` RPC grace পার হওয়া inside
  visitor-কে overstay করে এবং policy অনুযায়ী penalty তৈরি করতে পারে।
- **Notifications:** in-app notification; user preference থাকলে Web Push ও
  SMS channel। SMS provider `SMS_PROVIDER` দিয়ে mock/SSL Wireless/বাংলাদেশি
  provider বাছতে পারে; quota ও critical-only policy আছে।
- **Blacklist:** visitor তথ্য, কারণ, scope ও active state।
- **Admin:** profile/role management, deactivate/reactivate, analytics,
  CSV export, policy, guard/shift, audit, penalty।
- **Audit:** গুরুত্বপূর্ণ কাজ actor, action, entity ও metadata-সহ `audit_log`-এ
  লেখা হয়।
- **Offline:** service worker app shell ও আজকের কিছু active pass cache করার
  চেষ্টা করে; `/api/offline/passes` শুধু logged-in security/admin-কে দেয়।

## ১০. Cron/API ও automated work

`vercel.json`-এ নির্ধারিত scheduled route:

| Route | Interval | কাজ |
| --- | --- | --- |
| `/api/cron/expire-passes` | প্রতি ৫ মিনিট | expired pass status update |
| `/api/cron/detect-overstays` | প্রতি ৫ মিনিট | overstay/penalty RPC ও notification |
| `/api/cron/expire-visit-requests` | প্রতি ২ মিনিট | unanswered request expire |
| `/api/cron/ending-soon` | প্রতি ৫ মিনিট | অল্প সময় বাকি pass-এর reminder |

এগুলো `CRON_SECRET` দিয়ে protect করার উদ্দেশ্যে লেখা; deploy-এ secret configure
করা এবং actual authorization behavior যাচাই করা জরুরি।
`/api/health`, `/api/upload`, `/api/offline/passes` আলাদা Route Handler।

## ১১. চালানো ও পরীক্ষা

প্রয়োজনীয় version `package.json` অনুসারে Node.js 20+ ও npm 10+। Repo-তে pnpm
lockfile-ও আছে; দলের সবাই একই package manager/lockfile convention মেনে চলুক।

```bash
pnpm install
# .env.example অনুসারে local .env.local তৈরি করে credentials বসাও
pnpm dev
```

- Local app: `http://localhost:3000`
- TypeScript check script: `pnpm lint` (`tsc --noEmit`)
- Production build: `pnpm build`
- Database: Supabase project-এ migration-গুলো 001 থেকে 010 পর্যন্ত ক্রমানুসারে চালাও।
- QR camera scan production-এ HTTPS/permission চাইতে পারে।

## ১২. Source code পড়ার প্রস্তাবিত ক্রম

MERN-এ request flow trace করার মতো করে:

1. `app/dashboard/resident/create-pass/page.tsx`
2. `components/features/CreateGuestPassForm.tsx`
3. `lib/validations/schemas.ts`
4. `app/actions/guest-passes.ts`-এ `createGuestPass()`
5. `lib/utils/guest-pass.ts`
6. `supabase/migrations/010_unified_schema_fix.sql`-এর
   `guest_passes`, constraints, policies ও RPC অংশ
7. তারপর QR trace করতে `app/pass/[token]/page.tsx`,
   `app/verify/[token]/page.tsx`, `components/features/QRScanner.tsx`,
   `verify_guest_token()` ও `checkInGuest()`।

## ১৩. খেয়াল রাখার মতো বর্তমান implementation caveat

এই অংশটি ইচ্ছাকৃত: documentation-এ marketing claim-কে বাস্তব code behavior
বলে ধরে নিও না।

1. `ARCHITECTURE.md`-এর পুরোনো QR JSON payload, route/flow ও “শুধু ৩ table”
   বর্ণনা এখনকার code-এর সাথে পুরো মেলে না। এখন QR-এ verify URL; migration
   010-এ অনেক বেশি table আছে।
2. `app/pass/[token]/page.tsx` public pass page তথ্য পেতে
   `getPassPublicInfo()` দিয়ে anon/server Supabase client থেকে সরাসরি
   `guest_passes` select করে। Migration 010-এর guest-pass SELECT policy-তে
   anon/public role স্পষ্টভাবে অনুমোদিত নয়। তাই deployed RLS একই থাকলে public
   `/pass/{token}` page “not found” দেখাতে পারে; Supabase policy ও page live
   environment-এ যাচাই করা দরকার। `/verify/{token}` আলাদা SECURITY DEFINER
   RPC ব্যবহার করে।
3. Signup profile upsert failure log করে, কিন্তু response সবসময় signup fail
   করে না; profile trigger/migration ঠিকমতো deploy হয়েছে কি না তা গুরুত্বপূর্ণ।
4. `next.config.mjs`-এ `typescript.ignoreBuildErrors: true` আছে। `pnpm build`
   TypeScript error-কে উপেক্ষা করতে পারে; তাই আলাদা `pnpm lint` চালিয়ে type
   error ধরা উচিত।
5. `lib/imgbb.ts`-এ ImgBB API key source-এ hard-coded আছে। Repository-তে
   এমন key থাকলে provider dashboard-এ key revoke/rotate করে server-only
   environment variable-এ নেওয়া উচিত; secret-কে documentation বা client-এ
   কপি কোরো না।
6. `lib/supabase/admin.ts` service-role key না পেলে anon key fallback করে।
   Admin operation আশা করা code path-এ এটি silent privilege difference তৈরি
   করতে পারে; service role কেবল server-side env-এ রাখতে হবে।
7. Service worker comments-এ offline check-in queue-এর কথা আছে; কিন্তু
   বাস্তব scanner Server Action call করে এবং worker কেবল নির্দিষ্ট URL-এ
   matching POST দেখে। Production-এ network বিচ্ছিন্ন করে offline check-in ও
   replay end-to-end পরীক্ষা না করে এই feature-কে নির্ভরযোগ্য ধরে নিও না।
8. `DB_GAP.md`-এর database snapshot পুরোনো হতে পারে। Live schema-র বিষয়ে
   migration files এবং actual Supabase project—দুটো মিলিয়ে সিদ্ধান্ত নাও।

## ১৪. MERN থেকে মনে রাখার সহজ mapping

| MERN ধারণা | এই project |
| --- | --- |
| `server.js` / Express app | Next.js runtime; আলাদা Express server নেই |
| `router.get/post()` | `app/api/**/route.ts` অথবা Server Action |
| Controller | `"use server"` action function |
| Middleware | Next `proxy.ts` session refresh + action/layout auth checks |
| Mongoose model | PostgreSQL schema/migration + `types/index.ts` compile-time types |
| `Model.find()` | `supabase.from('table').select().eq(...)` |
| `Model.create()` | `.insert(...).select()` |
| Mongo aggregation/transaction logic | Postgres SQL/RPC; কিছু aggregation TypeScript action-এ |
| JWT middleware | Supabase Auth session cookie + `auth.getUser()` |
| Controller-level ownership check | Server Action role/owner check **এবং** database RLS |
| Joi/express-validator | Zod schema client form-এ এবং আবার server action-এ |
| Mongo ObjectId | UUID primary key; human-readable guest ID আলাদা |

সবচেয়ে গুরুত্বপূর্ণ mental model: **React UI থেকে server action call হয়, কিন্তু
database permission-এর শেষ সীমানা PostgreSQL RLS ও constraints।** UI-র route,
button, TypeScript type বা client validation—কোনোটিই একা security boundary নয়।
