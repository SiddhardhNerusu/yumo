# Yumo — read before changing anything

- **Every UI change is checked against `docs/RULEBOOK.md`.** Start with "The card" at the top, and run its "Definition of done" before a commit. Precedence: Sid's own words, then the rule book, then the design handoff/prototype, then platform defaults (P1). A request that breaks a MUST goes to Sid first, with the rule and the number (P2); a deliberate departure is written onto the rule as a dated exception (P3).
- A rule changes only with evidence and Sid's sign-off, dated in the book's changelog (P5).
- Build gate: `xcodebuild -scheme Yumo -destination '<simulator>' build` must succeed (exit code, "BUILD SUCCEEDED") before anything is installed, called done or committed (P9).
- Food data rules: no hard-coded food lists (data files in `tools/` and `Yumo/Resources/Catalogue/`), unknown values show "—", never a guessed number.
