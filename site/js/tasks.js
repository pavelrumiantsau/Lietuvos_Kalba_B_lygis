// Renders the input widget for each taskType, wires it to AnswerStore, and knows how
// to serialize a task back into plain text for the "copy for Claude" flow (see copy.js).
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

  // --- cloze: finish/complete sentences -------------------------------------------------
  function renderCloze(task) {
    const saved = AnswerStore.get(task.id).value || {};
    const wrap = h('div', { class: 'cloze-wrap' });
    task.items.forEach((item, i) => {
      const save = debounce((val) => {
        const cur = { ...(AnswerStore.get(task.id).value || {}) };
        cur[i] = val;
        AnswerStore.setValue(task.id, cur);
      }, 300);
      const input = h('input', {
        type: 'text', 'data-idx': i, value: saved[i] || '',
        oninput: (e) => save(e.target.value),
      });
      wrap.appendChild(h('div', { class: 'cloze-item' }, [
        h('span', { class: 'prefix' }, item.prefix),
        input,
      ]));
    });
    return wrap;
  }

  // --- open_questions / writing / speaking: free text -----------------------------------
  function renderOpenQuestions(task) {
    const saved = AnswerStore.get(task.id).value || {};
    const wrap = h('div', {});
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
    return wrap;
  }

  function renderOpenText(task) {
    const saved = AnswerStore.get(task.id).value || '';
    const save = debounce((val) => AnswerStore.setValue(task.id, val), 300);
    const ta = h('textarea', { class: 'open-answer', rows: 6, oninput: (e) => save(e.target.value) });
    ta.value = saved;
    const wrap = h('div', {});
    if (task.prompt) wrap.appendChild(h('div', { class: 'q-text' }, task.prompt));
    if (task.wordBank && task.wordBank.length) {
      wrap.appendChild(h('div', { class: 'wordbank' }, task.wordBank.map(w => h('span', { class: 'chip' }, w))));
    }
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
            t.paragraphs.forEach(p => box.appendChild(h('p', {}, p)));
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
    const saved = AnswerStore.get(task.id).value || {};
    const wrap = h('div', { class: 'matching-wrap' });
    const leftCol = h('div', { class: 'matching-col' });
    task.left.forEach((text, i) => {
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
        h('span', {}, `${i + 1}. ${text}`),
        select,
      ]));
    });
    const rightCol = h('div', { class: 'matching-col' });
    task.right.forEach((text, j) => {
      rightCol.appendChild(h('div', { class: 'matching-item' }, [
        h('span', { class: 'letter' }, String.fromCharCode(65 + j)),
        h('span', {}, text),
      ]));
    });
    wrap.appendChild(leftCol);
    wrap.appendChild(rightCol);
    return wrap;
  }

  // --- ordering: arrange items in heard/mentioned order -----------------------------------
  function renderOrdering(task) {
    const saved = AnswerStore.get(task.id).value || {};
    const wrap = h('ul', { class: 'ordering-list' });
    task.items.forEach((text, i) => {
      const select = h('select', {
        onchange: (e) => {
          const cur = { ...(AnswerStore.get(task.id).value || {}) };
          cur[i] = e.target.value;
          AnswerStore.setValue(task.id, cur);
        },
      });
      select.appendChild(h('option', { value: '' }, '—'));
      for (let n = 1; n <= task.items.length; n++) {
        const opt = h('option', { value: String(n) }, String(n));
        if (saved[i] === String(n)) opt.selected = true;
        select.appendChild(opt);
      }
      wrap.appendChild(h('li', { class: 'ordering-item' }, [select, h('span', {}, text)]));
    });
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

  // --- transform: sentence with a blank + parenthetical hint word ------------------------
  function renderTransform(task) {
    const saved = AnswerStore.get(task.id).value || {};
    const wrap = h('div', {});
    task.sentences.forEach((sentence, i) => {
      const parts = sentence.split('___');
      const input = h('input', {
        type: 'text', value: saved[i] || '',
        oninput: (e) => {
          const cur = { ...(AnswerStore.get(task.id).value || {}) };
          cur[i] = e.target.value;
          AnswerStore.setValue(task.id, cur);
        },
      });
      const row = h('div', { class: 'cloze-item' }, [h('span', { class: 'prefix' }, parts[0])]);
      row.appendChild(input);
      if (parts[1]) row.appendChild(h('span', {}, parts[1]));
      wrap.appendChild(row);
    });
    return wrap;
  }

  // --- fill_table: table with some blank cells --------------------------------------------
  function renderFillTable(task) {
    const saved = AnswerStore.get(task.id).value || {};
    const table = h('table', { class: 'fill-table' });
    if (task.columns) table.appendChild(h('tr', {}, task.columns.map(c => h('th', {}, c))));
    task.rows.forEach((row, ri) => {
      const tr = h('tr', {});
      row.cells.forEach((cell, ci) => {
        if (cell === '') {
          const key = `${ri}-${ci}`;
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

  function renderFreeform(task) {
    const wrap = h('div', {});
    wrap.appendChild(h('div', { class: 'q-text' }, task.raw));
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

  function render(task) {
    const fn = renderers[task.taskType];
    if (!fn) {
      const wrap = h('div', { class: 'q-text' }, `(Nežinomas užduoties tipas: ${task.taskType})`);
      return wrap;
    }
    return fn(task);
  }

  return { render, h, debounce };
})();
