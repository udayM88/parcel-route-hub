# Production Clerk email sign-in

## Goal
Make Clerk email sign-in and sign-up immediately open the existing ViaSetu consumer experience without mobile OTP, while keeping the current login page design and all existing phone, business, and admin login flows unchanged.

## Changes
- Replace the phone-dependent Clerk session bridge with a Clerk identity bridge that creates a stable ViaSetu customer ID from the Clerk account.
- Create or update the existing ViaSetu profile with the Clerk user's name and email; phone remains optional for Clerk users.
- Store the authentication source and email in the local consumer session so existing booking, history, tracking, settings, and support screens continue using one session format.
- Keep the existing Clerk sign-in/sign-up controls and current login page presentation unchanged.
- Synchronize Clerk sign-out with ViaSetu logout so both sessions are cleared together.
- Preserve phone OTP login, business login, admin login, and CMS/operations login without modification.

## Production configuration
- Replace the current development `pk_test_...` publishable key with the Clerk production `pk_live_...` publishable key after it is supplied.
- No Clerk secret key will be placed in browser code or requested in chat.

## Verification
- Verify email sign-up and sign-in reach the app without mobile verification.
- Verify a profile is created with name/email and no required phone.
- Verify refresh keeps the user signed in and logout clears both Clerk and ViaSetu sessions.
- Verify the existing phone OTP flow and login page appearance remain unchanged.
- Check the production build and relevant runtime logs.
