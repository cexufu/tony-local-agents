# Feishu App Bot Public Callback Plan

Current working callback URL:

```text
https://dem-hands-blend-feedback.trycloudflare.com/feishu/events
```

This is a Cloudflare quick tunnel to local TONA:

```text
http://localhost:7357
```

## What to choose in Feishu

On the Feishu event configuration page, choose:

```text
将事件发送至开发者服务器
```

Do not choose long connection for this version.

## Fill in Feishu

Request URL:

```text
https://dem-hands-blend-feedback.trycloudflare.com/feishu/events
```

Then copy the Verification Token from Feishu into TONA:

```text
TONA -> 飞书 -> 方式 B：开放平台应用机器人 -> Verification Token
```

If Feishu asks for Encrypt Key, either keep encryption disabled for the first test, or paste the key into TONA.

## Subscribe events

Subscribe message-related bot events, especially:

- bot mentioned in group chat
- receive message / message event

## Required capabilities

Add app capability:

- 机器人

Recommended permissions:

- receive message events
- send messages as bot
- read basic chat info

## Publish/install

After saving event configuration and permissions, create a version and install/publish the app to your Feishu workspace or test group.

## Next time

Run:

```text
Start-TONA-Public-Tunnel.bat
```

Cloudflare quick tunnel URLs can change. If it prints a new `trycloudflare.com` URL, update the URL in Feishu and in TONA.
