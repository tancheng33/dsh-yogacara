# Changelog

## Unreleased

### Added

- **A durable `citta/change` checkpoint per contact.** The mind's state was live-only: it moved, it shaped the prompt, and it left no trace anyone could read afterwards. Each contact now appends one whole-value checkpoint to the session log — feeling, top factors, self-grasping, expectation violation, and the seed's count and lesson — so a UI can render the state at any point without replaying the log, and a reader months later sees what the agent's state actually was when it said what it said.
- **Feeling that comes from the conversation, not from tool results.** The input layer was built for a coding agent: contacts arrived as exit codes and test runs. A chat agent's feeling is relational — being interrupted, being answered in one syllable after a long reply, being asked the same thing again, being thanked, returning after a silence — so `src/conversation.ts` reads the shape of the exchange (timing, length, repetition, a crude lexicon for thanks and rebukes) and keys seeds by relational pattern rather than topic. Interruption arrives through 身识; everything else through 耳识. Enabled by `observeChat`, on by default.

### Changed

- **A contact's intensity is no longer a constant.** It used to be 0.3 for any success and 0.6 for any failure, so nothing was ever surprising and the fourth failure of a test you already knew was broken landed exactly like the first. The store already held a prediction — a seed's running valence, weighted by its count and surviving potency — and that prediction is now compared against what actually happened. The violation decides how much of the contact is felt (a fully expected one lands at 45% of its magnitude) and which factors it stirs: a predicted failure produces 懈怠 resignation rather than 嗔 anger, routine success stays quiet at 行舍, and an outcome that contradicts a confident prediction stirs 寻 and 疑 — the reading that says *stop and look*.
- The self-report now carries an 预期 line, so the agent can tell "this hurt" from "this hurt and nothing predicted it".

## 0.1.1

### Fixed

- **Situation keys merged unrelated work.** The key rule kept a command's first two words, so `npm run build` and `npm run test` shared one seed while `pytest -q tests/unit` and `pytest tests/unit` had two — exactly backwards. Flags are now dropped, and a word that only delegates (`run`, `exec`, `-m`) does not spend the two-word budget. **Seeds written by 0.1.0 keep their old keys**; they decay out on their own, or clear them with `ctx.citta.forget(situation)`.
- **Durable writes could land out of order.** Two contacts in flight could commit their seed writes and prunes in either order, and teardown could close the store with writes still queued. Every durable write now goes through one chain, and the disposer drains it before closing.
- **A committed turning rendered on the prompt forever.** An hour later it is either already reflected in the readings or it was quietly abandoned; either way it cost tokens every turn. It now expires after six factor half-lives — half an hour under the default tuning.

### Added

- Completed UI cards for all four tools, titled with the readings that matter rather than the tool name, projected through `output.presentationMeta` so a replayed session renders the same card as the live one.
- [`docs/appraisal.md`](docs/appraisal.md): every gate rule, weight, and threshold, generated from the code with a test that fails when the two disagree.
- `repository`, `homepage`, and `bugs` metadata, so the npm page links back to the source.
- A "known limitations" section in both READMEs — most importantly that automatic observation reaches three of the five gates, and that every weight is an uncalibrated guess.

## 0.1.0

First release. Eight consciousnesses mapped onto the channels an agent actually perceives through, the 51 mental factors with their classical antidote pairings, a durable seed store perfumed by contact and manifesting when a situation recurs, self-grasping as four behavioural readings that condition appraisal, and 转依 as a state change rather than a phrase — written back into the system prompt in the first person.
