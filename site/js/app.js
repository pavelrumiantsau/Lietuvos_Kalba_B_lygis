(function () {
  const app = document.getElementById('app');
  const statusEl = document.getElementById('content-status');
  const fileInput = document.getElementById('content-file-input');
  const loadBtn = document.getElementById('btn-load-content');
  const homeBtn = document.getElementById('btn-home');

  async function refreshStatus() {
    const meta = await ContentLoader.getMeta();
    if (!meta || !meta.chapters.length) {
      statusEl.textContent = 'Turinys neįkeltas';
    } else {
      statusEl.textContent = `Įkelta: ${meta.chapters.length} skyrius (${meta.chapters.join(', ')})`;
    }
  }

  function parseHash() {
    const m = location.hash.match(/^#\/c\/(\d+)\/s\/(\d+)/);
    if (m) return { route: 'chapter', chapter: Number(m[1]), section: Number(m[2]) };
    return { route: 'home' };
  }

  async function route() {
    const r = parseHash();
    if (r.route === 'chapter') {
      await Render.renderChapter(app, r.chapter, r.section);
    } else {
      await Render.renderHome(app);
    }
    window.scrollTo(0, 0);
  }

  window.addEventListener('hashchange', route);
  homeBtn.addEventListener('click', () => { location.hash = '#/'; });

  loadBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    loadBtn.disabled = true;
    loadBtn.textContent = 'Įkeliama…';
    try {
      const result = await ContentLoader.loadZipFile(file);
      await refreshStatus();
      await route();
      loadBtn.textContent = 'Įkelti turinį';
      alert(`Įkelta: ${result.chaptersLoaded.length} skyrius, ${result.imagesLoaded} paveikslėlių.`);
    } catch (e) {
      console.error(e);
      alert('Nepavyko įkelti turinio paketo. Patikrink, ar tai teisingas .zip failas.\n\n' + e.message);
      loadBtn.textContent = 'Įkelti turinį';
    } finally {
      loadBtn.disabled = false;
      fileInput.value = '';
    }
  });

  (async function init() {
    await refreshStatus();
    await route();
  })();
})();
