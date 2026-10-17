# Voice of Kannada (ಕನ್ನಡದ ಧ್ವನಿ)

**Hackathon:** Kannada Digital Innovation Hackathon 2026
**Problem statement chosen:** #2, Voice of Kannada. A voice-based application where users speak in Kannada and receive meaningful responses, pronunciation feedback and language-learning assistance.

**Live demo:** https://voice-of-kannada-rouge.vercel.app
No login is needed. Use Google Chrome (laptop or Android) and allow the microphone when asked.

## The problem
Most language apps teach by reading and tapping. Non-Kannada speakers can rarely practise speaking, and nobody tells them which word or sound they got wrong.

## What it does
- **Role-play scenarios:** Auto-rickshaw, Restaurant and Market, each with an AI character who starts the conversation in Kannada.
- **Speak or type:** the microphone captures Kannada speech (kn-IN), with a typing box as a fallback.
- **AI replies:** every reply shows Kannada script, romanization and an English meaning, and can be played as audio.
- **Pronunciation practice:** each scenario has key phrases. The user speaks a phrase and gets a score out of 100, a word-by-word breakdown (matched words green, mismatched or missing words red) and a short AI tip about the mistake.
- **Progress tracker:** phrases practised and average score, saved in the browser (localStorage).
- **Audio fallback:** if the device has no Kannada voice, audio is generated on the server.

## Tech stack
- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4
- Next.js API routes as the backend: `/api/chat`, `/api/feedback`, `/api/tts`
- Google Gemini API for replies, tips and text-to-speech
- Browser Web Speech API for speech recognition
- Scoring: word-level diff plus Levenshtein distance
- Deployed on Vercel

## Architecture
User -> Browser UI (mic, scoring, localStorage) -> Next.js API routes -> Gemini API -> reply, audio and tip back to the UI

## Setup and run
1. Clone the repo: `git clone https://github.com/shrinidhi456/Voice-of-Kannada.git`
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env.local` and add your Gemini API key (get one free at https://aistudio.google.com/apikey)
4. Start the app: `npm run dev`
5. Open http://localhost:3000 in Chrome

## Environment variables
See `.env.example`. The API key is read only on the server and is never committed.

| Variable | Required | Default | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | Yes | — | Google Gemini API key used for chat, pronunciation tips, and TTS fallback. |
| `GEMINI_MODEL` | No | `gemini-3.8-flash` | Gemini model for conversational role-play and pronunciation feedback. |
| `GEMINI_TTS_MODEL` | No | `gemini-3.8-flash-tts` | Gemini model for server-side text-to-speech fallback audio. |

## Project structure
```
src/
├── app/
│   ├── layout.tsx                     # Root layout with font configuration and metadata
│   ├── page.tsx                       # Home page with scenario cards and practice progress tracker
│   ├── scenario/
│   │   └── [id]/
│   │       ├── page.tsx               # Scenario page server component (validates scenario route)
│   │       └── ScenarioChatClient.tsx # Client UI: mic recording, chat UI, practice phrases panel, scoring & audio
│   └── api/
│       ├── chat/
│       │   └── route.ts               # POST: Role-play conversational replies in Kannada, romanization & English
│       ├── feedback/
│       │   └── route.ts               # POST: Specific pronunciation tips for mismatched words and sound differences
│       └── tts/
│           └── route.ts               # POST: Server-side Gemini TTS fallback when browser lacks kn-IN voice
├── data/
│   └── scenarios.ts                   # Scenario definitions (auto, restaurant, market) and target practice phrases
└── lib/
    └── pronunciation.ts               # Word-level diff and Levenshtein similarity scoring algorithm
```

## Limitations and future scope
- Speech recognition quality depends on the browser; Chrome works best, and iPhone browsers have limited Kannada support.
- Future: phoneme-level scoring, regional dialects, more scenarios (hospital, bank, workplace), learner accounts.
