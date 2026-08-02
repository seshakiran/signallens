(() => {
  const POST_SELECTORS = [
    "div.feed-shared-update-v2",
    "div[data-id^='urn:li:activity:']",
    "[data-urn^='urn:li:activity:']",
    "[data-activity-urn^='urn:li:activity:']",
    "[data-view-name='feed-full-update']",
    "article[data-testid='tweet']"
  ];
  // dataset keys must be camelCase; Chrome exposes this as data-signal-filter-processed.
  const PROCESSED = "signalFilterProcessed";
  const HIDDEN = "signal-filter-hidden";
  const countedAssessments = new Set();
  let enabled = true;
  let sensitivity = 0;

  function hashText(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function recordAssessment(post, fingerprint) {
    const permalink = post.querySelector("a[href*='/feed/update/'], a[href*='/status/']")?.href;
    const activity = post.getAttribute("data-urn") || post.getAttribute("data-activity-urn");
    const key = permalink || activity || `${location.hostname}:${hashText(fingerprint)}`;
    if (countedAssessments.has(key)) return;
    countedAssessments.add(key);
    chrome.runtime.sendMessage({ type: "record-assessment", key }, () => updateStatus());
  }

  function updateStatus() {
    const pill = document.querySelector("#signal-filter-status");
    if (!pill) return;
    chrome.storage.local.get({ scannedCount: 0, filteredCount: 0 }, ({ scannedCount, filteredCount }) => {
      pill.textContent = `SignalLens active · ${scannedCount} assessed · ${filteredCount} filtered`;
    });
    renderDashboard();
  }

  function renderDashboard() {
    const panel = document.querySelector("#signal-filter-panel");
    if (!panel) return;
    chrome.storage.local.get({ scannedCount: 0, filteredCount: 0, usefulVotes: 0, mixedVotes: 0, slopVotes: 0 }, (data) => {
      panel.querySelector("[data-dashboard='assessed']").textContent = data.scannedCount;
      panel.querySelector("[data-dashboard='filtered']").textContent = data.filteredCount;
      panel.querySelector("[data-dashboard='labels']").textContent = `${data.usefulVotes} useful · ${data.mixedVotes} mixed · ${data.slopVotes} low signal`;
    });
  }

  function applyDashboardTheme(preference) {
    const panel = document.querySelector("#signal-filter-panel");
    if (!panel) return;
    const dark = preference === "dark" || (preference === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    panel.classList.toggle("is-dark", dark);
  }

  function addDashboard() {
    if (document.querySelector("#signal-filter-panel")) return;
    const panel = document.createElement("aside");
    panel.id = "signal-filter-panel";
    panel.innerHTML = `<header><span class="signal-filter-panel-grip">⋮⋮</span><strong>SignalLens</strong><span class="signal-filter-panel-local">Local</span><button type="button" aria-label="Minimize panel">−</button></header><section><p class="signal-filter-panel-kicker">Your LinkedIn signal dashboard</p><div class="signal-filter-panel-metrics"><div><b data-dashboard="assessed">0</b><span>assessed</span></div><div><b data-dashboard="filtered">0</b><span>filtered</span></div></div><p class="signal-filter-panel-labels" data-dashboard="labels">0 useful · 0 mixed · 0 low signal</p><p class="signal-filter-panel-help">Drag the header to move. Drag the lower-right corner to resize.</p></section>`;
    const launcher = document.createElement("button");
    launcher.id = "signal-filter-launcher";
    launcher.type = "button";
    launcher.textContent = "S";
    launcher.title = "Open SignalLens";
    launcher.addEventListener("click", () => { panel.classList.remove("is-minimized"); launcher.hidden = true; });
    panel.querySelector("header button").addEventListener("click", () => { panel.classList.add("is-minimized"); launcher.hidden = false; });
    document.body.append(panel, launcher);
    chrome.storage.local.get({ dashboardBounds: { top: 92, right: 20, width: 350, height: 260 } }, ({ dashboardBounds }) => {
      Object.assign(panel.style, { top: `${dashboardBounds.top}px`, right: `${dashboardBounds.right}px`, width: `${dashboardBounds.width}px`, height: `${dashboardBounds.height}px` });
    });
    chrome.storage.local.get({ themePreference: "system" }, ({ themePreference }) => applyDashboardTheme(themePreference));
    let drag;
    panel.querySelector("header").addEventListener("pointerdown", (event) => {
      if (event.target.closest("button")) return;
      const rect = panel.getBoundingClientRect();
      drag = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
      panel.setPointerCapture(event.pointerId);
    });
    panel.querySelector("header").addEventListener("pointermove", (event) => {
      if (!drag) return;
      panel.style.left = `${Math.max(0, drag.left + event.clientX - drag.x)}px`;
      panel.style.top = `${Math.max(0, drag.top + event.clientY - drag.y)}px`;
      panel.style.right = "auto";
    });
    panel.querySelector("header").addEventListener("pointerup", () => {
      drag = undefined;
      const rect = panel.getBoundingClientRect();
      chrome.storage.local.set({ dashboardBounds: { top: Math.round(rect.top), right: Math.max(0, Math.round(window.innerWidth - rect.right)), width: Math.round(rect.width), height: Math.round(rect.height) } });
    });
    new ResizeObserver(() => {
      const rect = panel.getBoundingClientRect();
      chrome.storage.local.set({ dashboardBounds: { top: Math.round(rect.top), right: Math.max(0, Math.round(window.innerWidth - rect.right)), width: Math.round(rect.width), height: Math.round(rect.height) } });
    }).observe(panel);
    renderDashboard();
  }

  function addStatus() {
    if (document.querySelector("#signal-filter-status")) return;
    const pill = document.createElement("div");
    pill.id = "signal-filter-status";
    pill.textContent = "SignalLens active · scanning feed…";
    document.body.append(pill);
    updateStatus();
  }
  const signalTerms = ["benchmark", "evaluation", "latency", "inference", "training", "fine-tuning", "retrieval", "RAG", "agent", "token", "context window", "model card", "paper", "dataset", "github", "arxiv", "API", "accuracy", "precision", "recall", "cost"];
  const evidenceTerms = ["http://", "https://", "arxiv.org", "github.com", "doi.org", "documentation", "source:", "paper:", "benchmark:"];
  const hypeTerms = ["game changer", "revolutionary", "mind blowing", "the future is here", "will replace", "10x", "everyone needs", "don't get left behind", "this changes everything", "unlock", "secret", "just launched"];

  // A compact local model: [bias, technical depth, evidence, metrics, hype, length].
  const CLASSES = ["useful", "mixed", "slop"];
  const DEFAULT_PREFERENCE_MODEL = { weights: { useful: [0, 0, 0, 0, 0, 0], mixed: [0, 0, 0, 0, 0, 0], slop: [0, 0, 0, 0, 0, 0] }, examples: 0 };
  const DEFAULT_PREFERENCE_STATS = { predictions: 0, correct: 0 };

  function featureVector(text) {
    const normalized = text.toLowerCase();
    const count = (terms) => terms.reduce((n, term) => n + (normalized.includes(term.toLowerCase()) ? 1 : 0), 0);
    return [1, Math.min(count(signalTerms) / 5, 1), Math.min(count(evidenceTerms) / 2, 1), /\b\d+(?:\.\d+)?\s?(?:%|ms|seconds|tokens|x)\b/i.test(text) ? 1 : 0, Math.min(count(hypeTerms) / 3, 1), Math.min(text.length / 3000, 1)];
  }

  function normalizeModel(model) {
    return model?.weights && !Array.isArray(model.weights) ? model : DEFAULT_PREFERENCE_MODEL;
  }

  function preferenceProbabilities(features, rawModel) {
    const model = normalizeModel(rawModel);
    const logits = Object.fromEntries(CLASSES.map((name) => [name, model.weights[name].reduce((total, weight, index) => total + weight * features[index], 0)]));
    const maximum = Math.max(...Object.values(logits));
    const totals = Object.fromEntries(CLASSES.map((name) => [name, Math.exp(logits[name] - maximum)]));
    const denominator = Object.values(totals).reduce((sum, value) => sum + value, 0);
    return Object.fromEntries(CLASSES.map((name) => [name, totals[name] / denominator]));
  }

  function trainPreference(features, vote) {
    chrome.storage.local.get({ preferenceModel: DEFAULT_PREFERENCE_MODEL, preferenceStats: DEFAULT_PREFERENCE_STATS }, ({ preferenceModel, preferenceStats }) => {
      const stored = normalizeModel(preferenceModel);
      const model = { weights: Object.fromEntries(CLASSES.map((name) => [name, [...stored.weights[name]]])), examples: stored.examples };
      const probabilities = preferenceProbabilities(features, model);
      const predictedVote = CLASSES.reduce((best, name) => probabilities[name] > probabilities[best] ? name : best, CLASSES[0]);
      const stats = {
        predictions: preferenceStats.predictions + 1,
        correct: preferenceStats.correct + (predictedVote === vote ? 1 : 0)
      };
      const rate = 0.18;
      CLASSES.forEach((name) => {
        const target = name === vote ? 1 : 0;
        model.weights[name] = model.weights[name].map((weight, index) => weight + rate * (target - probabilities[name]) * features[index]);
      });
      model.examples += 1;
      chrome.storage.local.set({ preferenceModel: model, preferenceStats: stats });
    });
  }

  function score(text) {
    const normalized = text.toLowerCase();
    const count = (terms) => terms.reduce((n, term) => n + (normalized.includes(term.toLowerCase()) ? 1 : 0), 0);
    const signal = count(signalTerms);
    const evidence = count(evidenceTerms);
    const hype = count(hypeTerms);
    const hasMetric = /\b\d+(?:\.\d+)?\s?(?:%|ms|seconds|tokens|x)\b/i.test(text);
    return signal * 2 + evidence * 3 + (hasMetric ? 2 : 0) - hype * 3;
  }

  function label(post, value, message = "Filtered as low-signal content") {
    const notice = document.createElement("div");
    notice.className = "signal-filter-notice";
    notice.innerHTML = `<span>${message}</span><button type="button">Show post</button>`;
    notice.querySelector("button").addEventListener("click", () => {
      const isHidden = post.classList.contains(HIDDEN);
      post.classList.toggle(HIDDEN, !isHidden);
      notice.querySelector("button").textContent = isHidden ? "Hide again" : "Show post";
    });
    post.before(notice);
    post.classList.add(HIDDEN);
    post.dataset.signalFilterScore = String(value);
    chrome.storage.local.get({ filteredCount: 0 }, ({ filteredCount }) => {
      chrome.storage.local.set({ filteredCount: filteredCount + 1 });
      updateStatus();
    });
  }

  function recordFeedback(kind, features) {
    chrome.storage.local.get({ usefulVotes: 0, slopVotes: 0 }, (counts) => {
      chrome.storage.local.set({
        usefulVotes: counts.usefulVotes + (kind === "useful" ? 1 : 0),
        slopVotes: counts.slopVotes + (kind === "slop" ? 1 : 0),
        mixedVotes: (counts.mixedVotes || 0) + (kind === "mixed" ? 1 : 0)
      });
    });
    trainPreference(features, kind);
  }

  function saveBookmark(post, folder, controls) {
    const preview = (post.innerText || "").replace(/\s+/g, " ").trim().slice(0, 220);
    const isXPost = post.matches("article[data-testid='tweet']");
    const permalink = isXPost
      ? post.querySelector("a[href*='/status/']")?.href || location.href
      : post.querySelector("a[href*='/feed/update/']")?.href || location.href;
    const platform = isXPost ? "X" : "LinkedIn";
    chrome.storage.local.get({ bookmarks: [], bookmarkFolders: ["Inbox"] }, ({ bookmarks, bookmarkFolders }) => {
      const exists = bookmarks.some((item) => item.permalink === permalink && item.preview === preview);
      const nextBookmarks = exists ? bookmarks : [...bookmarks, { id: `${Date.now()}-${preview.slice(0, 24)}`, folder, platform, permalink, preview, savedAt: Date.now() }];
      const nextFolders = bookmarkFolders.includes(folder) ? bookmarkFolders : [...bookmarkFolders, folder];
      chrome.storage.local.set({ bookmarks: nextBookmarks, bookmarkFolders: nextFolders });
      controls.innerHTML = `<span class="signal-filter-bookmarked">✓ Saved to ${folder}</span>`;
    });
  }

  function addBookmarkControl(post, badge) {
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.textContent = "Save";
    trigger.addEventListener("click", () => {
      chrome.storage.local.get({ bookmarkFolders: ["Inbox"] }, ({ bookmarkFolders }) => {
        const controls = document.createElement("span");
        controls.className = "signal-filter-bookmark-controls";
        const select = document.createElement("select");
        bookmarkFolders.forEach((folder) => select.add(new Option(folder, folder)));
        const save = document.createElement("button");
        save.type = "button";
        save.textContent = "Save here";
        save.addEventListener("click", () => saveBookmark(post, select.value, controls));
        controls.append(select, save);
        trigger.replaceWith(controls);
      });
    });
    badge.append(trigger);
  }

  function updateSensitivity({ usefulVotes = 0, slopVotes = 0 }) {
    // More “Slop” votes makes the local prototype more willing to hide borderline posts.
    sensitivity = Math.max(-2, Math.min(2, Math.round((slopVotes - usefulVotes) / 5)));
  }

  function addIndicator(post, value, features) {
    const badge = document.createElement("div");
    const result = value <= -3 ? "Likely low signal" : "Read locally";
    badge.className = "signal-filter-badge";
    const xPost = post.matches("article[data-testid='tweet']");
    if (xPost) badge.classList.add("signal-filter-badge-x");
    badge.innerHTML = `<span>${result}</span><button type="button" data-vote="useful" title="Useful">👍</button><button type="button" data-vote="mixed" title="Mixed">😐</button><button type="button" data-vote="slop" title="Low signal">👎</button>`;
    badge.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        const vote = button.dataset.vote;
        recordFeedback(vote, features);
        badge.querySelector("span").textContent = vote === "useful" ? "Marked useful" : vote === "mixed" ? "Marked mixed" : "Marked low signal";
        // Keep Save available after a Useful vote. Feedback and bookmarking are
        // independent actions: a valuable post may still be worth saving.
        badge.querySelectorAll("button[data-vote]").forEach((item) => item.remove());
        if (vote === "slop") label(post, value);
        if (vote === "mixed") label(post, value, "Hidden as mixed relevance");
      });
    });
    // X posts use a horizontal outer article. Attach inside the post's text
    // area so the extension never becomes a new layout column.
    const host = xPost ? post.querySelector("[data-testid='tweetText']")?.parentElement : post;
    (host || post).prepend(badge);
    addBookmarkControl(post, badge);
    return badge;
  }

  function askGemma(text, post, badge, value) {
    badge.querySelector("span").textContent = "Reading with Gemma 4…";
    chrome.runtime.sendMessage({ type: "classify-post", text }, (result) => {
      if (chrome.runtime.lastError || result?.error) {
        badge.querySelector("span").textContent = "Read locally (rule-based)";
        return;
      }
      const labels = { useful: "Gemma: useful", slop: "Gemma: likely low signal", uncertain: "Gemma: uncertain" };
      badge.querySelector("span").textContent = `${labels[result.label]} — ${result.reason}`;
      if (result.label === "slop" && !post.classList.contains(HIDDEN)) label(post, value);
    });
  }

  function inspect(post) {
    if (!enabled) return;
    // X virtualizes its timeline and may reuse an existing article for a
    // different tweet. Reprocess only when its underlying content changes.
    const cleanPost = post.cloneNode(true);
    cleanPost.querySelectorAll(".signal-filter-badge, .signal-filter-notice, .signal-filter-bookmark-controls").forEach((element) => element.remove());
    const text = (cleanPost.innerText || cleanPost.textContent || "").trim();
    const isXPost = post.matches("article[data-testid='tweet']");
    // Engagement counts change continuously on X. Identify a tweet by its stable
    // permalink and post text so those updates do not recreate its controls.
    const xPermalink = isXPost
      ? cleanPost.querySelector("a[href*='/status/']")?.href || ""
      : "";
    const xText = isXPost
      ? cleanPost.querySelector("[data-testid='tweetText']")?.textContent || ""
      : "";
    const fingerprint = isXPost
      ? `${xPermalink}|${xText}`
      : text.slice(0, 700);
    const controlsPresent = Boolean(post.querySelector(".signal-filter-badge"));
    // X routinely redraws the inside of a tweet while retaining the outer
    // article and its data attributes. When that removes our badge, treat the
    // card as needing a fresh attachment even if the tweet itself is unchanged.
    if (post.dataset[PROCESSED] && post.dataset.signalFilterFingerprint === fingerprint && (controlsPresent || post.classList.contains(HIDDEN))) return;
    if (post.dataset[PROCESSED]) {
      post.querySelectorAll(".signal-filter-badge, .signal-filter-notice").forEach((element) => element.remove());
      post.classList.remove(HIDDEN);
    }
    post.dataset[PROCESSED] = "true";
    post.dataset.signalFilterFingerprint = fingerprint;
    recordAssessment(post, fingerprint);
    // Tweet detail views, replies, and image-first posts can be brief. They
    // still need the same feedback and save controls as feed posts.
    if (text.length < 80 && !isXPost) return;
    const value = score(text);
    const features = featureVector(text);
    const badge = addIndicator(post, value, features);
    askGemma(text, post, badge, value);
    chrome.storage.local.get({ preferenceModel: DEFAULT_PREFERENCE_MODEL }, ({ preferenceModel }) => {
      if (preferenceModel.examples < 12 || post.classList.contains(HIDDEN)) return;
      const probabilities = preferenceProbabilities(features, preferenceModel);
      if (probabilities.slop > 0.65 && probabilities.slop > probabilities.useful && probabilities.slop > probabilities.mixed) label(post, value);
    });
    // Conservative threshold: hide obvious hype, retain uncertain posts.
    if (value <= -3 + sensitivity) label(post, value);
  }

  function scan(root = document) {
    // Mutation callbacks can hand us the post card itself rather than its
    // parent. querySelectorAll only searches descendants, so inspect the root
    // before looking through its children.
    if (root.nodeType === Node.ELEMENT_NODE && POST_SELECTORS.some((selector) => root.matches(selector))) inspect(root);
    POST_SELECTORS.forEach((selector) => root.querySelectorAll(selector).forEach(inspect));
    // LinkedIn sometimes swaps to a compact card that exposes only the post
    // permalink. Use that durable activity marker to find its enclosing card.
    root.querySelectorAll("a[href*='/feed/update/'], a[href*='/posts/']").forEach((link) => {
      let card = link.closest("article, [data-urn], [data-activity-urn], [data-view-name='feed-full-update']");
      if (!card) {
        let candidate = link.parentElement;
        for (let level = 0; candidate && level < 7; level += 1, candidate = candidate.parentElement) {
          const candidateText = (candidate.innerText || "").trim();
          if (candidateText.length >= 40 && candidateText.length <= 40000) {
            card = candidate;
            break;
          }
        }
      }
      if (card) inspect(card);
    });
    // LinkedIn's newer feed marks cards semantically instead of with stable classes.
    root.querySelectorAll("h1, h2, h3, h4, h5, h6, [role='heading'], [aria-label='Feed post']").forEach((heading) => {
      const marker = `${heading.textContent || ""} ${heading.getAttribute("aria-label") || ""}`.trim().toLowerCase();
      if (!marker.includes("feed post")) return;
      let card = heading.closest("article, [data-view-name='feed-full-update']");
      // Some current LinkedIn cards have no stable post container. Find the
      // nearest compact ancestor that contains this one semantic post marker.
      if (!card) {
        let candidate = heading.parentElement;
        for (let level = 0; candidate && level < 8; level += 1, candidate = candidate.parentElement) {
          const text = candidate.innerText || "";
          if (text.length >= 80 && text.length <= 40000 && candidate.querySelectorAll("h2").length === 1) {
            card = candidate;
            break;
          }
        }
      }
      if (card) {
        inspect(card);
      } else if (!heading.dataset[PROCESSED]) {
        // Always expose feedback at the semantic marker, even when LinkedIn
        // does not reveal a stable enclosing card in the DOM.
        heading.dataset[PROCESSED] = "true";
        addIndicator(heading.parentElement || heading, 0, [1, 0, 0, 0, 0, 0]);
        recordAssessment(heading.parentElement || heading, heading.parentElement?.innerText || marker);
      }
    });
  }

  let rescanTimer;
  function scheduleRescan(delay = 300) {
    clearTimeout(rescanTimer);
    rescanTimer = setTimeout(() => scan(document), delay);
  }

  addStatus();
  scan();
  chrome.storage.local.get({ enabled: true }, ({ enabled: saved }) => {
    enabled = saved;
    if (enabled) scan();
  });
  chrome.storage.local.get({ usefulVotes: 0, slopVotes: 0 }, updateSensitivity);
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.themePreference) applyDashboardTheme(changes.themePreference.newValue);
    if (changes.usefulVotes || changes.slopVotes) {
      chrome.storage.local.get({ usefulVotes: 0, slopVotes: 0 }, updateSensitivity);
    }
    if (!changes.enabled) return;
    enabled = changes.enabled.newValue;
    if (!enabled) {
      document.querySelectorAll(`.${HIDDEN}`).forEach((post) => post.classList.remove(HIDDEN));
      document.querySelectorAll(".signal-filter-notice").forEach((notice) => notice.remove());
    } else {
      document.querySelectorAll("[data-signal-filter-processed]").forEach((post) => delete post.dataset[PROCESSED]);
      scan();
    }
    updateStatus();
  });
  new MutationObserver((changes) => {
    for (const change of changes) {
      if (change.type === "attributes") scheduleRescan();
      change.addedNodes.forEach((node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        if (POST_SELECTORS.some((selector) => node.matches?.(selector))) inspect(node);
        scan(node);
        scheduleRescan();
      });
    }
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "aria-hidden"] });

  // LinkedIn and X can reveal preloaded posts without adding fresh nodes.
  // Rescan after their live-feed controls so newly revealed cards receive
  // controls immediately.
  document.addEventListener("click", (event) => {
    const target = event.target.closest("button, [role='button']");
    const action = target && `${target.innerText || ""} ${target.getAttribute("aria-label") || ""} ${target.getAttribute("data-control-name") || ""}`;
    const isLiveFeedAction = /new\s+posts|show\s+\d+\s+posts/i.test(action || "");
    if (!isLiveFeedAction) return;
    scheduleRescan(250);
    setTimeout(() => scan(document), 1100);
    // LinkedIn may append the fresh cards only after its feed request has
    // completed; this final pass covers slower responses without a reload.
    setTimeout(() => scan(document), 2500);
  }, true);

  // Social feeds regularly replace content in-place. This bounded rescan is
  // cheap because fingerprints skip unchanged cards, while newly rendered
  // LinkedIn and X posts receive controls without a full page refresh.
  if (/(^|\.)(linkedin\.com|x\.com|twitter\.com)$/.test(location.hostname)) {
    setInterval(() => scan(document), 1800);
    // Browsers throttle extension timers in background tabs. Feed changes may
    // land while LinkedIn/X is inactive, so make an immediate set of passes
    // when the user returns to the window instead of waiting for a refresh.
    const rescanWhenActive = () => {
      if (document.visibilityState !== "visible") return;
      scheduleRescan(0);
      setTimeout(() => scan(document), 350);
      setTimeout(() => scan(document), 1200);
    };
    addEventListener("focus", rescanWhenActive);
    document.addEventListener("visibilitychange", rescanWhenActive);
    addEventListener("pageshow", rescanWhenActive);
  }
  if (/(^|\.)x\.com$|(^|\.)twitter\.com$/.test(location.hostname)) {
    const rescanAfterNavigation = () => {
      scheduleRescan(0);
      setTimeout(() => scan(document), 300);
      setTimeout(() => scan(document), 1100);
    };
    const originalPushState = history.pushState;
    history.pushState = function (...args) {
      const result = originalPushState.apply(this, args);
      rescanAfterNavigation();
      return result;
    };
    const originalReplaceState = history.replaceState;
    history.replaceState = function (...args) {
      const result = originalReplaceState.apply(this, args);
      rescanAfterNavigation();
      return result;
    };
    addEventListener("popstate", rescanAfterNavigation);
  }
})();
