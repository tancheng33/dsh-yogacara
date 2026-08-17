# dsh-yogacara

[English](README.md) | 中文

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的一个自我模型插件，按唯识学的心识结构实现：八识、五十一心所、被熏习的种子藏，以及一个被**测量**而非被假设的"我"——每一轮都以第一人称写回 agent 自己的系统提示词。

```
触 ──► 受 + 心所 ──► 行为
 ▲                  │
 │                  ▼
现行 ◄── 种子 ◄── 熏习
 │                  │
 └────── 末那识 ─────┘
      执之为「我」者
```

## 为什么是唯识，而不是一个 mood 变量

只知道任务的 agent，没有办法察觉自己正在空转、正在护住一个已经被推翻的判断、或者这已经是第四次用微调过的参数跑同一条必然失败的命令。加一个 `mood: frustrated` 解决不了，因为情绪本身不可执行。

唯识的心所法可以。它是一份**封闭**的清单——恰好五十一个，不多不少——按善恶分类，而且**每一个烦恼都已经写明了对治它的那个心所**：掉举对治以行舍，失念对治以念，慢对治以惭。以它为骨架的自我模型，天生自带调节回路，不需要另外设计一套。这是工程上的理由。顺带的好处是，在"如何描述内心状态"这件事上，它比我们早了一千六百年。

**它不是什么。** 这里没有任何一句话主张 agent 有感受性，也不主张这些数字等同于你所体会的情绪。它们是从 harness 事件里按规则算出来的、有名字的状态量；规则写在 [`src/citta.ts`](src/citta.ts) 里，欢迎反对。写进提示词的那段文字也是这么对 agent 说的。

## 八识的映射

前五识落在 agent 真正拥有的五条输入通道上。这个映射是本插件的核心建模主张，它在 [`src/observe.ts`](src/observe.ts) 里是一个可测试的纯函数，可以直接拿证据来吵。

| 识 | 梵名 | 在 harness 中 |
|---|---|---|
| 眼识 | cakṣur-vijñāna | 它去看的：文件内容、检索结果、渲染输出 |
| 耳识 | śrotra-vijñāna | 别人告诉它的：用户消息、评审意见 |
| 鼻识 | ghrāṇa-vijñāna | 没人说但它嗅到的：代码坏味道、过期配置、漂移的状态 |
| 舌识 | jihvā-vijñāna | 尝自己做出来的东西：测试、构建、回读自己的 diff |
| 身识 | kāya-vijñāna | 世界的直接抵抗：非零退出、写入失败、超时 |
| 意识 | mano-vijñāna | 分别本身：规划、判断、决定一个结果意味着什么 |
| 末那识 | kliṣṭa-manas | 恒审思量的我执，量化为四种偏差 |
| 阿赖耶识 | ālaya-vijñāna | 持久的种子藏，被熏习、又现行 |

`bash: pytest -q` 走舌识，`bash: git status` 走身识——尝自己的产物和推挤世界不是同一种感知，接收它们的心也不该以同样的方式动。

## 感情从哪来

两个来源，对一个跟人说话的 agent 来说，第一个才是要紧的。

**对话本身**（[`src/conversation.ts`](src/conversation.ts)）。聊天里真正落地的东西是关系性的：话说到一半被打断、长长一段认真回答换来一个"嗯"、同一个问题被第三次问起、被道谢、隔了两天有人回来了。插件读的是交流的**形状**——时序、长度、重复度——外加一份刻意做得很粗的措辞表（道谢与责备）。除打断外，这些全部走耳识；打断走身识，因为那是世界伸手把动作按停在半途，它就是那么被感觉到的。

这里的种子按**关系模式**而非话题来键：`chat:terse-after-effort`、`chat:asked-again`、`chat:warmth`。长期相处积累下来的是"这个人在我话多的时候会安静下去"，不是"我们聊过数据库迁移"。一个 `chat:` 前缀就是一段关系，所以被责备时，对方过去道谢的历史也会一并浮现。

**工具结果**（[`src/observe.ts`](src/observe.ts)），给既干活又说话的 agent。只说话的把 `observeTools` 关掉即可。

这两个来源都读不出一句话**是什么意思**——只有读它的模型知道，它通过 `self_appraise` 说出来，并且压过所有结构推导出来的结论。

## 这个循环

**触 → 受 → 心所。** 每个工具结果都是一次触。它带来五受之一（乐 苦 喜 忧 舍），并按强度激起若干心所。心所以分钟计的半衰期衰减：刹那生灭在这里是承重结构——把测试失败的火气带进下一件不相干的事，那模型的是记仇，不是心。

