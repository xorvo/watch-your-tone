# Privacy Policy — Toner

_Last updated: 2026-06-17_

Toner is built so that privacy is a feature, not an afterthought.

## What we send

- **Only the text you explicitly ask us to improve.** When you trigger an action
  (via the inline panel, the popup scratchpad, or the right-click menu), the
  selected or active text — plus your saved style profile and chosen persona — is
  sent to the AI provider **you configured** (your Anthropic API key, or your AWS
  Bedrock account).
- We do **not** read or transmit page content in the background.
- We do **not** monitor your typing or your conversations.

## What we store

- Your settings — provider choice, API key / AWS credentials, default persona,
  and style profile — are stored locally on your device using
  `chrome.storage.local`. They are **never synced** to any account and **never
  sent anywhere except** to authenticate your requests to your chosen provider.
- We do **not** store the messages you refine. They live in memory only for the
  duration of a request.
- We have no servers and collect no analytics or telemetry.

## Who receives your data

- Your text is sent directly from your browser to the AI provider you chose:
  - **bagw (local agent gateway)**: to the local [bagw](https://github.com/xorvo/bagw)
    service on `127.0.0.1`, which runs your own installed agent (e.g. the `claude`
    CLI) — which then calls whatever backend it's configured to use (e.g. your AWS
    Bedrock account). The text stays between your machine and your configured
    backend; bagw stores no message content. bagw only serves extensions you have
    explicitly approved.
  - **Anthropic** (`api.anthropic.com`) when using an Anthropic API key,
  - **OpenAI** (`api.openai.com`, or a base URL you configure) when using an
    OpenAI API key, or
  - **AWS Bedrock** (`bedrock-runtime.<region>.amazonaws.com`) when using static
    AWS keys.
- Those providers handle your data under their own terms and policies. Watch Your
  Tone is not an intermediary server — there is no third party in between.

## Your controls

- Disable the inline button globally or per-site in Settings.
- Clear your style profile and credentials at any time in Settings.
- Uninstalling the extension removes all locally stored data.

## What we never do

- We never send messages on your behalf.
- We never make changes to your text without your explicit "Replace" action.
- We never provide legal, HR, medical, or compliance advice — only tone and
  wording suggestions you are free to accept or reject.

Questions? Open an issue on the project repository.
