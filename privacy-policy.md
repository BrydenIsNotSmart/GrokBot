# Privacy Policy

Last updated: January 21, 2026

## Overview

This Privacy Policy describes how the Discord bot **Gork** (the “Bot”) collects, uses, and handles data when used in Discord servers.

The Bot is an independent project and is not affiliated with Discord, xAI, or Grok.

---

## Data the Bot Processes

The Bot only processes data when a user explicitly interacts with it (for example, by mentioning the Bot or replying to a message).

### Message Content
- The Bot temporarily processes message content **only when explicitly invoked by a user**
- Message content is used solely to generate a response
- Message content is **not stored, logged, or persisted**

### Contextual Discord Data
The Bot may temporarily access:
- User ID
- Server ID
- Channel ID
- Referenced message content (if replying to a message)

This data is used only to provide contextual responses and apply rate limits or cooldowns.

---

## Data Storage

The Bot stores **minimal operational data** only:
- User IDs
- Server IDs
- Timestamp of last interaction
- Cooldown or rate-limit metadata

No message content is stored in any database or log.

---

## Third-Party Services

The Bot sends user-provided prompts to the **xAI (Grok) API** to generate responses.

- Message content is sent to xAI **only for inference**
- The Bot does **not** train, fine-tune, or modify any AI models
- The Bot does not control how third-party services process data

Please refer to xAI’s privacy policy for more information on their data handling.

---

## Data Retention

Operational data (user IDs, server IDs, timestamps) is retained only as long as necessary for the Bot to function properly.

Message content is **never retained**.

---

## User Control

Users may opt out of data processing by:
- Not interacting with or mentioning the Bot
- Removing the Bot from a server

The Bot does not process messages passively.

---

## Security

Reasonable measures are taken to protect stored operational data. No system can guarantee absolute security.

---

## Changes to This Policy

This Privacy Policy may be updated from time to time. Changes will be reflected by updating the “Last updated” date.

---

## Contact

If you have questions or concerns about this Privacy Policy, please contact:

**Email:** bryden@strafechat.dev  
**GitHub:** https://github.com/BrydenIsNotSmart