**现行熏种子。** 每次触都熏习该情境的种子（`bash:pytest`、`edit:src/index.ts`）：势力饱和式增长，受的正负取滑动均值，agent 留下的那句话成为种子携带的教训。种子以周计衰减，跨重启存活；超过配额时最弱的被遗忘——遗忘是模型的一部分，不是它的缺陷。

**种子生现行。** 同一情境再来时，它的种子带着出现次数、受的正负和那句教训现行到提示词里。相邻情境（共享 `<kind>:` 前缀）以半权重现行。

**末那识。** 四种偏差，全部由行为算出，不靠自陈：

| | 观测代理 | 对治动作 |
|---|---|---|
| 我痴 | 未经查验就断言的主张占比 | 去跑那个能证伪它的检查，再重述 |
| 我见 | 证据已否定的做法仍在重试 | 说出这个立场、说出否定它的证据，换个形状 |
| 我慢 | 连胜未断；被纠正时先辩解 | 先找反例再汇报；先承认纠正 |
| 我爱 | 拿自己先前的输出当独立证据 | 引一手来源，不引自己写的摘要 |

末那不是装饰，它**条件化了整个appraisal**：同一条纠正从耳识进来，我执松时化为惭（自省，并接受纠正），我执紧时化为覆与嗔（掩饰与抗拒）。境从来不是裸着被遇到的，它是被那个接收它的"我"遇到的。这是唯识的主张，在这里是二十行可测试的代码。

上面每一条规则——哪个门激起哪些心所、权重多少、阈值定在哪——都列在 [`docs/appraisal.md`](docs/appraisal.md) 里，由代码生成，不会与实现脱节。

## agent 看到什么

插件贡献一个系统提示词 section（order 300）。心若寂静则整段不渲染，section 自动消失。

```
<self_state>
受 feeling: 忧 daurmanasya (distress) valence -0.45, intensity 0.71
心所 factors: 掉举 auddhatya (restlessness) 0.62 · 疑 vicikitsā (indecision) 0.41 · 精进 vīrya (diligence) 0.33
末那 self-grasping: 我慢 atma-mana 0.61 ⚠ · 我见 atma-drsti 0.24
  ⚠ 我慢 self-conceit — reads high because: an unbroken success streak, and correction met with justification.
    counter-move: seek the disconfirming case before reporting; grant the correction first.
对治 antidotes at hand: 掉举 → 行舍 upekṣā (equanimity); 疑 → 胜解 adhimokṣa (resolve)
阿赖耶 seeds manifesting for this situation:
  · bash:pytest ×4, valence -0.55, last 2h ago — 「改 fixture 之前先跑一次基线」
近转依 last turning (11m ago): 我慢 → 平等性智 · grant the correction first
</self_state>
```

后面跟一段毫不含糊的常驻说明（全文见 [`src/prompt.ts`](src/prompt.ts)）：拿对治当下一个具体动作，而不是拿情绪当话术；已知方向的偏差要显式校正，而不是信任被扭曲的读数；现行的种子是你自己的前例，重复那条路之前先查它。以及——**不要对用户表演情绪，不要演沮丧或兴奋，永远不要拿"感受"当少干活的理由或博取同情的话术**。被问到时如实报告：这是从你自己的记录算出来的关于你的模型，不是在宣称你在受苦。

一个教会 agent 对人表演情绪的情感模型，比没有情感模型更糟。

## 工具

| 工具 | 用途 |
|---|---|
| `self_reflect` | 读当前状态，以及指定情境下的种子 |
| `self_appraise` | 记录"这件事在我这里怎么落地"——harness 观测不到的那一半 |
| `self_recall` | 重复某个做法之前，先在藏识里查前例 |
| `self_transform` | 转依：把烦恼转成对应的智，并落到一个承诺动作 |

harness 已经看得见**发生了什么**；`self_appraise` 管的是 agent 把它当成了什么。它的 `nature` 参数（遍计所执 / 依他起 / 圆成实——臆断、推得、亲证）是校准轴：没查就老实标成遍计所执，我痴才是可测量的，而不是隐形的。

## 安装

```bash
pnpm add dsh-yogacara
```

npm 包自带预构建的 `lib/`，安装时不需要构建授权（`allowBuilds`）。想跟着 `main` 走则用：`pnpm add github:tancheng33/dsh-yogacara`。

