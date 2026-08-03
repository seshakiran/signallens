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
  const liveBadges = new WeakSet();
  let enabled = true;
  let linkedInEnabled = true;
  let xEnabled = true;
  let interestTopics = [];
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
    panel.innerHTML = `<header><span class="signal-filter-panel-grip">⋮⋮</span><strong>SignalLens</strong><span class="signal-filter-panel-local">Local</span><button type="button" aria-label="Minimize panel">−</button></header><section><p class="signal-filter-panel-kicker">Your SignalLens dashboard</p><div class="signal-filter-panel-metrics"><div><b data-dashboard="assessed">0</b><span>assessed</span></div><div><b data-dashboard="filtered">0</b><span>filtered</span></div></div><p class="signal-filter-panel-labels" data-dashboard="labels">0 useful · 0 mixed · 0 low signal</p><p class="signal-filter-panel-help">Drag the header to move. Drag the lower-right corner to resize.</p></section>`;
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

  // A local-only model. Feature vectors, never post text, are retained for
  // preference learning: [bias, technical depth, evidence, metrics, hype,
  // length, links, code, citations, firsthand experience, engagement bait,
  // vocabulary diversity].
  const CLASSES = ["useful", "mixed", "slop"];
  const FEATURE_COUNT = 12;
  const emptyWeights = () => Array(FEATURE_COUNT).fill(0);
  const DEFAULT_PREFERENCE_MODEL = { version: 2, weights: { useful: emptyWeights(), mixed: emptyWeights(), slop: emptyWeights() }, examples: 0 };
  const DEFAULT_PREFERENCE_STATS = { version: 2, predictions: 0, correct: 0, byLabel: { useful: { predictions: 0, correct: 0 }, mixed: { predictions: 0, correct: 0 }, slop: { predictions: 0, correct: 0 } } };

  function featureVector(text) {
    const normalized = text.toLowerCase();
    const count = (terms) => terms.reduce((n, term) => n + (normalized.includes(term.toLowerCase()) ? 1 : 0), 0);
    const words = normalized.match(/[a-z][a-z-]{2,}/g) || [];
    const uniqueWords = new Set(words).size;
    const linkCount = (text.match(/https?:\/\/\S+/gi) || []).length;
    return [
      1,
      Math.min(count(signalTerms) / 5, 1),
      Math.min(count(evidenceTerms) / 2, 1),
      /\b\d+(?:\.\d+)?\s?(?:%|ms|seconds|tokens|x)\b/i.test(text) ? 1 : 0,
      Math.min(count(hypeTerms) / 3, 1),
      Math.min(text.length / 3000, 1),
      Math.min(linkCount / 2, 1),
      /```|\b(const|function|class|import|curl|npm|pip|sql)\b/i.test(text) ? 1 : 0,
      /\[\d+\]|\b(according to|study|source|methodology)\b/i.test(text) ? 1 : 0,
      /\b(i built|i tested|we shipped|our team|in production|my experience)\b/i.test(text) ? 1 : 0,
      /\b(comment|like|share|repost|follow|drop a|agree\?)\b/i.test(text) ? 1 : 0,
      words.length ? Math.min(uniqueWords / words.length, 1) : 0
    ];
  }

  function normalizeModel(model) {
    if (!model?.weights || Array.isArray(model.weights)) return DEFAULT_PREFERENCE_MODEL;
    return {
      version: 2,
      weights: Object.fromEntries(CLASSES.map((name) => [name, [...(model.weights[name] || []), ...emptyWeights()].slice(0, FEATURE_COUNT)])),
      examples: model.examples || 0
    };
  }

  function normalizeStats(stats) {
    return stats?.version === 2 ? stats : DEFAULT_PREFERENCE_STATS;
  }

  function preferenceProbabilities(features, rawModel) {
    const model = normalizeModel(rawModel);
    const logits = Object.fromEntries(CLASSES.map((name) => [name, model.weights[name].reduce((total, weight, index) => total + weight * features[index], 0)]));
    const maximum = Math.max(...Object.values(logits));
    const totals = Object.fromEntries(CLASSES.map((name) => [name, Math.exp(logits[name] - maximum)]));
    const denominator = Object.values(totals).reduce((sum, value) => sum + value, 0);
    return Object.fromEntries(CLASSES.map((name) => [name, totals[name] / denominator]));
  }

  function trainOne(model, features, vote, rate) {
    const probabilities = preferenceProbabilities(features, model);
    CLASSES.forEach((name) => {
      const target = name === vote ? 1 : 0;
      model.weights[name] = model.weights[name].map((weight, index) => weight + rate * (target - probabilities[name]) * features[index]);
    });
  }

  function retrain(examples) {
    const model = normalizeModel(DEFAULT_PREFERENCE_MODEL);
    const counts = Object.fromEntries(CLASSES.map((name) => [name, examples.filter((item) => item.vote === name).length]));
    for (let epoch = 0; epoch < 8; epoch += 1) {
      examples.forEach((example) => {
        // Balance the dominant Useful class so lower-signal examples retain
        // influence without making the filter needlessly aggressive.
        const classWeight = Math.min(2.2, examples.length / Math.max(1, CLASSES.length * counts[example.vote]));
        trainOne(model, example.features, example.vote, 0.1 * classWeight);
      });
    }
    model.examples = examples.length;
    return model;
  }

  function trainPreference(features, vote, feedbackId) {
    chrome.storage.local.get({ preferenceModel: DEFAULT_PREFERENCE_MODEL, preferenceStats: DEFAULT_PREFERENCE_STATS, trainingExamples: [] }, ({ preferenceModel, preferenceStats, trainingExamples }) => {
      const modelBeforeVote = normalizeModel(preferenceModel);
      const probabilities = preferenceProbabilities(features, modelBeforeVote);
      const newPrediction = CLASSES.reduce((best, name) => probabilities[name] > probabilities[best] ? name : best, CLASSES[0]);
      const priorStats = normalizeStats(preferenceStats);
      const byLabel = structuredClone(priorStats.byLabel);
      const existingIndex = trainingExamples.findIndex((example) => example.id === feedbackId);
      const existing = existingIndex >= 0 ? trainingExamples[existingIndex] : undefined;
      const predictedVote = existing?.prediction || newPrediction;
      let stats;
      let examples;
      if (existing) {
        byLabel[existing.vote] = { predictions: byLabel[existing.vote].predictions - 1, correct: byLabel[existing.vote].correct - (predictedVote === existing.vote ? 1 : 0) };
        byLabel[vote] = { predictions: byLabel[vote].predictions + 1, correct: byLabel[vote].correct + (predictedVote === vote ? 1 : 0) };
        stats = { version: 2, predictions: priorStats.predictions, correct: priorStats.correct - (predictedVote === existing.vote ? 1 : 0) + (predictedVote === vote ? 1 : 0), byLabel };
        examples = trainingExamples.map((example) => example.id === feedbackId ? { ...example, vote, savedAt: Date.now() } : example);
      } else {
        byLabel[vote] = { predictions: byLabel[vote].predictions + 1, correct: byLabel[vote].correct + (predictedVote === vote ? 1 : 0) };
        stats = { version: 2, predictions: priorStats.predictions + 1, correct: priorStats.correct + (predictedVote === vote ? 1 : 0), byLabel };
        examples = [...trainingExamples.slice(-399), { id: feedbackId, features, vote, prediction: predictedVote, savedAt: Date.now() }];
      }
      const model = examples.length >= 8 ? retrain(examples) : modelBeforeVote;
      if (examples.length < 8) {
        trainOne(model, features, vote, 0.14);
        model.examples = examples.length;
      }
      chrome.storage.local.set({ preferenceModel: model, preferenceStats: stats, trainingExamples: examples });
    });
  }

  function score(text) {
    const normalized = text.toLowerCase();
    const count = (terms) => terms.reduce((n, term) => n + (normalized.includes(term.toLowerCase()) ? 1 : 0), 0);
    const signal = count(signalTerms);
    const evidence = count(evidenceTerms);
    const hype = count(hypeTerms);
    const hasMetric = /\b\d+(?:\.\d+)?\s?(?:%|ms|seconds|tokens|x)\b/i.test(text);
    const interest = interestTopics.reduce((total, topic) => total + (normalized.includes(topic.toLowerCase()) ? 1 : 0), 0);
    return signal * 2 + evidence * 3 + interest * 2 + (hasMetric ? 2 : 0) - hype * 3;
  }

  function label(post, value, message = "Filtered as low-signal content") {
    const existing = post.previousElementSibling?.matches(".signal-filter-notice") ? post.previousElementSibling : null;
    if (existing) {
      existing.querySelector("span").textContent = message;
      post.classList.add(HIDDEN);
      return;
    }
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

  function recordFeedback(kind, features, post) {
    const previous = post.dataset.signalFilterVote;
    if (previous === kind) return false;
    chrome.storage.local.get({ usefulVotes: 0, slopVotes: 0 }, (counts) => {
      chrome.storage.local.set({
        usefulVotes: Math.max(0, counts.usefulVotes + (kind === "useful" ? 1 : 0) - (previous === "useful" ? 1 : 0)),
        slopVotes: Math.max(0, counts.slopVotes + (kind === "slop" ? 1 : 0) - (previous === "slop" ? 1 : 0)),
        mixedVotes: Math.max(0, (counts.mixedVotes || 0) + (kind === "mixed" ? 1 : 0) - (previous === "mixed" ? 1 : 0))
      });
    });
    const feedbackId = post.dataset.signalFilterFeedbackId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    post.dataset.signalFilterFeedbackId = feedbackId;
    post.dataset.signalFilterVote = kind;
    trainPreference(features, kind, feedbackId);
    return true;
  }

  function saveBookmark(post, folder, controls) {
    const preview = (post.innerText || "").replace(/\s+/g, " ").trim().slice(0, 220);
    const isXPost = post.matches("article[data-testid='tweet']") || Boolean(post.closest("article[data-testid='tweet']"));
    // X adds timestamp query parameters to some in-post links. They are useful
    // for video deep-links but not as a bookmark identity, so retain only the
    // canonical status URL.
    const xStatusLink = isXPost
      ? [...post.querySelectorAll("a[href*='/status/']")].map((link) => link.href).find((href) => /\/status\/\d+/.test(href))
      : undefined;
    const directLink = isXPost
      ? xStatusLink?.replace(/[?#].*$/, "")
      : post.querySelector("a[href*='/feed/update/']")?.href;
    const activityUrn = !isXPost && (post.getAttribute("data-urn") || post.getAttribute("data-activity-urn") || post.querySelector("[data-urn^='urn:li:activity:'], [data-activity-urn^='urn:li:activity:']")?.getAttribute("data-urn") || post.querySelector("[data-activity-urn^='urn:li:activity:']")?.getAttribute("data-activity-urn"));
    const activityLink = activityUrn?.startsWith("urn:li:activity:")
      ? `${location.origin}/feed/update/${activityUrn}/`
      : undefined;
    // A unique local fallback prevents different cards from sharing the feed
    // page URL when a site temporarily withholds its canonical permalink.
    const permalink = directLink || activityLink || `${location.href.split("#")[0]}#signallens-${hashText(preview)}`;
    const platform = isXPost ? "X" : "LinkedIn";
    // The service worker serializes saves from every open LinkedIn/X tab so a
    // simultaneous save cannot replace previously stored bookmarks.
    controls.setAttribute("aria-busy", "true");
    controls.textContent = "Saving…";
    const bookmark = { folder, platform, permalink, preview };
    const saveDirectly = () => {
      // A content script has the same local storage permission as the service
      // worker. This is a resilience path for X tabs where a suspended worker
      // can close the response channel before replying.
      chrome.storage.local.get({ bookmarks: [], bookmarkFolders: ["Inbox"] }, ({ bookmarks, bookmarkFolders }) => {
        const existing = bookmarks.some((item) => item.permalink === permalink);
        const nextBookmarks = existing ? bookmarks : [...bookmarks, {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          ...bookmark,
          savedAt: Date.now()
        }];
        const nextFolders = bookmarkFolders.includes(folder) ? bookmarkFolders : [...bookmarkFolders, folder];
        chrome.storage.local.set({ bookmarks: nextBookmarks, bookmarkFolders: nextFolders }, () => {
          controls.removeAttribute("aria-busy");
          if (chrome.runtime.lastError) {
            controls.innerHTML = '<span class="signal-filter-bookmark-error">Couldn’t save — try again</span>';
            return;
          }
          controls.innerHTML = `<span class="signal-filter-bookmarked">✓ ${existing ? "Already saved" : `Saved to ${folder}`}</span>`;
        });
      });
    };
    chrome.runtime.sendMessage({ type: "save-bookmark", bookmark }, (result) => {
      controls.removeAttribute("aria-busy");
      const failure = chrome.runtime.lastError?.message || result?.error;
      if (failure || !result?.saved) {
        saveDirectly();
        return;
      }
      controls.innerHTML = `<span class="signal-filter-bookmarked">✓ ${result.existing ? "Already saved" : `Saved to ${folder}`}</span>`;
    });
  }

  function addBookmarkControl(post, badge) {
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.textContent = "Save";
    const suppressPostHandling = (event) => {
      event.preventDefault();
      event.stopPropagation();
    };
    // X listens to pointer events on the entire tweet card and may replace
    // custom descendants before their click event fires. Stop that sequence at
    // the extension control itself, not just at the final click.
    ["pointerdown", "mousedown", "touchstart"].forEach((type) => trigger.addEventListener(type, suppressPostHandling));
    trigger.addEventListener("click", (event) => {
      // X delegates clicks from the whole post card. Keep this interaction in
      // the extension so it cannot be swallowed by (or trigger) the post UI.
      event.preventDefault();
      event.stopPropagation();
      chrome.storage.local.get({ bookmarkFolders: ["Inbox"] }, ({ bookmarkFolders }) => {
        const controls = document.createElement("span");
        controls.className = "signal-filter-bookmark-controls signal-filter-bookmark-menu";
        controls.innerHTML = '<span class="signal-filter-bookmark-menu-label">Save to</span>';
        const createFolder = () => {
          const folder = prompt("New bookmark folder")?.trim().slice(0, 40);
          if (!folder) return;
          saveBookmark(post, folder, controls);
        };
        const addFolderButton = (label, handler, className = "") => {
          const option = document.createElement("button");
          option.type = "button";
          option.className = className;
          option.textContent = label;
          ["pointerdown", "mousedown", "touchstart"].forEach((type) => option.addEventListener(type, suppressPostHandling));
          option.addEventListener("click", (choiceEvent) => {
            choiceEvent.preventDefault();
            choiceEvent.stopPropagation();
            handler();
          });
          controls.append(option);
        };
        addFolderButton("+ New folder", createFolder, "signal-filter-new-folder");
        bookmarkFolders.forEach((folder) => addFolderButton(folder, () => saveBookmark(post, folder, controls)));
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
    liveBadges.add(badge);
    const xPost = post.matches("article[data-testid='tweet']");
    let surface = badge;
    if (xPost) {
      // X delegates post clicks very aggressively. A shadow boundary keeps a
      // folder dropdown or Save click from being reinterpreted as opening the
      // tweet, while leaving the card itself fully usable.
      badge.classList.add("signal-filter-badge-x");
      const shadow = badge.attachShadow({ mode: "open" });
      const style = document.createElement("style");
      style.textContent = `:host { display:block; margin:8px 0 10px; } .bar { align-items:center; background:#111a27; border:1px solid #294865; border-left:3px solid #2b8ad6; border-radius:12px; color:#d8e8f7; display:flex; font:12px/1.2 system-ui,sans-serif; gap:8px; max-width:100%; padding:7px 9px; } span { font-weight:650; margin-right:auto; } button { background:#172b3e; border:1px solid #3a6689; border-radius:12px; color:#b9dcf8; cursor:pointer; font-size:12px; padding:4px 8px; } button.is-selected { background:#2b8ad6; border-color:#2b8ad6; color:#07131d; } .signal-filter-bookmark-controls { align-items:center; display:inline-flex; gap:5px; } .signal-filter-bookmark-menu { flex-wrap:wrap; } .signal-filter-bookmark-menu-label { font-weight:700; } .signal-filter-bookmark-menu button { font-size:11px; } .signal-filter-new-folder { border-style:dashed; } .signal-filter-bookmarked { background:#144c32; border-radius:999px; color:#a6f3c7; font:700 12px/1 system-ui,sans-serif; padding:6px 9px; } .signal-filter-bookmark-error { background:#5a2328; border-radius:999px; color:#ffc3c7; font:700 12px/1 system-ui,sans-serif; padding:6px 9px; }`;
      surface = document.createElement("div");
      surface.className = "bar";
      shadow.append(style, surface);
      // Let controls receive their normal default behavior (including the
      // native folder select) while preventing the event from escaping into
      // X's tweet-level click handler.
      ["pointerdown", "mousedown", "touchstart", "click"].forEach((type) => surface.addEventListener(type, (event) => event.stopPropagation()));
    }
    surface.innerHTML = `<span>${result}</span><button type="button" data-vote="useful" title="Useful">👍</button><button type="button" data-vote="mixed" title="Mixed">😐</button><button type="button" data-vote="slop" title="Low signal">👎</button>`;
    badge.signalLensSurface = surface;
    surface.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        const vote = button.dataset.vote;
        if (!recordFeedback(vote, features, post)) return;
        surface.querySelector("span").textContent = vote === "useful" ? "Marked useful" : vote === "mixed" ? "Marked mixed" : "Marked low signal";
        surface.querySelectorAll("button[data-vote]").forEach((item) => item.classList.toggle("is-selected", item.dataset.vote === vote));
        if (vote === "useful") {
          post.classList.remove(HIDDEN);
          if (post.previousElementSibling?.matches(".signal-filter-notice")) post.previousElementSibling.remove();
        }
        if (vote === "slop") label(post, value);
        if (vote === "mixed") label(post, value, "Hidden as mixed relevance");
      });
    });
    // X posts use a horizontal outer article. Attach inside the post's text
    // area so the extension never becomes a new layout column.
    const host = xPost ? post.querySelector("[data-testid='tweetText']")?.parentElement : post;
    (host || post).prepend(badge);
    addBookmarkControl(post, surface);
    return badge;
  }

  function askGemma(text, post, badge, value) {
    const surface = badge.signalLensSurface || badge;
    surface.querySelector("span").textContent = "Reading with AI…";
    let settled = false;
    const fallback = () => {
      if (settled || !badge.isConnected) return;
      settled = true;
      surface.querySelector("span").textContent = "Read locally (rule-based)";
    };
    // An 8B local model can take several seconds just to wake up. Keep the
    // controls responsive, but give Gemma enough time to complete a real read.
    const timeout = setTimeout(fallback, 90000);
    chrome.runtime.sendMessage({ type: "classify-post", text }, (result) => {
      clearTimeout(timeout);
      if (settled || !badge.isConnected) return;
      settled = true;
      if (chrome.runtime.lastError || result?.error) {
        const detail = result?.error || chrome.runtime.lastError?.message || "connection failed";
        surface.querySelector("span").textContent = `AI unavailable: ${detail.slice(0, 56)}`;
        return;
      }
      const labels = { useful: "AI: useful", slop: "AI: likely low signal", uncertain: "AI: uncertain" };
      surface.querySelector("span").textContent = `${labels[result.label]} — ${result.reason}`;
      if (result.label === "slop" && !post.classList.contains(HIDDEN)) label(post, value);
    });
  }

  function inspect(post) {
    const isXPost = post.matches("article[data-testid='tweet']");
    if (!enabled || (isXPost ? !xEnabled || !isXHomeTimeline() : !linkedInEnabled)) return;
    // X virtualizes its timeline and may reuse an existing article for a
    // different tweet. Reprocess only when its underlying content changes.
    const cleanPost = post.cloneNode(true);
    cleanPost.querySelectorAll(".signal-filter-badge, .signal-filter-notice, .signal-filter-bookmark-controls").forEach((element) => element.remove());
    const text = (cleanPost.innerText || cleanPost.textContent || "").trim();
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
    // Framework re-renders may clone the visible badge but discard its click
    // listeners. Only a badge created in this content-script context counts
    // as live; a cloned one is removed and rebuilt with fresh controls.
    const controlsPresent = Array.from(post.querySelectorAll(".signal-filter-badge")).some((badge) => liveBadges.has(badge));
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
    if (!canScanCurrentPage()) return;
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

  function clearCurrentSite() {
    document.querySelectorAll(`.${HIDDEN}`).forEach((post) => post.classList.remove(HIDDEN));
    document.querySelectorAll(".signal-filter-notice, .signal-filter-badge, .signal-filter-bookmark-controls").forEach((element) => element.remove());
    document.querySelectorAll("[data-signal-filter-processed]").forEach((post) => delete post.dataset[PROCESSED]);
    // Do not leave an "active" indicator behind when this specific site has
    // been disabled. It otherwise looks as though X is still being read.
    document.querySelector("#signal-filter-status")?.remove();
    document.querySelector("#signal-filter-panel")?.remove();
    document.querySelector("#signal-filter-launcher")?.remove();
  }

  function isCurrentSiteEnabled() {
    return location.hostname.endsWith("x.com") || location.hostname.endsWith("twitter.com") ? xEnabled : linkedInEnabled;
  }

  function isXHomeTimeline() {
    const isX = location.hostname.endsWith("x.com") || location.hostname.endsWith("twitter.com");
    return !isX || location.pathname === "/home";
  }

  function canScanCurrentPage() {
    return enabled && isCurrentSiteEnabled() && isXHomeTimeline();
  }

  function clearInactiveSiteUi() {
    clearCurrentSite();
  }

  chrome.storage.local.get({ enabled: true, linkedInEnabled: true, xEnabled: true }, (settings) => {
    const saved = settings.enabled;
    enabled = saved;
    linkedInEnabled = settings.linkedInEnabled;
    xEnabled = settings.xEnabled;
    if (canScanCurrentPage()) {
      addStatus();
      scan();
    } else {
      clearInactiveSiteUi();
    }
  });
  chrome.storage.local.get({ profileSettings: { topics: [] } }, ({ profileSettings }) => { interestTopics = profileSettings.topics || []; });
  chrome.storage.local.get({ usefulVotes: 0, slopVotes: 0 }, updateSensitivity);
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.themePreference) applyDashboardTheme(changes.themePreference.newValue);
    if (changes.profileSettings) interestTopics = changes.profileSettings.newValue.topics || [];
    if (changes.usefulVotes || changes.slopVotes) {
      chrome.storage.local.get({ usefulVotes: 0, slopVotes: 0 }, updateSensitivity);
    }
    if (changes.enabled) enabled = changes.enabled.newValue;
    if (changes.linkedInEnabled) linkedInEnabled = changes.linkedInEnabled.newValue;
    if (changes.xEnabled) xEnabled = changes.xEnabled.newValue;
    if (!changes.enabled && !changes.linkedInEnabled && !changes.xEnabled) return;
    if (!canScanCurrentPage()) {
      clearInactiveSiteUi();
    } else {
      clearCurrentSite();
      addStatus();
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
      clearCurrentSite();
      if (!canScanCurrentPage()) return;
      addStatus();
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
