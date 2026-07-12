# Kitchen voice/text add — architecture

**Decision (2026-07-11): 100% on-device. No server LLM. No per-request cost.**

The kitchen "add" intent — *"add chicken, rice and a bag of spinach"* — is a single
intent with two slot types (food nouns + a coarse quantity). That is entity
extraction + a fuzzy catalog match, not open-ended NLU. Combined with the
**confirm-always** rule (nothing is written until you approve the chips), a
deterministic on-device parser is enough. An LLM buys almost nothing and costs
money, latency, network, and privacy.

This is deliberately unlike Goyo's *workout* voice (many intents, weight/reps/unit
math, mid-set corrections, compound commands) which justified a 3-rung ladder ending
in a server Haiku call. Yumo's add intent does not.

## The ladder

```
rung 1  on-device deterministic parser   ← BUILT. handles the real utterance space.
rung 2  on-device LLM (optional, future) ← only if dogfooding shows dish-level speech
        (Apple Foundation Models / Gemini Nano — still free, offline, private)
——————— no server rung. never a paid per-request call. ———————
```

Every rung is free and works offline. Scale is unbounded because there is no
backend in the loop.

## Pipeline

1. **Speech → text (transcription).** On-device, free:
   - iOS: `SFSpeechRecognizer` / the Speech framework, on-device recognition
     (`requiresOnDeviceRecognition = true`). Wrap via `@react-native-voice/voice`
     or `expo-speech-recognition` (needs a dev build — not in Expo Go).
   - Android: `SpeechRecognizer` with `EXTRA_PREFER_OFFLINE = true`.
   - Web (current preview build): the browser `SpeechRecognition` API — already
     wired in `KitchenVoiceSheet.tsx`. Chrome may route this to its own cloud STT,
     but that is the browser's cost, not ours.
   - Fallback everywhere: the always-present `TextInput` (the only path until the
     native STT module is added; also the accessible path).
2. **Parse (rung 1).** `@yumo/shared` `parseAddUtterance(text)` — pure, tested
   (`packages/shared/test/voiceAdd.test.ts`). Left-to-right cardinal grammar,
   connective split, quantity → coarse level. No string-substitution, no hardcoded
   food rewrites (the Goyo `VoiceSetParser` anti-patterns).
3. **Resolve.** `resolveFood(phrase, vocab)` — catalog-anchored fuzzy match (Dice
   bigram + word-subset overlap + Levenshtein ratio) against a **data-derived**
   vocab (`app/src/data/foodVocab.ts` = single-food seeds ∪ starter kitchen ∪ recipe
   tokens ∪ live kitchen). Below the confidence floor it keeps the phrase as spoken
   — never a dead-end (the fridge is fuzzy). Confidence only decides whether to snap
   to a known token so recipes/cookability line up.
4. **Confirm.** `KitchenVoiceSheet` chips (editable level, drop) → `kitchen.restock`
   (items fly in) + `item_added{source:'voice'}`. Nothing is written before this.

## To ship it on the phone

The parse/resolve/confirm layers already work on device (pure TS + RN). The only
device-gated piece is on-device STT capture:

1. `npx expo install expo-speech-recognition` (or add `@react-native-voice/voice`).
2. Add mic + speech-recognition usage strings (iOS `Info.plist`
   `NSMicrophoneUsageDescription` + `NSSpeechRecognitionUsageDescription`; Android
   `RECORD_AUDIO`).
3. In `KitchenVoiceSheet`, behind `Platform.OS !== 'web'`, swap the `SpeechRec`
   web branch for the native recognizer (request permission → start with
   on-device/offline preferred → feed the final transcript into `ingest()`), which
   already drives the same parse→resolve→confirm path. Dev build required
   (`eas build --profile development`); won't run in Expo Go.

Rung 2 (on-device LLM) is a later, optional upgrade for messy dish-level utterances
— and it stays free/offline/private. There is no scenario in this design where a
paid server call is required.
