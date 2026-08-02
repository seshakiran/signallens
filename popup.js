const enabled = document.querySelector('#enabled');
const filteredCount = document.querySelector('#filteredCount');
const scannedCount = document.querySelector('#scannedCount');
const usefulVotes = document.querySelector('#usefulVotes');
const slopVotes = document.querySelector('#slopVotes');
const mixedVotes = document.querySelector('#mixedVotes');
const preferenceExamples = document.querySelector('#preferenceExamples');
const accuracyPercent = document.querySelector('#accuracyPercent');
const accuracyDetail = document.querySelector('#accuracyDetail');
const accuracyBreakdown = document.querySelector('#accuracyBreakdown');
const learningStage = document.querySelector('#learningStage');
const learningProgressValue = document.querySelector('#learningProgressValue');
const learningProgressBar = document.querySelector('#learningProgressBar');
const learningProgressNote = document.querySelector('#learningProgressNote');
const learningMix = document.querySelector('#learningMix');
const gemmaStatus = document.querySelector('#gemmaStatus');
const bookmarkCount = document.querySelector('#bookmarkCount');
const folderName = document.querySelector('#folderName');
const addFolder = document.querySelector('#addFolder');
const folderList = document.querySelector('#folderList');
const themeToggle = document.querySelector('#themeToggle');
const dashboardView = document.querySelector('#dashboardView');
const learningView = document.querySelector('#learningView');
const bookmarkLibrary = document.querySelector('#bookmarkLibrary');
const bookmarkItems = document.querySelector('#bookmarkItems');
function renderAccuracy({ version, predictions = 0, correct = 0, byLabel = {} }) {
  if (version !== 2) {
    accuracyPercent.textContent = '—';
    accuracyDetail.textContent = 'richer local model needs new labels';
    accuracyBreakdown.textContent = 'Previous aggregate score is not comparable.';
    return;
  }
  accuracyPercent.textContent = predictions ? `${Math.round((correct / predictions) * 100)}%` : '—';
  accuracyDetail.textContent = predictions ? `agreement with your labels · ${correct} of ${predictions}` : 'personal-model agreement needs labels';
  const labelName = { useful: 'Useful', mixed: 'Mixed', slop: 'Low signal' };
  accuracyBreakdown.textContent = Object.entries(labelName).map(([key, name]) => {
    const result = byLabel[key] || { predictions: 0, correct: 0 };
    return result.predictions ? `${name} ${Math.round((result.correct / result.predictions) * 100)}%` : `${name} —`;
  }).join(' · ');
}
function renderLearningProgress(examples = []) {
  const count = examples.length;
  const mix = examples.reduce((totals, example) => {
    totals[example.vote] = (totals[example.vote] || 0) + 1;
    return totals;
  }, { useful: 0, mixed: 0, slop: 0 });
  const phase = count < 8
    ? { title: 'Collecting baseline', note: `${count} of 8 labels before full local retraining begins.` }
    : count < 24
      ? { title: 'Calibrating preferences', note: 'Retraining locally after every label; more varied examples improve reliability.' }
      : { title: 'Personalizing your feed', note: 'Your local model is adapting after every new label and correction.' };
  learningStage.textContent = phase.title;
  learningProgressValue.textContent = `${count} / 24`;
  learningProgressBar.style.width = `${Math.max(3, Math.min(100, (count / 24) * 100))}%`;
  learningProgressNote.textContent = phase.note;
  learningMix.innerHTML = `<span>👍 ${mix.useful}</span><span>😐 ${mix.mixed}</span><span>👎 ${mix.slop}</span><em>vectors only · stays on this device</em>`;
}
function renderGemmaStatus(status) {
  const ready = status?.state === 'ready';
  const failed = status?.state === 'error';
  gemmaStatus.textContent = status?.detail || 'Gemma 4 status: waiting for a local read';
  gemmaStatus.classList.toggle('is-ready', ready);
  gemmaStatus.classList.toggle('is-error', failed);
}
function renderBookmarks({ bookmarks = [], bookmarkFolders = ['Inbox'] }) {
  bookmarkCount.textContent = bookmarks.length;
  const counts = Object.fromEntries(bookmarkFolders.map((folder) => [folder, bookmarks.filter((item) => item.folder === folder).length]));
  folderList.innerHTML = bookmarkFolders.map((folder) => `<button class="folder-chip" data-folder="${escapeHtml(folder)}" title="Rename folder">${escapeHtml(folder)} <b>${counts[folder]}</b></button>`).join('');
  if (!bookmarks.length) {
    bookmarkItems.innerHTML = '<p class="empty-library">No saved posts yet. Use Save on a post to add one.</p>';
    return;
  }
  const platformFor = (item) => item.platform || (/x\.com|twitter\.com/.test(item.permalink) ? 'X' : 'LinkedIn');
  const groupBy = (items, keyFor) => items.reduce((groups, item) => {
    const key = keyFor(item);
    (groups[key] ||= []).push(item);
    return groups;
  }, {});
  const byPlatform = groupBy(bookmarks, platformFor);
  const platforms = ['LinkedIn', 'X'].filter((platform) => byPlatform[platform]?.length);
  bookmarkItems.innerHTML = platforms.map((platform) => {
    const byFolder = groupBy(byPlatform[platform], (item) => item.folder || 'Inbox');
    const folders = Object.keys(byFolder).sort((a, b) => a.localeCompare(b));
    return `<section class="bookmark-tree-source is-collapsed"><button class="tree-toggle tree-source-toggle" type="button" aria-expanded="false"><span class="tree-caret">⌄</span>${platform} <b>${byPlatform[platform].length}</b></button><div class="tree-children">${folders.map((folder) => `<section class="bookmark-tree-folder is-collapsed"><button class="tree-toggle tree-folder-toggle" type="button" aria-expanded="false"><span class="tree-branch">⌄</span>${escapeHtml(folder)} <b>${byFolder[folder].length}</b></button><div class="tree-children">${byFolder[folder].slice().sort((a, b) => b.savedAt - a.savedAt).map((item) => `<article class="bookmark-item"><span>${platform} · ${escapeHtml(folder)}</span><a href="${escapeHtml(item.permalink)}" target="_blank" rel="noreferrer">${escapeHtml(item.preview)}</a></article>`).join('')}</div></section>`).join('')}</div></section>`;
  }).join('');
}
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]); }
function applyTheme(preference) {
  const actual = preference === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : preference;
  document.documentElement.classList.toggle('theme-dark', actual === 'dark');
  document.documentElement.classList.toggle('theme-light', actual === 'light');
  themeToggle.textContent = actual === 'dark' ? '☀' : '☾';
  themeToggle.setAttribute('aria-label', `Switch to ${actual === 'dark' ? 'light' : 'dark'} theme`);
}
function renderCount({ filteredCount: count = 0 }) { filteredCount.textContent = count; }
function renderScanned({ scannedCount: count = 0 }) { scannedCount.textContent = count; }
chrome.storage.local.get({ enabled: true }, (settings) => { enabled.checked = settings.enabled; });
chrome.storage.local.get({ filteredCount: 0 }, renderCount);
chrome.storage.local.get({ scannedCount: 0 }, renderScanned);
chrome.storage.local.get({ usefulVotes: 0, mixedVotes: 0, slopVotes: 0 }, (votes) => { usefulVotes.textContent = votes.usefulVotes; mixedVotes.textContent = votes.mixedVotes; slopVotes.textContent = votes.slopVotes; });
chrome.storage.local.get({ preferenceModel: { examples: 0 } }, ({ preferenceModel }) => { preferenceExamples.textContent = preferenceModel.examples; });
chrome.storage.local.get({ preferenceStats: { predictions: 0, correct: 0 } }, ({ preferenceStats }) => renderAccuracy(preferenceStats));
chrome.storage.local.get({ trainingExamples: [] }, ({ trainingExamples }) => renderLearningProgress(trainingExamples));
chrome.storage.local.get({ gemmaStatus: null }, ({ gemmaStatus: status }) => renderGemmaStatus(status));
chrome.storage.local.get({ bookmarks: [], bookmarkFolders: ['Inbox'] }, renderBookmarks);
chrome.storage.local.get({ themePreference: 'system' }, ({ themePreference }) => applyTheme(themePreference));
themeToggle.addEventListener('click', () => chrome.storage.local.set({ themePreference: document.documentElement.classList.contains('theme-dark') ? 'light' : 'dark' }));
addFolder.addEventListener('click', () => {
  const folder = folderName.value.trim().slice(0, 40);
  if (!folder) return;
  chrome.storage.local.get({ bookmarkFolders: ['Inbox'] }, ({ bookmarkFolders }) => {
    chrome.storage.local.set({ bookmarkFolders: bookmarkFolders.includes(folder) ? bookmarkFolders : [...bookmarkFolders, folder] });
    folderName.value = '';
  });
});
folderList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-folder]');
  if (!button) return;
  const previous = button.dataset.folder;
  const next = prompt('Rename folder', previous)?.trim().slice(0, 40);
  if (!next || next === previous) return;
  chrome.storage.local.get({ bookmarks: [], bookmarkFolders: ['Inbox'] }, ({ bookmarks, bookmarkFolders }) => {
    if (bookmarkFolders.includes(next)) return;
    chrome.storage.local.set({ bookmarkFolders: bookmarkFolders.map((folder) => folder === previous ? next : folder), bookmarks: bookmarks.map((item) => item.folder === previous ? { ...item, folder: next } : item) });
  });
});
document.querySelector('.view-tabs').addEventListener('click', (event) => {
  const button = event.target.closest('[data-view]');
  if (!button) return;
  const view = button.dataset.view;
  dashboardView.hidden = view !== 'dashboard';
  learningView.hidden = view !== 'learning';
  bookmarkLibrary.hidden = view !== 'library';
  document.querySelectorAll('[data-view]').forEach((item) => item.classList.toggle('is-active', item === button));
});
document.querySelector('.export-actions').addEventListener('click', (event) => {
  const button = event.target.closest('[data-export]');
  if (button) chrome.runtime.sendMessage({ type: 'export-bookmarks', format: button.dataset.export });
});
document.querySelector('.bookmark-tree-actions').addEventListener('click', (event) => {
  const action = event.target.closest('[data-tree-action]')?.dataset.treeAction;
  if (!action) return;
  const collapsed = action === 'collapse';
  bookmarkItems.querySelectorAll('.bookmark-tree-source, .bookmark-tree-folder').forEach((branch) => {
    branch.classList.toggle('is-collapsed', collapsed);
    branch.querySelector(':scope > .tree-toggle').setAttribute('aria-expanded', String(!collapsed));
  });
});
bookmarkItems.addEventListener('click', (event) => {
  const toggle = event.target.closest('.tree-toggle');
  if (!toggle) return;
  const branch = toggle.closest('.bookmark-tree-source, .bookmark-tree-folder');
  const collapsed = branch.classList.toggle('is-collapsed');
  toggle.setAttribute('aria-expanded', String(!collapsed));
});
enabled.addEventListener('change', () => chrome.storage.local.set({ enabled: enabled.checked }));
chrome.storage.onChanged.addListener((changes) => {
  if (changes.filteredCount) renderCount({ filteredCount: changes.filteredCount.newValue });
  if (changes.scannedCount) renderScanned({ scannedCount: changes.scannedCount.newValue });
  if (changes.usefulVotes) usefulVotes.textContent = changes.usefulVotes.newValue;
  if (changes.slopVotes) slopVotes.textContent = changes.slopVotes.newValue;
  if (changes.mixedVotes) mixedVotes.textContent = changes.mixedVotes.newValue;
  if (changes.preferenceModel) preferenceExamples.textContent = changes.preferenceModel.newValue.examples;
  if (changes.preferenceStats) renderAccuracy(changes.preferenceStats.newValue);
  if (changes.trainingExamples) renderLearningProgress(changes.trainingExamples.newValue);
  if (changes.gemmaStatus) renderGemmaStatus(changes.gemmaStatus.newValue);
  if (changes.bookmarks || changes.bookmarkFolders) chrome.storage.local.get({ bookmarks: [], bookmarkFolders: ['Inbox'] }, renderBookmarks);
  if (changes.themePreference) applyTheme(changes.themePreference.newValue);
});
