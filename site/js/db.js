// Minimal IndexedDB wrapper for the loaded content package (chapters, appendix, images).
// Answers/progress are NOT stored here — those live in localStorage (see store.js).
const ContentDB = (() => {
  const DB_NAME = 'lkb-content';
  const DB_VERSION = 1;
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
        if (!db.objectStoreNames.contains('chapters')) db.createObjectStore('chapters');
        if (!db.objectStoreNames.contains('appendix')) db.createObjectStore('appendix');
        if (!db.objectStoreNames.contains('images')) db.createObjectStore('images');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function tx(storeName, mode) {
    const db = await open();
    return db.transaction(storeName, mode).objectStore(storeName);
  }

  async function get(storeName, key) {
    const store = await tx(storeName, 'readonly');
    return new Promise((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function getAllKeys(storeName) {
    const store = await tx(storeName, 'readonly');
    return new Promise((resolve, reject) => {
      const req = store.getAllKeys();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function put(storeName, key, value) {
    const store = await tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async function getAll(storeName) {
    const store = await tx(storeName, 'readonly');
    const keys = await getAllKeys(storeName);
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(keys.map((k, i) => [k, req.result[i]]));
      req.onerror = () => reject(req.error);
    });
  }

  async function clearAll() {
    const db = await open();
    const names = ['meta', 'chapters', 'appendix', 'images'];
    await Promise.all(names.map(name => new Promise((resolve, reject) => {
      const req = db.transaction(name, 'readwrite').objectStore(name).clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    })));
  }

  return { get, put, getAll, getAllKeys, clearAll };
})();
