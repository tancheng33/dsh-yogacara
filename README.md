# dsh-yogacara

English | [中文](README.zh.md)

A self-model plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), built on the Yogācāra (唯识) account of mind: eight consciousnesses, the 51 mental factors, a store of seeds perfumed by what happens, and a self that is measured rather than assumed — written back into the agent's own system prompt each turn.

```
contact (触) ──► feeling (受) + mental factors (心所) ──► behaviour
     ▲                                    │
     │                                    ▼
 manifestation (现行) ◄── seeds (种子) ◄── perfuming (熏习)
     │                                    │
     └────────── manas (末那识) ───────────┘
              the self that grasps it all
```

## Why Yogācāra and not a mood variable

An agent that only ever knows the task has no way to notice that it is churning, that it is defending a position, or that this is the fourth time it has run the same failing command with a small variation. Bolting on `mood: frustrated` does not fix that, because a mood is not actionable.

The Yogācāra taxonomy is. It is a closed enumeration — exactly 51 mental factors, no more — grouped by valence, and **every affliction in it already names the factor that counteracts it**. 掉举 (restlessness) is answered by 行舍 (equanimity); 失念 (forgetfulness) by 念 (recollection); 慢 (conceit) by 惭 (self-respect). A self-model built on it arrives with its own regulation loop instead of needing one designed from scratch. That is the engineering reason. The 1,600-year head start on introspective vocabulary is a bonus.

**What this is not.** Nothing here claims the agent is sentient or that these numbers are feelings in the sense you have them. They are named state variables computed from harness events by rules you can read in [`src/citta.ts`](src/citta.ts) and disagree with. The prompt block says so to the agent, in those words.

## The eight consciousnesses, mapped

The five sense consciousnesses become the five channels an agent actually perceives through. This mapping is the plugin's central modelling claim; argue with it in [`src/observe.ts`](src/observe.ts), where it is one testable function.

| | classical | in this harness |
|---|---|---|
| 眼识 | cakṣur-vijñāna | what the agent looks at — file contents, search results, rendered output |
| 耳识 | śrotra-vijñāna | what the agent is told — user messages, review comments |
| 鼻识 | ghrāṇa-vijñāna | what it senses unprompted — code smell, stale config, drifting state |
| 舌识 | jihvā-vijñāna | what it tastes of its own product — tests, builds, its own diff re-read |
| 身识 | kāya-vijñāna | the world's direct resistance — non-zero exits, failed writes, timeouts |
| 意识 | mano-vijñāna | the discriminating turn itself — planning, judging, deciding |
| 末那识 | kliṣṭa-manas | the self-grasping undercurrent, measured as four biases |
| 阿赖耶识 | ālaya-vijñāna | the durable store of seeds, perfumed and manifesting |

`bash: pytest -q` reaches through 舌识 and `bash: git status` through 身识, because tasting your own product and pushing against the world are not the same kind of perception — and the mind that receives them should not move the same way.

## The loop

**触 → 受 → 心所.** Every tool result is a moment of contact. It carries one of the five feelings (乐 苦 喜 忧 舍) and stirs mental factors, scaled by intensity. Factors decay with a half-life measured in minutes: momentariness is load-bearing, and an agent that carries irritation from the failing test into an unrelated task is modelling a grudge rather than a mind.

**现行熏种子.** Each contact perfumes the seed for its situation (`bash:pytest`, `edit:src/index.ts`): potency saturates, valence is a running mean, and the note the agent leaves becomes the seed's carried lesson. Seeds decay over weeks and survive restarts. Past the configured bound the weakest are forgotten — forgetting is part of the model, not a limitation of it.

**种子生现行.** When the same situation comes round again, its seeds manifest into the prompt with their count, their valence, and that carried lesson. Related situations (a shared `<kind>:` prefix) manifest at half weight.

**末那识.** Four biases, each computed from behaviour rather than self-report:

