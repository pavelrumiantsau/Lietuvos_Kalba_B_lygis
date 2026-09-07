const Render = (() => {
  const { h } = TaskWidgets;

  function collectTaskIds(chapter) {
    const ids = [];
    for (const section of chapter.sections) {
      if (section.blocks) {
        for (const b of section.blocks) if (b.blockType === 'task') ids.push(b.id);
      }
      if (section.tasks) {
        for (const t of section.tasks) ids.push(t.id);
      }
    }
    return ids;
  }

  function buildGrammarIndex(chapter) {
    const byId = {};
    const gramSection = chapter.sections.find(s => s.type === 'grammar');
    if (gramSection) {
      for (const rule of gramSection.rules) byId[rule.id] = rule;
    }
    return byId;
  }

  async function renderHome(container) {
    container.innerHTML = '';
    const hasContent = await ContentLoader.hasAnyContent();
    if (!hasContent) {
      container.appendChild(renderEmptyState());
      return;
    }
    const chapters = await ContentLoader.listChapters();
    const list = h('ul', { class: 'chapter-list' });
    for (const c of chapters) {
      const full = await ContentLoader.getChapter(c.num);
      const taskIds = collectTaskIds(full);
      const progress = AnswerStore.progressForTasks(taskIds);
      const a = h('a', { href: `#/c/${c.num}/s/0` }, [
        h('span', { class: 'chapter-num' }, String(c.num)),
        h('span', { class: 'chapter-title' }, c.title),
        h('span', { class: 'chapter-progress' }, `${progress.answered}/${progress.total} atsakyta`),
      ]);
      list.appendChild(h('li', {}, a));
    }
    container.appendChild(h('h1', { class: 'page-title' }, 'Skyriai'));
    container.appendChild(list);
  }

  function renderEmptyState() {
    return h('div', { class: 'empty-state card' }, [
      h('h2', {}, 'Turinys dar neįkeltas'),
      h('p', {}, 'Paspausk „Įkelti turinį“ viršuje ir pasirink turinio paketo .zip failą, kurį gavai atskirai (jis niekada nesaugomas GitHub).'),
    ]);
  }

  const SECTION_LABELS = {
    reading_listening: 'Skaitymo ir klausymo užduotys',
    vocabulary: 'Žodynas',
    grammar: 'Gramatika',
    tasks: null, // uses section.title directly
    leisure: 'Laisvalaikiui',
  };

  async function renderChapter(container, chapterNum, sectionIndex) {
    container.innerHTML = '';
    const chapter = await ContentLoader.getChapter(chapterNum);
    if (!chapter) {
      container.appendChild(h('p', {}, 'Šis skyrius dar neįkeltas.'));
      return;
    }
    const grammarIndex = buildGrammarIndex(chapter);

    container.appendChild(h('div', { class: 'breadcrumb' }, [h('a', { href: '#/' }, '← Skyriai')]));
    container.appendChild(h('h1', { class: 'page-title' }, `${chapter.chapter} skyrius. ${chapter.title}`));

    const nav = h('div', { class: 'section-nav' });
    chapter.sections.forEach((s, i) => {
      const label = s.title || SECTION_LABELS[s.type] || s.type;
      const link = h('a', { href: `#/c/${chapterNum}/s/${i}` }, label);
      if (i === sectionIndex) link.classList.add('active');
      nav.appendChild(link);
    });
    container.appendChild(nav);

    const section = chapter.sections[sectionIndex];
    if (!section) {
      container.appendChild(h('p', {}, 'Skyriaus dalis nerasta.'));
      return;
    }

    const ctx = {
      chapterNum: chapter.chapter,
      chapterTitle: chapter.title,
      sectionTitle: section.title || SECTION_LABELS[section.type] || section.type,
      grammarIndex,
    };

    const sectionEl = h('section', {});
    if (section.type === 'vocabulary') await renderVocabulary(sectionEl, section);
    else if (section.type === 'grammar') await renderGrammar(sectionEl, section);
    else await renderBlocksOrTasks(sectionEl, section, ctx);
    container.appendChild(sectionEl);
  }

  async function renderBlocksOrTasks(container, section, ctx) {
    if (section.blocks) {
      for (const block of section.blocks) {
        if (block.blockType === 'passage') container.appendChild(await renderPassage(block));
        else if (block.blockType === 'task') container.appendChild(await renderTaskBlock(block, ctx));
      }
    } else if (section.tasks) {
      for (const task of section.tasks) container.appendChild(await renderTaskBlock(task, ctx));
    }
  }

  async function renderPassage(passage) {
    const wrap = h('div', { class: 'card passage' });
    if (passage.sourcePage) wrap.appendChild(h('div', { class: 'source-page' }, `p. ${passage.sourcePage}`));
    if (passage.title) wrap.appendChild(h('div', { class: 'passage-title' }, passage.title));
    for (const p of passage.paragraphs) {
      if (p === '') wrap.appendChild(h('div', { style: 'height:8px' }));
      else wrap.appendChild(h('p', {}, p));
    }
    if (passage.images) {
      for (const img of passage.images) {
        const url = await ContentLoader.getImageUrl(img.file);
        if (!url) continue;
        const fig = h('figure', { class: 'passage-image' }, [h('img', { src: url, alt: img.caption || '' })]);
        if (img.caption) fig.appendChild(h('figcaption', {}, img.caption));
        wrap.appendChild(fig);
      }
    }
    if (passage.footnotes && passage.footnotes.length) {
      const fn = h('div', { class: 'footnotes' });
      passage.footnotes.forEach(f => fn.appendChild(h('div', {}, f)));
      wrap.appendChild(fn);
    }
    return wrap;
  }

  async function renderTaskBlock(task, ctx) {
    const wrap = h('div', { class: 'task-block', id: task.id });
    const header = h('div', { class: 'task-header' }, [
      task.number ? h('span', { class: 'task-number' }, `${task.number}.`) : null,
      h('span', { class: 'task-instruction' }, task.instruction || ''),
    ]);
    if (task.grammarHint && task.grammarHint.length) {
      const rule = ctx.grammarIndex[task.grammarHint[0]];
      if (rule) {
        header.appendChild(h('a', { class: 'grammar-hint-link', href: `#/c/${ctx.chapterNum}/s/2` }, `📖 ${rule.title}`));
      }
    }
    wrap.appendChild(header);
    wrap.appendChild(TaskWidgets.render(task));

    const footer = h('div', { class: 'task-footer' });
    const statusSelect = h('select', { class: 'status-select' });
    const statuses = [
      ['unanswered', 'Nepatikrinta'],
      ['checked', 'Patikrinta su Claude'],
      ['correct', 'Teisinga'],
      ['needs_review', 'Reikia peržiūrėti'],
    ];
    const currentStatus = AnswerStore.get(task.id).status || 'unanswered';
    statuses.forEach(([val, label]) => {
      const opt = h('option', { value: val }, label);
      if (val === currentStatus) opt.selected = true;
      statusSelect.appendChild(opt);
    });
    statusSelect.dataset.status = currentStatus;
    statusSelect.addEventListener('change', (e) => {
      AnswerStore.setStatus(task.id, e.target.value);
      statusSelect.dataset.status = e.target.value;
    });
    footer.appendChild(statusSelect);

    const copyBtn = h('button', { class: 'btn btn-small btn-secondary' }, 'Kopijuoti patikrinimui (Claude)');
    copyBtn.addEventListener('click', async () => {
      const rule = task.grammarHint && ctx.grammarIndex[task.grammarHint[0]];
      const grammarHintText = rule ? `${rule.title} ${(rule.lines || []).join(' ')}` : null;
      const hasImages = !!(task.images) || task.taskType === 'ordering';
      const ok = await CopyForCheck.copyTask(task, { ...ctx, grammarHintText, hasImages });
      copyBtn.textContent = ok ? 'Nukopijuota ✓' : 'Nepavyko kopijuoti';
      setTimeout(() => { copyBtn.textContent = 'Kopijuoti patikrinimui (Claude)'; }, 1800);
    });
    footer.appendChild(copyBtn);
    wrap.appendChild(footer);
    return wrap;
  }

  async function renderVocabulary(container, section) {
    const wrap = h('div', { class: 'card' });
    if (section.sourcePage) wrap.appendChild(h('div', { class: 'source-page' }, `p. ${section.sourcePage}`));
    for (const g of section.groups) {
      const list = h('ul', {}, g.items.map(w => h('li', {}, w)));
      wrap.appendChild(h('div', { class: 'vocab-group' }, [g.heading ? h('strong', {}, g.heading) : null, list]));
    }
    if (section.diagram) {
      if (section.diagram.image) {
        const url = await ContentLoader.getImageUrl(section.diagram.image);
        if (url) wrap.appendChild(h('img', { src: url, style: 'max-width:100%;border-radius:6px' }));
      }
      if (section.diagram.note) wrap.appendChild(h('div', { class: 'vocab-diagram-note' }, section.diagram.note));
    }
    container.appendChild(wrap);
  }

  async function renderGrammar(container, section) {
    for (const rule of section.rules) {
      const wrap = h('div', { class: 'card grammar-rule', id: rule.id });
      wrap.appendChild(h('div', { class: 'grammar-rule-title' }, `${rule.number}. ${rule.title}`));
      (rule.lines || []).forEach(l => wrap.appendChild(h('div', { class: 'line' }, l)));
      (rule.examples || []).forEach(ex => wrap.appendChild(h('div', { class: 'example' }, ex)));
      container.appendChild(wrap);
    }
  }

  return { renderHome, renderChapter, renderEmptyState };
})();
