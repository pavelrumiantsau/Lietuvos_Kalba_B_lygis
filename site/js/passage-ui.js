// Shared rendering for a "passage" (reading text) — used both for standalone passage
// blocks and for passages/quotes embedded directly inside a task (sourcePassages).
// Handles the summaryNotVerbatim case: shows a clear badge + lets the learner paste in
// their own transcription of the original text (stored locally only, see SourceTextStore).
const PassageUI = (() => {
  const { h, debounce } = TaskWidgets;

  async function renderImages(images) {
    const frag = document.createDocumentFragment();
    for (const img of images || []) {
      if (!img.file) {
        if (img.caption || img.label) {
          frag.appendChild(h('span', { class: 'wordbank' }, h('span', { class: 'chip' }, `🖼 ${img.caption || img.label}`)));
        }
        continue;
      }
      const url = await ContentLoader.getImageUrl(img.file);
      if (!url) continue;
      const fig = h('figure', { class: 'passage-image' }, [h('img', { src: url, alt: img.caption || img.label || '' })]);
      if (img.caption) fig.appendChild(h('figcaption', {}, img.caption));
      else if (img.label) fig.appendChild(h('figcaption', {}, img.label));
      frag.appendChild(fig);
    }
    return frag;
  }

  function renderSourceTextBox(passage) {
    const wrap = h('div', {});
    const existing = SourceTextStore.get(passage.id);
    const badge = h('div', { class: 'tf-given-badge', style: 'background:var(--warn-bg);color:var(--warn);display:inline-block;margin-bottom:6px' },
      `Santrauka, ne originalus tekstas${passage.sourcePage ? ` — originalą žr. knygos p. ${passage.sourcePage}` : ''}`);
    wrap.appendChild(badge);
    const toggle = h('button', { class: 'btn btn-small' }, existing ? 'Redaguoti įklijuotą originalų tekstą' : 'Įklijuoti originalų tekstą (neprivaloma)');
    const box = h('div', { hidden: true });
    const ta = h('textarea', { class: 'open-answer', rows: 6, placeholder: 'Įklijuok originalų teksto tekstą iš savo knygos — bus saugoma tik šiame naršyklėje.' });
    ta.value = existing;
    const save = debounce((val) => SourceTextStore.set(passage.id, val), 400);
    ta.addEventListener('input', (e) => save(e.target.value));
    box.appendChild(ta);
    toggle.addEventListener('click', () => { box.hidden = !box.hidden; });
    wrap.appendChild(toggle);
    wrap.appendChild(box);
    return { wrap, getCurrentText: () => SourceTextStore.get(passage.id) };
  }

  async function renderPassageCard(passage, opts = {}) {
    const wrap = h('div', { class: opts.card === false ? 'passage' : 'card passage' });
    if (passage.sourcePage) wrap.appendChild(h('div', { class: 'source-page' }, `p. ${passage.sourcePage}`));
    if (passage.title) wrap.appendChild(h('div', { class: 'passage-title' }, passage.title));
    if (passage.author) wrap.appendChild(h('div', { class: 'q-text' }, passage.author));

    if (passage.summaryNotVerbatim) {
      const { wrap: box } = renderSourceTextBox(passage);
      wrap.appendChild(box);
      const existing = SourceTextStore.get(passage.id);
      if (existing) {
        existing.split(/\n+/).forEach(p => { if (p.trim()) wrap.appendChild(h('p', {}, p)); });
      } else {
        (passage.paragraphs || []).forEach(p => {
          if (p === '') wrap.appendChild(h('div', { style: 'height:8px' }));
          else wrap.appendChild(h('p', { style: 'color:var(--text-muted);font-style:italic' }, p));
        });
      }
    } else {
      (passage.paragraphs || []).forEach(p => {
        if (p === '') wrap.appendChild(h('div', { style: 'height:8px' }));
        else wrap.appendChild(h('p', {}, p));
      });
    }

    if (passage.images) wrap.appendChild(await renderImages(passage.images));

    if (passage.footnotes && passage.footnotes.length) {
      const fn = h('div', { class: 'footnotes' });
      passage.footnotes.forEach(f => fn.appendChild(h('div', {}, f)));
      wrap.appendChild(fn);
    }
    return wrap;
  }

  function renderQuotes(quotes) {
    const wrap = h('div', {});
    quotes.forEach(q => {
      wrap.appendChild(h('div', { class: 'passage', style: 'margin-bottom:8px' }, [
        h('p', { style: 'font-style:italic;margin:0' }, `„${q.text}“`),
        h('div', { class: 'source-page' }, `— ${q.author}`),
      ]));
    });
    return wrap;
  }

  return { renderPassageCard, renderQuotes, renderImages, renderSourceTextBox };
})();
