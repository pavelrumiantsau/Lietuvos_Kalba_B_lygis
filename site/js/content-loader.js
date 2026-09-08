// Loads a content-package .zip (produced separately from the book, never hosted in
// this repo) fully client-side using fflate, and stores it in IndexedDB so it survives
// reloads without re-uploading. Nothing here ever leaves the browser.
const ContentLoader = (() => {
  const imageUrlCache = new Map();

  function isJsonPath(path) {
    return path.endsWith('.json');
  }
  function isImagePath(path) {
    return /\.(jpe?g|png|webp|gif)$/i.test(path);
  }

  async function loadZipFile(file) {
    const buf = new Uint8Array(await file.arrayBuffer());
    const entries = fflate.unzipSync(buf);

    let manifest = null;
    const chapterWrites = [];
    const appendixWrites = [];
    const imageWrites = [];

    for (const path of Object.keys(entries)) {
      const data = entries[path];
      if (path.endsWith('manifest.json')) {
        manifest = JSON.parse(new TextDecoder().decode(data));
      } else if (/chapters\/chapter-(\d+)\.json$/.test(path)) {
        const num = parseInt(path.match(/chapter-(\d+)\.json$/)[1], 10);
        const json = JSON.parse(new TextDecoder().decode(data));
        chapterWrites.push([num, json]);
      } else if (/appendix.*\.json$/.test(path)) {
        const json = JSON.parse(new TextDecoder().decode(data));
        appendixWrites.push(json);
      } else if (isImagePath(path)) {
        const m = path.match(/images\/(.+)$/);
        const key = m ? m[1] : path;
        const ext = path.split('.').pop().toLowerCase();
        const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        const blob = new Blob([data], { type: mime });
        imageWrites.push([key, blob]);
      }
    }

    for (const [num, json] of chapterWrites) {
      await ContentDB.put('chapters', num, json);
    }

    if (appendixWrites.length) {
      const existing = (await ContentDB.get('appendix', 'listening')) || { transcripts: [] };
      const byId = new Map(existing.transcripts.map(t => [t.id, t]));
      for (const pkg of appendixWrites) {
        for (const t of (pkg.transcripts || [])) byId.set(t.id, t);
      }
      await ContentDB.put('appendix', 'listening', { transcripts: Array.from(byId.values()) });
    }

    for (const [key, blob] of imageWrites) {
      await ContentDB.put('images', key, blob);
    }

    const prevMeta = (await ContentDB.get('meta', 'manifest')) || { chapters: [] };
    const newChapterNums = chapterWrites.map(([num]) => num);
    const mergedChapters = Array.from(new Set([...(prevMeta.chapters || []), ...newChapterNums])).sort((a, b) => a - b);
    const meta = {
      version: manifest ? manifest.version : null,
      lastLoadedAt: Date.now(),
      chapters: mergedChapters,
    };
    await ContentDB.put('meta', 'manifest', meta);

    return { chaptersLoaded: newChapterNums, imagesLoaded: imageWrites.length, meta };
  }

  async function getMeta() {
    return (await ContentDB.get('meta', 'manifest')) || null;
  }

  async function listChapters() {
    const entries = await ContentDB.getAll('chapters');
    return entries
      .map(([num, json]) => ({ num, title: json.title, pageStart: json.pageStart, pageEnd: json.pageEnd }))
      .sort((a, b) => a.num - b.num);
  }

  async function getChapter(num) {
    return ContentDB.get('chapters', Number(num));
  }

  async function getAppendixListening() {
    const data = await ContentDB.get('appendix', 'listening');
    return data ? data.transcripts : [];
  }

  async function getTranscript(id) {
    const list = await getAppendixListening();
    return list.find(t => t.id === id) || null;
  }

  async function getImageUrl(path) {
    if (!path) return null;
    if (imageUrlCache.has(path)) return imageUrlCache.get(path);
    const key = path.replace(/^images\//, '');
    const blob = await ContentDB.get('images', key);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    imageUrlCache.set(path, url);
    return url;
  }

  async function hasAnyContent() {
    const meta = await getMeta();
    return !!(meta && meta.chapters && meta.chapters.length);
  }

  async function clearAll() {
    for (const url of imageUrlCache.values()) URL.revokeObjectURL(url);
    imageUrlCache.clear();
    await ContentDB.clearAll();
  }

  return {
    loadZipFile,
    getMeta,
    listChapters,
    getChapter,
    getAppendixListening,
    getTranscript,
    getImageUrl,
    hasAnyContent,
    clearAll,
  };
})();
