const OLLAMA_URL = "http://127.0.0.1:11434/api/generate";
const MODEL = "gemma4:e4b";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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
  classify(message.text).then(sendResponse).catch((error) => sendResponse({ error: error.message }));
  return true;
});

async function classify(text) {
  const prompt = `You are a strict filter for a technical LinkedIn reader. Judge value to the reader, never value for engagement, marketing, or content generation.\n\nUseful: concrete and supportable claims; technical detail; examples; measurements; code; primary sources; original analysis; clearly scoped experience.\nSlop: vague promotion, generic motivation, recycled advice, engagement bait, unsupported grand claims, or a long list of buzzwords without evidence.\n\nExample: “Revolutionary AI changes everything. Comment YES.” = slop.\nExample: “Our retrieval evaluation reduced unsupported answers from 18% to 7%; methodology linked.” = useful.\n\nReturn only JSON: {"label":"useful"|"slop"|"uncertain","reason":"under 12 words"}.\n\nPost:\n${text.slice(0, 12000)}`;
  const response = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, prompt, stream: false, format: "json", options: { temperature: 0 } })
  });
  if (!response.ok) throw new Error("Gemma 4 is unavailable");
  const payload = await response.json();
  const result = JSON.parse(payload.response);
  if (!['useful', 'slop', 'uncertain'].includes(result.label)) throw new Error("Gemma returned an invalid label");
  return result;
}
