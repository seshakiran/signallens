const OLLAMA_URLS = ["http://127.0.0.1:11434/api/generate", "http://localhost:11434/api/generate"];
const MODEL = "gemma4:e4b";
let assessmentQueue = Promise.resolve();
let bookmarkQueue = Promise.resolve();
let gemmaQueue = Promise.resolve();
let reviewCollectorTabId = null;
let lastReviewCollectionStartedAt = 0;

function resetAssessmentSession() {
  return Promise.all([
    chrome.storage.session.set({ assessmentKeys: [] }),
    chrome.storage.local.set({ scannedCount: 0 })
  ]);
}

chrome.runtime.onInstalled.addListener(() => { resetAssessmentSession(); });
chrome.runtime.onStartup.addListener(() => { resetAssessmentSession(); });

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'schedule-review-collection') {
    scheduleReviewCollection().then(sendResponse).catch((error) => sendResponse({ started: false, error: error.message }));
    return true;
  }
  if (message.type === 'collector-ready') {
    if (_sender.tab?.id === reviewCollectorTabId) {
      setTimeout(() => chrome.tabs.sendMessage(reviewCollectorTabId, { type: 'collect-for-review', backgroundCollector: true }), 1600);
    }
    return;
  }
  if (message.type === 'review-collection-finished') {
    if (_sender.tab?.id === reviewCollectorTabId) {
      chrome.tabs.remove(reviewCollectorTabId).catch(() => undefined);
      reviewCollectorTabId = null;
    }
    return;
  }
  if (message.type === 'save-bookmark') {
    saveBookmark(message.bookmark).then(sendResponse).catch((error) => sendResponse({ saved: false, error: error.message }));
    return true;
  }
  if (message.type === 'record-assessment') {
    recordAssessment(message.key).then(sendResponse);
    return true;
  }
  if (message.type === 'export-bookmarks') {
    chrome.storage.local.get({ bookmarks: [] }, ({ bookmarks }) => {
      const rows = message.format === 'csv'
        ? ['folder,link,preview,saved_at', ...bookmarks.map((item) => [item.folder, item.permalink, item.preview, new Date(item.savedAt).toISOString()].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))].join('\n')
        : JSON.stringify(bookmarks, null, 2);
      const mime = message.format === 'csv' ? 'text/csv' : 'application/json';
      chrome.downloads.download({ url: `data:${mime};charset=utf-8,${encodeURIComponent(rows)}`, filename: `signallens-bookmarks.${message.format}`, saveAs: true });
    });
    return;
  }
  if (message.type !== "classify-post") return;
  classifyWithGemma(message.text).then(sendResponse).catch((error) => sendResponse({ error: error.message }));
  return true;
});

async function scheduleReviewCollection() {
  if (reviewCollectorTabId || Date.now() - lastReviewCollectionStartedAt < 300000) return { started: false, reason: 'already scheduled' };
  lastReviewCollectionStartedAt = Date.now();
  const tab = await chrome.tabs.create({ url: 'https://www.linkedin.com/feed/?signallens-reader=1', active: false });
  reviewCollectorTabId = tab.id;
  setTimeout(() => {
    if (reviewCollectorTabId !== tab.id) return;
    chrome.tabs.remove(tab.id).catch(() => undefined);
    reviewCollectorTabId = null;
  }, 120000);
  return { started: true };
}

async function classifyWithGemma(text) {
  const { llmConfig = { provider: 'ollama', endpoint: OLLAMA_URLS[0], model: MODEL, apiKey: '' } } = await chrome.storage.local.get({ llmConfig: { provider: 'ollama', endpoint: OLLAMA_URLS[0], model: MODEL, apiKey: '' } });
  const task = gemmaQueue.then(() => classify(text, llmConfig));
  gemmaQueue = task.catch(() => undefined);
  try {
    const result = await task;
    const providerName = { ollama: 'Ollama', compatible: 'Local compatible server', openai: 'OpenAI', anthropic: 'Anthropic' }[llmConfig.provider] || 'AI provider';
    await chrome.storage.local.set({ gemmaStatus: { state: 'ready', detail: `${providerName} is responding`, updatedAt: Date.now() } });
    return result;
  } catch (error) {
    await chrome.storage.local.set({ gemmaStatus: { state: 'error', detail: `AI connection: ${error.message}`, updatedAt: Date.now() } });
    throw error;
  }
}

