// Answers, self-marked status, and reveal-state live in localStorage — plain per-device
// browser storage, never sent anywhere. Answer shape: { value, status, updatedAt }.
// status: 'unanswered' | 'checked' | 'needs_review' | 'correct'
const AnswerStore = (() => {
  const KEY = 'lkb-answers-v1';
  let cache = null;
  let saveTimer = null;

  function load() {
    if (cache) return cache;
    try {
      const raw = localStorage.getItem(KEY);
      cache = raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.warn('AnswerStore: failed to read localStorage, starting fresh', e);
      cache = {};
    }
    return cache;
  }

  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(cache));
      } catch (e) {
        console.warn('AnswerStore: failed to write localStorage', e);
      }
    }, 250);
  }

  function get(taskId) {
    const data = load();
    return data[taskId] || { value: null, status: 'unanswered', updatedAt: null };
  }

  function setValue(taskId, value) {
    const data = load();
    const prev = data[taskId] || {};
    data[taskId] = {
      value,
      status: prev.status && prev.status !== 'unanswered' ? prev.status : 'unanswered',
      updatedAt: Date.now(),
    };
    persist();
    return data[taskId];
  }

  function setStatus(taskId, status) {
    const data = load();
    const prev = data[taskId] || { value: null };
    data[taskId] = { ...prev, status, updatedAt: Date.now() };
    persist();
    return data[taskId];
  }

  function progressForTasks(taskIds) {
    const data = load();
    let answered = 0;
    let checked = 0;
    for (const id of taskIds) {
      const a = data[id];
      if (a && a.value != null && hasContent(a.value)) answered++;
      if (a && (a.status === 'checked' || a.status === 'correct' || a.status === 'needs_review')) checked++;
    }
    return { total: taskIds.length, answered, checked };
  }

  function hasContent(value) {
    if (value == null) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.some(hasContent);
    if (typeof value === 'object') return Object.values(value).some(hasContent);
    return true;
  }

  function exportAll() {
    return JSON.stringify(load(), null, 2);
  }

  return { get, setValue, setStatus, progressForTasks, hasContent, exportAll };
})();

// Some chapter content is a summary rather than the verbatim book text (long reading
// passages, a song, a poem — kept out of the extracted content for copyright reasons;
// see docs/CONTENT-SCHEMA.md). If you own the book and want full fidelity for your own
// use, you can paste the original wording in yourself here — it stays in this browser's
// localStorage only, never uploaded anywhere, and is used instead of the summary once set.
const SourceTextStore = (() => {
  const KEY = 'lkb-source-text-v1';
  let cache = null;
  let saveTimer = null;

  function load() {
    if (cache) return cache;
    try {
      const raw = localStorage.getItem(KEY);
      cache = raw ? JSON.parse(raw) : {};
    } catch (e) {
      cache = {};
    }
    return cache;
  }

  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (e) { /* ignore */ }
    }, 250);
  }

  function get(id) {
    return load()[id] || '';
  }

  function set(id, text) {
    const data = load();
    if (text && text.trim()) data[id] = text;
    else delete data[id];
    persist();
  }

  return { get, set };
})();

// Small UI prefs (theme override, last-visited chapter) — also localStorage, tiny.
const PrefsStore = (() => {
  const KEY = 'lkb-prefs-v1';
  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || {};
    } catch (e) {
      return {};
    }
  }
  function set(patch) {
    const data = { ...load(), ...patch };
    localStorage.setItem(KEY, JSON.stringify(data));
    return data;
  }
  return { load, set };
})();
