# Feishu Callback Runbook

## Canonical callback design

- Every AI Studio workspace has one generated callback URL:
  `https://<host>/feishu/events/<workspaceId>`.
- All bots belonging to that workspace use the same callback URL.
- The event payload identifies the specific bot by its configured application identity.
- The shared legacy path `/feishu/events` is retired. Do not configure it for new or migrated bots.
- Do not manually construct a workspace identifier. Copy the generated URL after saving the bot in AI Studio.

## Credential handling rule

App Secret, Verification Token, and Encrypt Key are returned to the browser in masked form. A value such as `abc...xyz` or `********` is a display placeholder, never a credential.

**Invariant:** a masked value must never overwrite a stored secret.

The server enforces this in `isMaskedSecretValue` and `incomingSecretValue`. The regression test `tests/lark-secret-preservation.js` creates a bot, re-saves its masked values, and verifies that the original credentials survive.

## Incident history

### 2026-07-17: encrypted event decryption

Symptoms: Feishu showed that the challenge was not returned and event logs contained `bad decrypt`.

Root cause: the AES-CBC decryptor did not follow the Feishu payload layout. The official Node SDK derives the AES key from Encrypt Key and uses the first 16 bytes of the base64-decoded encrypted payload as the IV.

Fix: commit `6178119 Fix Feishu encrypted event decryption`. The implementation in `decryptFeishuPayload` follows that layout.

### 2026-07-21: masked credential overwrite

Symptoms: the callback route responded to an unencrypted challenge, but encrypted URL verification still failed after users refreshed keys.

Root cause: the UI sent masked credential text back on a normal save. The server treated the mask as a replacement Encrypt Key / Verification Token / App Secret. The resulting stored credential could not decrypt Feishu events.

Fix: commit `0638c2f Preserve masked Feishu credentials on save`. A user repairing an affected bot must re-enter the real App Secret, Verification Token, and Encrypt Key once after deploying that fix.

## Recovery checklist

1. Deploy the current production commit.
2. In Feishu, copy the real App Secret, Verification Token, and Encrypt Key from the same application.
3. In AI Studio, open the corresponding role bot and paste all three real values.
4. Save the role bot and copy its generated workspace callback URL.
5. Put that exact URL in Feishu Event Subscriptions and save it.
6. Never paste a masked value back into a credential field.

## Diagnostics

- A plain URL verification request should return HTTP 200 with the same `challenge` value.
- A `bad decrypt` record means the stored Encrypt Key does not match the application's currently enabled Encrypt Key.
- A verification-token mismatch means the stored Verification Token is stale or belongs to a different application.
- Do not place credential values in source code, logs, issue reports, or screenshots.