async function saveBookmark(bookmark) {
  const task = bookmarkQueue.then(() => saveBookmarkSafely(bookmark));
  bookmarkQueue = task.catch(() => undefined);
  return task;
}

async function saveBookmarkSafely(bookmark) {
  const { bookmarks = [], bookmarkFolders = ['Inbox'] } = await chrome.storage.local.get({ bookmarks: [], bookmarkFolders: ['Inbox'] });
  const existing = bookmarks.some((item) => item.permalink === bookmark.permalink);
  const nextBookmarks = existing ? bookmarks : [...bookmarks, {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    folder: bookmark.folder,
    platform: bookmark.platform,
    permalink: bookmark.permalink,
    preview: bookmark.preview,
    savedAt: Date.now()
  }];
  const nextFolders = bookmarkFolders.includes(bookmark.folder) ? bookmarkFolders : [...bookmarkFolders, bookmark.folder];
  await chrome.storage.local.set({ bookmarks: nextBookmarks, bookmarkFolders: nextFolders });
  return { saved: true, existing };
}

async function recordAssessment(key) {
  const task = assessmentQueue.then(() => recordAssessmentSafely(key));
  assessmentQueue = task.catch(() => undefined);
  return task;
}

async function recordAssessmentSafely(key) {
  const storage = chrome.storage.session;
  const { assessmentKeys = [] } = await storage.get({ assessmentKeys: [] });
  if (assessmentKeys.includes(key)) return { counted: false };
  // Keep the current browser-session footprint bounded even for heavy feeds.
  const nextKeys = [...assessmentKeys.slice(-4999), key];
  const { scannedCount = 0 } = await chrome.storage.local.get({ scannedCount: 0 });
  await Promise.all([
    storage.set({ assessmentKeys: nextKeys }),
    chrome.storage.local.set({ scannedCount: scannedCount + 1 })
  ]);
  return { counted: true };
}

async function classify(text, config) {
  // Keep local inference responsive on long social posts.
  text = text.slice(0, 4500);
  const prompt = `You are a strict filter for a technical LinkedIn reader. Judge value to the reader, never value for engagement, marketing, or content generation.\n\nUseful: concrete and supportable claims; technical detail; examples; measurements; code; primary sources; original analysis; clearly scoped experience.\nSlop: vague promotion, generic motivation, recycled advice, engagement bait, unsupported grand claims, or a long list of buzzwords without evidence.\n\nExample: “Revolutionary AI changes everything. Comment YES.” = slop.\nExample: “Our retrieval evaluation reduced unsupported answers from 18% to 7%; methodology linked.” = useful.\n\nReturn only JSON: {"label":"useful"|"slop"|"uncertain","reason":"under 12 words"}.\n\nPost:\n${text.slice(0, 12000)}`;
  if (config.provider === 'openai' || config.provider === 'compatible') return classifyOpenAI(prompt, config);
  if (config.provider === 'anthropic') return classifyAnthropic(prompt, config);
  const request = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: config.model || MODEL, prompt, stream: false, format: "json", keep_alive: "15m", options: { temperature: 0, num_predict: 80 } }) };
  let response;
  let lastError;
  for (const url of config.endpoint ? [config.endpoint] : OLLAMA_URLS) {
    try {
      const candidate = await fetch(url, request);
      if (candidate.ok) {
        response = candidate;
        break;
      }
      lastError = new Error(`Ollama returned ${candidate.status}`);
    } catch (error) {
      lastError = error;
    }
  }
  if (!response) throw new Error(lastError?.message || "Ollama could not be reached");
  const payload = await response.json();
  const result = JSON.parse(payload.response);
  if (!['useful', 'slop', 'uncertain'].includes(result.label)) throw new Error("Gemma returned an invalid label");
  return result;
}

async function classifyOpenAI(prompt, config) { const response = await fetch(config.endpoint || 'https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` }, body: JSON.stringify({ model: config.model, messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' }, temperature: 0 }) }); if (!response.ok) throw new Error(`Provider returned ${response.status}`); return JSON.parse((await response.json()).choices[0].message.content); }
async function classifyAnthropic(prompt, config) { const response = await fetch(config.endpoint || 'https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': config.apiKey, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: config.model, max_tokens: 120, messages: [{ role: 'user', content: prompt }] }) }); if (!response.ok) throw new Error(`Provider returned ${response.status}`); return JSON.parse((await response.json()).content[0].text); }
