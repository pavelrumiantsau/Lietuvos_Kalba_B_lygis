// Renders the input widget for each taskType, wires it to AnswerStore, and knows how
// to serialize a task back into plain text for the "copy for Claude" flow (see copy.js).
// render() is async because several task types lazily load images from IndexedDB.
const TaskWidgets = (() => {
  function h(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (v !== undefined && v !== null) node.setAttribute(k, v);
    }
    for (const c of [].concat(children)) {
      if (c == null) continue;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return node;
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  // Some chapters use richer item shapes ({number, text} / {letter, text} / {name}
  // / {label}) instead of plain strings for list entries. Coerce defensively so a
  // schema variant never crashes the renderer.
  function asText(v) {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'object') return v.text ?? v.name ?? v.label ?? v.sentence ?? JSON.stringify(v);
    return String(v);
  }
  function itemLabel(v, fallback) {
    if (v && typeof v === 'object' && (v.number != null || v.letter != null)) return v.number ?? v.letter;
    return fallback;
  }

  // Some exercises are a word-search grid or a small data chart rather than a list
  // of items. These are schema extensions (not every chapter has them) that can show
  // up on any taskType, so render them generically wherever present.
  function renderGrid(grid) {
    // Rows are either an array of single-letter cells, or a pre-spaced string
    // ("S V E I K I N A D O") — handle both without guessing wrong.
    const table = h('table', { class: 'fill-table', style: 'font-family:ui-monospace,monospace;text-align:center' });
    grid.forEach(row => {
      const cells = Array.isArray(row) ? row : String(row).trim().split(/\s+/);
      table.appendChild(h('tr', {}, cells.map(cell => h('td', { style: 'padding:2px 6px' }, String(cell)))));
    });
    return table;
  }
  function renderChartTable(title, rows) {
    if (!rows || !rows.length) return null;
    const cols = Object.keys(rows[0]);
    const table = h('table', { class: 'fill-table' });
    if (title) table.appendChild(h('caption', { style: 'text-align:left;font-weight:700;padding:4px 0' }, title));
    table.appendChild(h('tr', {}, cols.map(c => h('th', {}, c))));
    rows.forEach(r => table.appendChild(h('tr', {}, cols.map(c => h('td', {}, String(r[c]))))));
    return table;
  }
  function renderExtras(task) {
    const frag = document.createDocumentFragment();
    if (task.grid) frag.appendChild(renderGrid(task.grid));
    if (task.chart) {
      const c = task.chart;
      const t1 = renderChartTable(c.title1, c.data1);
      const t2 = renderChartTable(c.title2, c.data2);
      if (t1) frag.appendChild(t1);
      if (t2) frag.appendChild(t2);
      if (!t1 && !t2 && c.note) frag.appendChild(h('div', { class: 'q-text' }, c.note));
    }
    return frag;
  }

  async function renderTaskImages(images) {
    const frag = document.createDocumentFragment();
    for (const img of images || []) {
      const url = await ContentLoader.getImageUrl(img.file);
      if (!url) continue;
      const fig = h('figure', { class: 'passage-image' }, [h('img', { src: url, alt: img.caption || img.label || '' })]);
      if (img.caption || img.label) fig.appendChild(h('figcaption', {}, img.caption || img.label));
      frag.appendChild(fig);
    }
    return frag;
  }

  async function renderSourcePassages(task) {
    const frag = document.createDocumentFragment();
    for (const p of task.sourcePassages || []) {
      frag.appendChild(await PassageUI.renderPassageCard(p, { card: false }));
    }
    return frag;
  }

  // --- cloze: finish/complete sentences, or fill an inline blank -------------------------
  async function renderCloze(task) {
    const wrap = h('div', { class: 'cloze-wrap' });

    // Special case: lyrics/text intentionally omitted (copyright) — no `items` at all.
    if (!task.items) {
      if (task.songTitle) wrap.appendChild(h('div', { class: 'passage-title' }, task.songTitle));
      if (task.performer) wrap.appendChild(h('div', { class: 'q-text' }, task.performer));
      if (task.performerBio) wrap.appendChild(h('p', {}, task.performerBio));
      wrap.appendChild(h('div', { class: 'tf-given-badge', style: 'background:var(--warn-bg);color:var(--warn);display:inline-block' },
        task.sourcePage ? `Žodžiai nepateikti — žr. knygos p. ${task.sourcePage}` : 'Žodžiai nepateikti'));
      if (task.images) wrap.appendChild(await renderTaskImages(task.images));
      const saved = AnswerStore.get(task.id).value || '';
      const save = debounce((val) => AnswerStore.setValue(task.id, val), 300);
      const ta = h('textarea', { class: 'open-answer', rows: 4, placeholder: 'Klausydamas įrašyk praleistus žodžius čia (arba visą dainos tekstą, jei nori).', oninput: (e) => save(e.target.value) });
      ta.value = saved;
      wrap.appendChild(ta);
      return wrap;
    }

    const saved = AnswerStore.get(task.id).value || {};
    if (task.wordBank && task.wordBank.length) {
      wrap.appendChild(h('div', { class: 'wordbank' }, task.wordBank.map(w => h('span', { class: 'chip' }, w))));
    }
    task.items.forEach((item, i) => {
      const key = item.number != null ? String(item.number) : String(i);
      if (item.given) {
        wrap.appendChild(h('div', { class: 'cloze-item' }, [
          h('span', { class: 'prefix' }, item.text || item.prefix),
          h('span', { class: 'tf-given-badge' }, item.given),
        ]));
        return;
      }
      const save = debounce((val) => {
        const cur = { ...(AnswerStore.get(task.id).value || {}) };
        cur[key] = val;
        AnswerStore.setValue(task.id, cur);
      }, 300);
      const input = h('input', { type: 'text', value: saved[key] || '', oninput: (e) => save(e.target.value) });

      if (item.text && item.text.includes('___')) {
        const parts = item.text.split('___');
        const row = h('div', { class: 'cloze-item' }, [h('span', { class: 'prefix' }, parts[0])]);
        row.appendChild(input);
        if (parts[1]) row.appendChild(h('span', {}, parts[1]));
        wrap.appendChild(row);
      } else {
        wrap.appendChild(h('div', { class: 'cloze-item' }, [
          h('span', { class: 'prefix' }, item.prefix || item.text),
          input,
        ]));
      }
    });
    return wrap;
  }

  // --- open_questions: numbered Q&A, or quotes-to-react-to, or a bare open prompt --------
  async function renderOpenQuestions(task) {
    const saved = AnswerStore.get(task.id).value || {};
    const wrap = h('div', {});
    if (task.sourcePassages) wrap.appendChild(await renderSourcePassages(task));
    if (task.quotes) wrap.appendChild(PassageUI.renderQuotes(task.quotes));
    wrap.appendChild(renderExtras(task));

    if (task.questions && task.questions.length) {
      task.questions.forEach((q, i) => {
        const save = debounce((val) => {
          const cur = { ...(AnswerStore.get(task.id).value || {}) };
          cur[i] = val;
          AnswerStore.setValue(task.id, cur);
        }, 300);
        const ta = h('textarea', { rows: 3, oninput: (e) => save(e.target.value) });
        ta.value = saved[i] || '';
        wrap.appendChild(h('div', { class: 'question-item' }, [
          h('div', { class: 'q-text' }, `${i + 1}. ${q}`),
          ta,
        ]));
      });
    } else {
      // No fixed question list printed — a single open-response box.
      const savedStr = typeof saved === 'string' ? saved : '';
      const save = debounce((val) => AnswerStore.setValue(task.id, val), 300);
      const ta = h('textarea', { class: 'open-answer', rows: 5, oninput: (e) => save(e.target.value) });
      ta.value = savedStr;
      wrap.appendChild(ta);
    }
    return wrap;
  }

  // --- writing / speaking: free text, optionally with embedded source passages ----------
  async function renderOpenText(task) {
    const saved = AnswerStore.get(task.id).value || '';
    const save = debounce((val) => AnswerStore.setValue(task.id, val), 300);
    const wrap = h('div', {});
    if (task.sourcePassages) wrap.appendChild(await renderSourcePassages(task));
    wrap.appendChild(renderExtras(task));
    if (task.prompt && task.prompt !== task.instruction) wrap.appendChild(h('div', { class: 'q-text' }, task.prompt));
    if (task.wordBank && task.wordBank.length) {
      wrap.appendChild(h('div', { class: 'wordbank' }, task.wordBank.map(w => h('span', { class: 'chip' }, w))));
    }
    if (task.images) wrap.appendChild(await renderTaskImages(task.images));
    const ta = h('textarea', { class: 'open-answer', rows: 6, oninput: (e) => save(e.target.value) });
    ta.value = saved;
    wrap.appendChild(ta);
    return wrap;
  }

  // --- true_false: statements graded true/neteisingas, optional listening transcript ----
  function renderTrueFalse(task) {
    const saved = AnswerStore.get(task.id).value || {};
    const wrap = h('div', {});

    if (task.audio) {
      const box = h('div', { class: 'transcript-box' });
      box.hidden = true;
      const toggle = h('button', { class: 'btn btn-small transcript-toggle' }, 'Rodyti / slėpti tekstą (klausymo užduotis)');
      toggle.addEventListener('click', async () => {
        if (!box.dataset.loaded && task.transcriptRef) {
          const t = await ContentLoader.getTranscript(task.transcriptRef);
          if (t) {
            if (t.title) box.appendChild(h('div', { class: 'passage-title' }, t.title));
            (t.paragraphs || []).forEach(p => box.appendChild(h('p', {}, p)));
          } else {
            box.appendChild(h('p', {}, '(Teksto nepavyko rasti įkeltame turinyje.)'));
          }
          box.dataset.loaded = '1';
        }
        box.hidden = !box.hidden;
      });
      wrap.appendChild(toggle);
      wrap.appendChild(box);
    }

    const table = h('table', { class: 'tf-table' });
    table.appendChild(h('tr', {}, [h('th', {}, '#'), h('th', {}, 'Teiginys'), h('th', {}, 'Teisingas / neteisingas')]));
    task.statements.forEach((s) => {
      if (s.given) {
        table.appendChild(h('tr', {}, [
          h('td', {}, String(s.number)),
          h('td', {}, s.text),
          h('td', {}, h('span', { class: 'tf-given-badge' }, s.given === 'correct' ? 'Teisingas (pavyzdys)' : 'Neteisingas (pavyzdys)')),
        ]));
        return;
      }
      const name = `${task.id}-${s.number}`;
      const group = h('div', { class: 'tf-radio-group' });
      ['correct', 'incorrect'].forEach((val) => {
        const id = `${name}-${val}`;
        const radio = h('input', {
          type: 'radio', name, id, value: val,
          onchange: () => {
            const cur = { ...(AnswerStore.get(task.id).value || {}) };
            cur[s.number] = val;
            AnswerStore.setValue(task.id, cur);
          },
        });
        if (saved[s.number] === val) radio.checked = true;
        const label = h('label', { for: id }, val === 'correct' ? 'Teisingas' : 'Neteisingas');
        group.appendChild(radio);
        group.appendChild(label);
      });
      table.appendChild(h('tr', {}, [
        h('td', {}, String(s.number)),
        h('td', {}, s.text),
        h('td', {}, group),
      ]));
    });
    wrap.appendChild(table);
    return wrap;
  }

  // --- matching: pair left column with right column --------------------------------------
  function renderMatching(task) {
    // Some "matching" tasks in the book don't actually have a second column
    // (e.g. matching numbered illustrations described only in a note, or a
    // set of lettered options matched into blanks elsewhere) — those don't
    // fit the two-select-columns UI, so fall back to a listing + free answer.
    if (!task.right || !task.right.length) {
      const wrap = h('div', {});
      const items = task.left || [];
      const labels = task.leftLabels;
      const list = h('ul', {});
      items.forEach((raw, i) => {
        const label = labels ? labels[i] : itemLabel(raw, i + 1);
        list.appendChild(h('li', {}, `${label}. ${asText(raw)}`));
      });
      wrap.appendChild(list);
      if (task.note) wrap.appendChild(h('div', { class: 'source-page' }, task.note));
      if (task.given) wrap.appendChild(h('div', { class: 'tf-given-badge' }, `Pavyzdys: ${JSON.stringify(task.given)}`));
      const saved = AnswerStore.get(task.id).value || '';
      const save = debounce((val) => AnswerStore.setValue(task.id, val), 300);
      const ta = h('textarea', { class: 'open-answer', rows: 4, oninput: (e) => save(e.target.value) });
      ta.value = saved;
      wrap.appendChild(ta);
      return wrap;
    }

    const saved = AnswerStore.get(task.id).value || {};
    const given = task.given || {};
    const wrap = h('div', {});
    if (task.note) wrap.appendChild(h('div', { class: 'source-page' }, task.note));
    const inner = h('div', { class: 'matching-wrap' });
    const leftCol = h('div', { class: 'matching-col' });
    task.left.forEach((raw, i) => {
      const num = String(itemLabel(raw, i + 1));
      const text = asText(raw);
      if (given[num]) {
        leftCol.appendChild(h('div', { class: 'matching-item' }, [
          h('span', {}, `${num}. ${text}`),
          h('span', { class: 'tf-given-badge' }, given[num]),
        ]));
        return;
      }
      const select = h('select', {
        onchange: (e) => {
          const cur = { ...(AnswerStore.get(task.id).value || {}) };
          cur[i] = e.target.value;
          AnswerStore.setValue(task.id, cur);
        },
      });
      select.appendChild(h('option', { value: '' }, '—'));
      task.right.forEach((_, j) => {
        const letter = String.fromCharCode(65 + j);
        const opt = h('option', { value: letter }, letter);
        if (saved[i] === letter) opt.selected = true;
        select.appendChild(opt);
      });
      leftCol.appendChild(h('div', { class: 'matching-item' }, [
        h('span', {}, `${num}. ${text}`),
        select,
      ]));
    });
    const rightCol = h('div', { class: 'matching-col' });
    task.right.forEach((raw, j) => {
      const letter = itemLabel(raw, String.fromCharCode(65 + j));
      rightCol.appendChild(h('div', { class: 'matching-item' }, [
        h('span', { class: 'letter' }, String(letter)),
        h('span', {}, asText(raw)),
      ]));
    });
    inner.appendChild(leftCol);
    inner.appendChild(rightCol);
    wrap.appendChild(inner);
    return wrap;
  }

  // --- ordering: arrange items (possibly photo-illustrated) in heard/mentioned order -----
  async function renderOrdering(task) {
    const saved = AnswerStore.get(task.id).value || {};
    const wrap = h('div', {});
    if (task.transcriptRef) {
      const box = h('div', { class: 'transcript-box' });
      box.hidden = true;
      const toggle = h('button', { class: 'btn btn-small transcript-toggle' }, 'Rodyti / slėpti tekstą (klausymo užduotis)');
      toggle.addEventListener('click', async () => {
        if (!box.dataset.loaded) {
          const t = await ContentLoader.getTranscript(task.transcriptRef);
          if (t) {
            if (t.title) box.appendChild(h('div', { class: 'passage-title' }, t.title));
            (t.paragraphs || []).forEach(p => box.appendChild(h('p', {}, p)));
          }
          box.dataset.loaded = '1';
        }
        box.hidden = !box.hidden;
      });
      wrap.appendChild(toggle);
      wrap.appendChild(box);
    }
    const list = h('ul', { class: 'ordering-list' });
    const items = task.items || [];
    const isObjectItems = items.length && typeof items[0] === 'object';
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const text = isObjectItems ? `${item.label ? item.label + '. ' : ''}${item.name}` : item;
      const given = isObjectItems ? item.given : undefined;
      const li = h('li', { class: 'ordering-item' });
      if (isObjectItems && item.image) {
        const url = await ContentLoader.getImageUrl(item.image);
        if (url) li.appendChild(h('img', { src: url, style: 'width:48px;height:48px;object-fit:cover;border-radius:6px' }));
      }
      if (given != null) {
        li.appendChild(h('span', { class: 'tf-given-badge' }, `vieta ${given}`));
        li.appendChild(h('span', {}, text));
      } else {
        const select = h('select', {
          onchange: (e) => {
            const cur = { ...(AnswerStore.get(task.id).value || {}) };
            cur[i] = e.target.value;
            AnswerStore.setValue(task.id, cur);
          },
        });
        select.appendChild(h('option', { value: '' }, '—'));
        for (let n = 1; n <= items.length; n++) {
          const opt = h('option', { value: String(n) }, String(n));
          if (saved[i] === String(n)) opt.selected = true;
          select.appendChild(opt);
        }
        li.appendChild(select);
        li.appendChild(h('span', {}, text));
      }
      list.appendChild(li);
    }
    wrap.appendChild(list);
    return wrap;
  }

  // --- phrase_building: word bank + free text sentence construction ----------------------
  function renderPhraseBuilding(task) {
    const wrap = h('div', {});
    const cols = h('div', { class: 'wordbank-cols' });
    if (task.wordBankA) cols.appendChild(h('div', { class: 'wordbank' }, task.wordBankA.map(w => h('span', { class: 'chip' }, w))));
    if (task.wordBankB) cols.appendChild(h('div', { class: 'wordbank' }, task.wordBankB.map(w => h('span', { class: 'chip' }, w))));
    wrap.appendChild(cols);
    if (task.example) wrap.appendChild(h('div', { class: 'q-text' }, `Pavyzdys: ${task.example}`));
    const saved = AnswerStore.get(task.id).value || '';
    const save = debounce((val) => AnswerStore.setValue(task.id, val), 300);
    const ta = h('textarea', { class: 'open-answer', rows: 4, oninput: (e) => save(e.target.value) });
    ta.value = saved;
    wrap.appendChild(ta);
    return wrap;
  }

  // --- transform: either an inline blank, or a whole-sentence rewrite given a hint word --
  async function renderTransform(task) {
    if (!task.items) return renderFreeform(task); // mislabeled data safety net
    const saved = AnswerStore.get(task.id).value || {};
    const wrap = h('div', {});
    task.items.forEach((item, i) => {
      const key = item.number != null ? String(item.number) : String(i);
      const hint = item.hintWord || item.hint;
      if (item.given) {
        const row = h('div', { class: 'cloze-item' }, [
          h('span', { class: 'prefix' }, `${item.number}. ${item.sentence}`),
        ]);
        if (hint) row.appendChild(h('span', { class: 'tf-given-badge' }, hint));
        row.appendChild(h('span', { class: 'tf-given-badge' }, item.given));
        wrap.appendChild(row);
        return;
      }
      const save = debounce((val) => {
        const cur = { ...(AnswerStore.get(task.id).value || {}) };
        cur[key] = val;
        AnswerStore.setValue(task.id, cur);
      }, 300);

      if (item.sentence && item.sentence.includes('___')) {
        const parts = item.sentence.split('___');
        const input = h('input', { type: 'text', value: saved[key] || '', oninput: (e) => save(e.target.value) });
        const row = h('div', { class: 'cloze-item' }, [h('span', { class: 'prefix' }, `${item.number}. ${parts[0]}`)]);
        row.appendChild(input);
        if (parts[1]) row.appendChild(h('span', {}, parts[1]));
        if (hint) row.appendChild(h('span', { class: 'wordbank' }, h('span', { class: 'chip' }, hint)));
        wrap.appendChild(row);
      } else {
        // Whole-sentence rewrite using the hint word's participle/gerund form.
        const input = h('input', { type: 'text', value: saved[key] || '', oninput: (e) => save(e.target.value), style: 'width:100%;margin-top:4px' });
        const row = h('div', { class: 'question-item' }, [
          h('div', { class: 'q-text' }, `${item.number}. ${item.sentence}${hint ? ` (${hint})` : ''}`),
          input,
        ]);
        wrap.appendChild(row);
      }
    });
    return wrap;
  }

  // --- fill_table: one or more named tables with some blank cells -------------------------
  function renderOneTable(task, tableSpec, tableIdx) {
    const saved = AnswerStore.get(task.id).value || {};
    const table = h('table', { class: 'fill-table' });
    if (tableSpec.title) table.appendChild(h('caption', { style: 'text-align:left;font-weight:700;padding:4px 0' }, tableSpec.title));
    if (tableSpec.columns) table.appendChild(h('tr', {}, tableSpec.columns.map(c => h('th', {}, c))));
    tableSpec.rows.forEach((row, ri) => {
      const tr = h('tr', {});
      row.cells.forEach((cell, ci) => {
        if (cell === '') {
          const key = `${tableIdx}-${ri}-${ci}`;
          const input = h('input', {
            type: 'text', value: (saved[key] || ''),
            oninput: (e) => {
              const cur = { ...(AnswerStore.get(task.id).value || {}) };
              cur[key] = e.target.value;
              AnswerStore.setValue(task.id, cur);
            },
          });
          tr.appendChild(h('td', {}, input));
        } else {
          tr.appendChild(h('td', {}, cell));
        }
      });
      table.appendChild(tr);
    });
    return table;
  }

  function renderFillTable(task) {
    const wrap = h('div', {});
    if (task.note) wrap.appendChild(h('div', { class: 'source-page' }, task.note));
    const specs = task.tables || [{ columns: task.columns, rows: task.rows }];
    specs.forEach((spec, i) => wrap.appendChild(renderOneTable(task, spec, i)));
    return wrap;
  }

  async function renderFreeform(task) {
    const wrap = h('div', {});
    if (task.title) wrap.appendChild(h('div', { class: 'passage-title' }, task.title));
    if (task.attribution) wrap.appendChild(h('div', { class: 'source-page' }, task.attribution));
    if (task.abbreviations) wrap.appendChild(h('div', { class: 'source-page' }, task.abbreviations.join('; ')));
    if (task.summaryNotVerbatim) {
      wrap.appendChild(h('div', { class: 'tf-given-badge', style: 'background:var(--warn-bg);color:var(--warn)' },
        `Santrauka, ne originalus tekstas${task.sourcePage ? ` — originalą žr. knygos p. ${task.sourcePage}` : ''}`));
    }
    if (task.wordBank) wrap.appendChild(h('div', { class: 'wordbank' }, task.wordBank.map(w => h('span', { class: 'chip' }, w))));
    if (task.verbHints) wrap.appendChild(h('div', { class: 'wordbank' }, task.verbHints.map(w => h('span', { class: 'chip' }, w))));
    if (task.images) wrap.appendChild(await renderTaskImages(task.images));
    wrap.appendChild(renderExtras(task));
    wrap.appendChild(h('div', { class: 'q-text' }, task.raw || ''));
    const saved = AnswerStore.get(task.id).value || '';
    const save = debounce((val) => AnswerStore.setValue(task.id, val), 300);
    const ta = h('textarea', { class: 'open-answer', rows: 4, oninput: (e) => save(e.target.value) });
    ta.value = saved;
    wrap.appendChild(ta);
    return wrap;
  }

  const renderers = {
    cloze: renderCloze,
    open_questions: renderOpenQuestions,
    writing: renderOpenText,
    speaking: renderOpenText,
    true_false: renderTrueFalse,
    matching: renderMatching,
    ordering: renderOrdering,
    phrase_building: renderPhraseBuilding,
    transform: renderTransform,
    fill_table: renderFillTable,
    freeform: renderFreeform,
  };

  async function render(task) {
    const fn = renderers[task.taskType];
    if (!fn) {
      return h('div', { class: 'q-text' }, `(Nežinomas užduoties tipas: ${task.taskType})`);
    }
    return await fn(task);
  }

  return { render, h, debounce, renderTaskImages, renderSourcePassages, asText, itemLabel };
})();