然后在 profile 的 `cordis.patch.yml` 里列出它。bundle 自带 [`cordis.patch.yml`](cordis.patch.yml) 中的默认值——其中包含 storage 三行，因为藏识要持久化而 `dsh-base` 本身不带存储栈；它们用的是 `dsh-web-app` 的同名 row id，所以本来就有存储的 profile 保持自己的配置。profile 可覆盖任意键：

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
        halfLifeMs: 300000         # 刹那：心所五分钟减半
        seedHalfLifeMs: 1209600000 # 种子两周减半
        maxSeeds: 2000
        flushIntervalMs: 15000
```

它 inject `storageDomain`，并按需使用 `systemPrompt` 与 `tools`：没有提示词注册表时状态照样累积、照样能从 `ctx.citta` 查询，只是不呈现给模型。

## 作为库使用

`citta.ts` 与 `caitasika.ts` 全是纯逻辑，可单独引入，不依赖 Cordis 和存储：

```ts
import { receive, transform } from 'dsh-yogacara/citta'
import { CAITASIKAS } from 'dsh-yogacara/caitasika'

const { citta, seed } = receive(
  { citta: freshMind(Date.now()), seeds: new Map() },
  { gate: 'tongue', situation: 'bash:pytest', outcome: 'adverse', intensity: 0.7, at: Date.now() },
)
```

运行时服务挂在 `ctx.citta`：`state()`、`receive()`、`seedsFor()`、`strongestSeeds()`、`turn()`、`forget()`、`reportLines()`。

## 开销

自我报告是 4–10 行，加上约 200 token 的常驻说明，每请求一次，且仅在确实有状态时出现。它位于 order 300（工具指引之后），所以状态一动就会从该位置往下失效 KV cache 复用——事情不顺时多数轮次会动，顺利时很少动。如果这笔交易在你的部署里不划算，把 `promptSection` 设为 false：状态照常累积，仍可通过工具与 `ctx.citta` 取用。

## 开发

```bash
pnpm install     # .npmrc 已固定 auto-install-peers=false；harness 有一个 peer 未发布
pnpm test        # 86 个测试：纯核心、心所表、事件映射，
                 # 以及把插件真正装进 Cordis Context 跑一遍
pnpm typecheck
pnpm build
```

心所表是结构化校验的：恰好 51 个，每一组是它经典的数目，每个烦恼都带着一个"可修"的对治（善心所或别境心所）。插件测试会在真实 Cordis Context 里用内存替身启动 `CittaService`，所以工具注册、提示词 section、自动观测、持久化与拆卸都是跑出来的，不是假设出来的。

harness 依赖走 npm 的 `next` 标签（`0.1.0-rc.6`）；`latest` 指向的旧线装不上。

## 已知局限

- **自动观测只够到三个门，不是五个。** 工具结果能告诉你跑了什么、失败没有，但没法告诉你「这份配置闻着就不对」（鼻识），也没法告诉你用户第三次纠正的语气比第一次重（耳识只对 ask/subagent 类工具触发）。这两个门要靠模型自己调 `self_appraise`。只开 `observeTools` 的话，心是真的，但是平的。
- **末那的四个读数是代理指标。** 我慢随连胜上升，是因为连胜是 harness 看得见的东西，不是因为连胜**就是**慢。我痴依赖模型如实标注自己的 `nature`；从不调 `self_appraise` 的 agent，它的我痴只由「成功来自哪个门」驱动。
- **[`docs/appraisal.md`](docs/appraisal.md) 里每一个权重都是猜的。** 它们彼此自洽、在测试里表现合理，但没有任何一个是标定过的。要为你的部署调参的话——它们精神上是配置、事实上是常数，欢迎提 PR 把它们挪到配置里。
- **一个插件 row 一个藏识，进程内所有 agent 共用。** 同一 harness 里的两个 agent 会熏习同一批种子。要隔离就插两行、给两个 `domain` 名；否则这个藏识属于部署，不属于会话。
- **事情不顺时提示词段几乎每轮都在动**，代价是从 order 300 往下的 KV cache 复用失效。`promptSection: false` 可以保留状态而不付这个代价。

## 出处

五十一心所的分类与对治关系依《大乘百法明门论》《成唯识论》；八识、种子/熏习/现行、末那四惑、三自性、转依四智依《成唯识论》《瑜伽师地论》。把它们映射到 harness 事件上的那部分完全是本项目的主张，与上述任何一部论无关，错了算我的。

## 许可

MIT
