# I Built SignalLens Because Professional Feeds Are Becoming Harder to Read

There is an increasingly familiar experience on LinkedIn and X: a post looks promising, but after a few lines it turns out to be generic AI enthusiasm, recycled advice, or a claim with no evidence behind it.

I built **SignalLens** to make that experience less exhausting. It is a local-first Chrome extension for LinkedIn and X on the web that evaluates visible posts as you scroll, lets you teach it your definition of useful, and quietly removes the posts you repeatedly decide are not worth your time.

It is not an “AI-content detector.” That framing is too crude. Plenty of AI-written posts are useful; plenty of human-written posts are empty. The question SignalLens tries to answer is more personal: **does this post have enough signal for me?**

![Figure 1 — SignalLens dashboard: independent LinkedIn and X controls, live assessment counts, and transparent rules.](../assets/screenshots/dashboard.png)

*Figure 1. The dashboard makes the filter visible and reversible rather than a black box.*

## The problem it resolves

The issue is not simply volume. It is the cost of context switching. Every low-value post asks for a small amount of attention before revealing that it has little depth: no primary source, no method, no benchmark, no example, no concrete lesson.

SignalLens creates a lightweight reading layer over the feed. It looks for practical signals such as technical detail, metrics, source links, code, papers, benchmarks, firsthand experience, and relevant topics. It discounts unsupported superlatives, engagement bait, generic urgency, and recycled promotional language.

When the filter decides a post is low-signal, it does not make it disappear without explanation. It replaces the card with a clear notice and a preview of the actual post copy. You can reveal it, hide it again, or correct the decision.

That reversibility matters. A useful filter should reduce noise without pretending it is infallible.

## A personal model, not a universal taste model

“Slop” is not an objective category. A broad introductory post may help one reader and frustrate another. So SignalLens has three feedback choices:

- **👍 Useful** — worth keeping in the feed.
- **😐 Mixed** — relevant sometimes, but not consistently valuable.
- **👎 Low signal** — not useful for this reader.

Those labels feed a compact local preference learner. Instead of retaining post text as training data, it stores a small numerical representation of signals such as evidence, technical depth, links, metrics, hype, length, and vocabulary diversity. The model retrains locally as feedback arrives.

![Figure 2 — SignalLens Learning: local model progress, label balance, and agreement with previous feedback.](../assets/screenshots/learning.png)

*Figure 2. The Learning tab shows what the local model has seen and how reliably its earlier guess matched a later label.*

I also added **author learning**. If I mark a post from a particular author as Useful, future posts from that author receive a local keep-visible prior. It is not a permanent whitelist: repeated Low Signal feedback can reduce or reverse that preference. The goal is to let the feed gradually reflect who I actually learn from without forcing me to maintain a large manual list.

## Conservative by design

An aggressive filter creates its own failure mode: hiding the post that would have been useful. SignalLens therefore protects video posts and trusted technical sources from automatic hiding. It also uses a clearer preview for filtered LinkedIn posts, extracting the post body rather than the surrounding feed metadata, follower counts, promotion markers, calls to action, or reaction totals.

The system can use a locally running model such as Gemma through Ollama as a second opinion. But the basic rules and personal learner still work even when no AI provider is available.

![Figure 3 — SignalLens Settings: local Ollama, LM Studio/Jan-compatible servers, OpenAI, and Anthropic configuration.](../assets/screenshots/settings.png)

*Figure 3. AI assistance is configurable. Local providers are supported alongside optional hosted APIs.*

## Keeping the things worth returning to

A feed filter should not only remove noise; it should help preserve the good material. SignalLens includes a local bookmark library with folders, source-aware grouping for LinkedIn and X, collapsing/expanding trees, and CSV or JSON export.

![Figure 4 — SignalLens Bookmarks: local folders, LinkedIn/X grouping, and CSV/JSON export.](../assets/screenshots/bookmarks.png)

*Figure 4. Saved posts remain local by default and can be exported when needed.*

That makes the extension useful beyond filtering. It becomes a small personal reading inbox for technical ideas, papers, videos, tools, and posts that deserve more than a quick scroll.

## Why local-first matters

The first version is deliberately local-first:

- Feed scanning happens in the browser.
- Labels, preference vectors, author preferences, and bookmarks live in Chrome storage.
- A local Ollama connection keeps model inference on the machine.
- Hosted models are optional and require explicit configuration.

That keeps the earliest version simple, inspectable, and private. It also leaves a clear path for a paid version later: account sync, cross-application bookmarks, richer hosted inference, and shared preferences—without making those prerequisites for using the core filter.

![Figure 5 — SignalLens Features: the product’s local-first, personal, and reversible design principles.](../assets/screenshots/features.png)

*Figure 5. SignalLens is designed around intent, personal feedback, saving useful material, and reversible decisions.*

## What I learned building it

The hard part was not assigning a label to a post. The hard part was deciding what the label should mean, how it should learn from correction, and how to keep the user in control when it gets something wrong.

SignalLens works best when it behaves less like a judge and more like a reading assistant: it makes an initial, conservative decision; shows enough context to audit it; and improves through ordinary feedback.

That is the future I want from feed software—not more engagement optimization, but better attention management.

SignalLens is now open source: <https://github.com/seshakiran/signallens>