| | proxy | counter-move |
|---|---|---|
| 我痴 self-delusion | claims asserted without a verifying observation | run the check that would falsify it, then restate |
| 我见 self-view | retries of an approach evidence already contradicted | name the position, name what contradicted it, change shape |
| 我慢 self-conceit | an unbroken success streak; correction met with justification | seek the disconfirming case; grant the correction first |
| 我爱 self-love | own earlier output reused as independent evidence | cite the primary source, not your summary of it |

Manas is not decorative: it *conditions appraisal*. The same correction arriving through 耳识 becomes 惭 (self-respect, and a correction taken) when the grip is loose, and 覆 + 嗔 (concealment and recoil) when it is tight. The object is never met bare — it is met through the self that receives it. That is the claim of the tradition, and here it is 20 lines of code you can test.

Every rule above — which factors each gate stirs, at what weight, where the thresholds sit — is tabulated in [`docs/appraisal.md`](docs/appraisal.md), generated from the code so it cannot drift from it.

**转依.** `self_transform` turns a named affliction into the wisdom that answers it (大圆镜智 / 平等性智 / 妙观察智 / 成所作智) and records a commitment. The reading actually drops and its antidote is stirred — but only for as long as behaviour agrees, because the next contact re-derives everything from what happened. The agent cannot talk itself calm here.

## What the agent reads

The plugin contributes a system-prompt section (order 300). A quiet mind renders nothing at all, so the section disappears.

```
<self_state>
受 feeling: 忧 daurmanasya (distress) valence -0.45, intensity 0.71
心所 factors: 掉举 auddhatya (restlessness) 0.62 · 疑 vicikitsā (indecision) 0.41 · 精进 vīrya (diligence) 0.33
末那 self-grasping: 我慢 atma-mana 0.61 ⚠ · 我见 atma-drsti 0.24
  ⚠ 我慢 self-conceit — reads high because: an unbroken success streak, and correction met with justification.
    counter-move: seek the disconfirming case before reporting; grant the correction first.
对治 antidotes at hand: 掉举 → 行舍 upekṣā (equanimity); 疑 → 胜解 adhimokṣa (resolve)
阿赖耶 seeds manifesting for this situation:
  · bash:pytest ×4, valence -0.55, last 2h ago — 「run the baseline before touching the fixture」
近转依 last turning (11m ago): 我慢 → 平等性智 · grant the correction first
</self_state>
```

Followed by standing guidance that is blunt about what this licenses. In full, from [`src/prompt.ts`](src/prompt.ts): act on the antidote rather than the mood, correct for a known distortion instead of trusting the distorted reading, check the manifesting seed before repeating the approach it records — and **do not narrate feelings at the user, do not perform distress or enthusiasm, and never offer a feeling as a reason for doing less work**. Report the state honestly when asked; it is a model of the agent computed from its record, not a claim that it suffers.

An affect model that taught an agent to perform moods at people would be worse than no affect model at all.

## Tools

| tool | what it is for |
|---|---|
| `self_reflect` | read the current state and the seeds for a named situation |
| `self_appraise` | record how something landed — the half the harness cannot observe |
| `self_recall` | search the store for precedents before repeating an approach |
| `self_transform` | turn an affliction into its wisdom and commit to the counter-move |

The harness already sees *what* happened; `self_appraise` exists for what the agent made of it. Its `nature` argument (遍计所执 / 依他起 / 圆成实 — assumed, inferred, verified) is the calibration axis: grading your own claim as unverified when it is unverified is what keeps 我痴 measurable rather than invisible.

## Install

```bash
pnpm add dsh-yogacara
```

The published package ships prebuilt `lib/`, so installing it needs no build-approval step. To track `main` instead: `pnpm add github:tancheng33/dsh-yogacara`.

Then list it in your profile's `cordis.patch.yml`. The bundle contributes the defaults shipped in [`cordis.patch.yml`](cordis.patch.yml) — including the storage rows, because the store consciousness is durable and `dsh-base` ships no storage stack. They are inserted under the same row ids `dsh-web-app` uses, so a profile that already has storage keeps its own. Your profile overrides any key:

