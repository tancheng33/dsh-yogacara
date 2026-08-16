# Changelog

## 0.1.1

### Fixed

- **Situation keys merged unrelated work.** The key rule kept a command's first two words, so `npm run build` and `npm run test` shared one seed while `pytest -q tests/unit` and `pytest tests/unit` had two — exactly backwards. Flags are now dropped, and a word that only delegates (`run`, `exec`, `-m`) does not spend the two-word budget. **Seeds written by 0.1.0 keep their old keys**; they decay out on their own, or clear them with `ctx.citta.forget(situation)`.
- **Durable writes could land out of order.** Two contacts in flight could commit their seed writes and prunes in either order, and teardown could close the store with writes still queued. Every durable write now goes through one chain, and the disposer drains it before closing.

### Added

- Completed UI cards for all four tools, titled with the readings that matter rather than the tool name, projected through `output.presentationMeta` so a replayed session renders the same card as the live one.
- [`docs/appraisal.md`](docs/appraisal.md): every gate rule, weight, and threshold, generated from the code with a test that fails when the two disagree.
- `repository`, `homepage`, and `bugs` metadata, so the npm page links back to the source.
- A "known limitations" section in both READMEs — most importantly that automatic observation reaches three of the five gates, and that every weight is an uncalibrated guess.

## 0.1.0

First release. Eight consciousnesses mapped onto the channels an agent actually perceives through, the 51 mental factors with their classical antidote pairings, a durable seed store perfumed by contact and manifesting when a situation recurs, self-grasping as four behavioural readings that condition appraisal, and 转依 as a state change rather than a phrase — written back into the system prompt in the first person.
