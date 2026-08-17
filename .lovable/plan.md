# Fix "Edge function returned an error" on OTP login

## What is actually happening

OTPs are still going out today (7 records in the last hour, most recent 11:49 UTC), so the SMS pipeline is not dead. What customers see is the generic message the app shows whenever the OTP function replies with any non-success status.

Two confirmed contributors:

1. **Rate limits fire silently.** The send-OTP function rejects a request with 429 when the same number asks again within 30 seconds, or more than 5 times in an hour. One number today (+9187xxxx218) hit exactly 5 sends between 11:12 and 11:44 UTC — the next attempt would have been blocked. The function returns a clear reason ("Please wait 12s…", "Too many OTP requests…"), but the app never shows it.
2. **The real reason is thrown away by the client.** In the login screen the code reads `data.error` for the message, but on a non-2xx response the Supabase client returns `data = null` and only a generic `error.message` ("Edge Function returned a non-2xx status code"). So every failure — rate limit, SMS provider rejection, misconfiguration — looks identical to the user and to us.

A third possibility (Fast2SMS rejecting sends, e.g. low wallet balance or DLT template issue) cannot be confirmed or ruled out right now, because the provider's error body is only written to logs that currently show no entries. The plan makes that visible.

## Changes

### 1. Surface the real error message in the app
In the login flow (and the delete-account OTP screen, which calls the same function), read the JSON body from the failed response instead of only `data`. The user then sees "Please wait 18s before requesting another OTP" or "Too many OTP requests. Please try again in an hour." instead of an edge-function stack message.

### 2. Make the resend cooldown honest in the UI
The Resend button already counts down 30s, but the countdown resets only on a successful send, so a user who reloads or retries fast still trips the server limit. Keep the button disabled based on the server's own cooldown response, and show the remaining seconds returned by the function.

### 3. Raise the hourly cap slightly and give it a friendlier reason
5 sends per hour per number is tight for real users who mistype the number or switch between login and delete-account. Raise it to 8 per hour, keep the 30-second cooldown, and keep counting only successful sends (failed provider attempts should not eat the quota).

### 4. Add diagnostic logging around the provider call
Log the Fast2SMS HTTP status and response body on every failure with a clear `[fast2sms-send-otp]` prefix, plus a one-line log on success. That way, if the provider is rejecting sends (balance, template, sender ID), it shows up in the function logs immediately rather than being invisible.

### 5. Pin the function's JWT setting
`supabase/config.toml` has no entry for `fast2sms-send-otp` / `fast2sms-verify-otp`. Add explicit `verify_jwt = false` for both so a platform default change can never start rejecting anonymous login calls.

## Technical notes

- Files: `src/pages/Login.tsx`, `src/pages/DeleteAccount.tsx`, `supabase/functions/fast2sms-send-otp/index.ts`, `supabase/config.toml`.
- Error parsing pattern: on `FunctionsHttpError`, `await error.context.json()` to get `{ error: "..." }`; fall back to the generic message if parsing fails. This can be a small shared helper alongside the existing `src/lib/invoke-error.ts`.
- Only successful Fast2SMS sends insert into `otp_verifications`, so moving the quota check to count those rows keeps behaviour consistent.
- The test-number bypass (8830306901 / OTP 12345) stays untouched.

## After the change

If customers still report failures, the toast will name the cause and the function logs will show the provider's exact response, so the next step (top up Fast2SMS, fix DLT template, etc.) becomes a one-look diagnosis.