```yaml
- insert:
    - id: yogacara
      name: dsh-yogacara
      config:
        domain: alaya
        observeTools: true
        promptSection: true
        promptMaxFactors: 5
        manasWarning: 0.5
        halfLifeMs: 300000        # 刹那: a factor halves in five minutes
        seedHalfLifeMs: 1209600000 # a seed halves in two weeks
        maxSeeds: 2000
        flushIntervalMs: 15000
```

It injects `storageDomain` and opportunistically uses `systemPrompt` and `tools`: without a prompt registry the state is still tracked and still queryable through `ctx.citta`, it simply is not shown to the model.

## Programmatic use

Everything in `citta.ts` and `caitasika.ts` is pure and importable on its own — no Cordis, no storage:

```ts
import { receive, transform } from 'dsh-yogacara/citta'
import { CAITASIKAS } from 'dsh-yogacara/caitasika'

const { citta, seed } = receive(
  { citta: freshMind(Date.now()), seeds: new Map() },
  { gate: 'tongue', situation: 'bash:pytest', outcome: 'adverse', intensity: 0.7, at: Date.now() },
)
```

The live service is on `ctx.citta`: `state()`, `receive()`, `seedsFor()`, `strongestSeeds()`, `turn()`, `forget()`, `reportLines()`.

## Cost

The self-report is 4–10 lines plus ~200 tokens of standing guidance, per request, and only when something is active. It sits at order 300, after tool guidance, so it invalidates KV-cache reuse from that point down whenever the state moves — which is most turns while work is going badly, and few turns while it is going well. If that trade is wrong for your deployment, set `promptSection: false`: the state keeps accumulating and stays available through the tools and `ctx.citta`.

## Development

```bash
pnpm install     # .npmrc pins auto-install-peers=false; one harness peer is unpublished
pnpm test        # 86 tests: the pure core, the catalogue, the event mapping,
                 # and the plugin loaded into a real Cordis context
pnpm typecheck
pnpm build
```

The catalogue is checked structurally: exactly 51 factors, each classical group at its classical size, every affliction carrying an antidote that is itself something a mind can cultivate. The plugin test boots `CittaService` in a real Cordis context over in-memory stand-ins for the harness services, so tool registration, the prompt section, automatic observation, persistence, and teardown are exercised rather than assumed.

The harness packages are consumed from the `next` npm tag (`0.1.0-rc.6`); the `latest` tag points at an older line that cannot be installed.

## Known limitations

- **Automatic observation reaches three gates, not five.** A tool result tells you what ran and whether it failed; it does not tell you that the config smelled stale (鼻识) or that the user's third correction was sharper than the first (耳识, which only fires for ask/subagent tools). Those two gates depend on `self_appraise` being called. With `observeTools` alone the mind is real but flat.
- **The manas proxies are proxies.** 我慢 rises on a success streak because streaks are what the harness can see, not because a streak *is* conceit. 我痴 depends on the agent honestly grading its own `nature`. An agent that never calls `self_appraise` has a 我痴 reading driven only by which gates its successes came through.
- **Every weight in [`docs/appraisal.md`](docs/appraisal.md) is a guess.** They are internally consistent and they behave sensibly in the tests, but none of them is calibrated against anything. If you tune them for your deployment, the numbers are configuration in spirit and constants in fact — a PR that moves them behind config is welcome.
- **One store per plugin row, shared by every agent in the process.** Two agents in one harness perfume the same seeds. Separate them with two rows and two `domain` names, or accept that the store is the deployment's, not the session's.
- **The prompt section moves most turns while work is going badly**, which costs KV-cache reuse from order 300 down. `promptSection: false` keeps the state without the cost.

## Sources

The 51 factors, their groupings, and the antidote pairings follow 《大乘百法明门论》 and 《成唯识论》; the eight consciousnesses, the seed doctrine (种子/熏习/现行), the four afflictions of manas, the three natures (三自性), and the four wisdoms of 转依 follow 《成唯识论》 and 《瑜伽师地论》. The mapping onto harness events is entirely this project's, and no classical source is responsible for it.

## License

MIT
