// Formats a task (original book content + the learner's current answers) as plain text,
// for copying to the clipboard and pasting into Claude (mobile or desktop) for manual
// verification. This app never talks to any AI API directly.
const CopyForCheck = (() => {
  function itemKey(item, i) { return item.number != null ? String(item.number) : String(i); }

  function originalContentLines(task) {
    const lines = [];
    switch (task.taskType) {
      case 'cloze':
        if (!task.items) {
          if (task.songTitle) lines.push(`${task.songTitle}${task.performer ? ' — ' + task.performer : ''}`);
          lines.push(task.note || '(žodžiai nepateikti)');
          break;
        }
        if (task.wordBank) lines.push(`Žodžiai: ${task.wordBank.join(', ')}`);
        task.items.forEach((item, i) => {
          const label = item.number != null ? item.number : i + 1;
          const body = item.text || item.prefix;
          lines.push(`${label}. ${body}${item.given ? `  [pavyzdys: ${item.given}]` : ''}`);
        });
        break;
      case 'open_questions':
        if (task.quotes) task.quotes.forEach(q => lines.push(`„${q.text}“ — ${q.author}`));
        if (task.questions && task.questions.length) task.questions.forEach((q, i) => lines.push(`${i + 1}. ${q}`));
        if (task.sourcePassages) task.sourcePassages.forEach(p => lines.push(`(Susijęs tekstas: ${p.title || p.sourcePage}, p. ${p.sourcePage})`));
        break;
      case 'writing':
      case 'speaking':
        if (task.prompt && task.prompt !== task.instruction) lines.push(task.prompt);
        if (task.wordBank && task.wordBank.length) lines.push(`(Žodžiai: ${task.wordBank.join(', ')})`);
        if (task.sourcePassages) task.sourcePassages.forEach(p => lines.push(`(Susijęs tekstas: ${p.title || p.sourcePage}, p. ${p.sourcePage})`));
        break;
      case 'true_false':
        task.statements.forEach(s => lines.push(`${s.number}. ${s.text}${s.given ? '  [pavyzdys]' : ''}`));
        break;
      case 'matching':
        lines.push('Kairė:');
        task.left.forEach((t, i) => lines.push(`  ${i + 1}. ${t}${task.given && task.given[String(i + 1)] ? ` [pavyzdys: ${task.given[String(i + 1)]}]` : ''}`));
        lines.push('Dešinė:');
        task.right.forEach((t, j) => lines.push(`  ${String.fromCharCode(65 + j)}. ${t}`));
        break;
      case 'ordering': {
        const items = task.items || [];
        const isObj = items.length && typeof items[0] === 'object';
        items.forEach((it) => {
          if (isObj) lines.push(`${it.label}. ${it.name}${it.given ? ` [pavyzdys: vieta ${it.given}]` : ''}`);
          else lines.push(it);
        });
        break;
      }
      case 'phrase_building':
        if (task.wordBankA) lines.push(`Žodžiai A: ${task.wordBankA.join(', ')}`);
        if (task.wordBankB) lines.push(`Žodžiai B: ${task.wordBankB.join(', ')}`);
        if (task.example) lines.push(`Pavyzdys: ${task.example}`);
        break;
      case 'transform':
        task.items.forEach((item) => {
          const hint = item.hintWord || item.hint;
          lines.push(`${item.number}. ${item.sentence}${hint ? ` (${hint})` : ''}${item.given ? `  [pavyzdys: ${item.given}]` : ''}`);
        });
        break;
      case 'fill_table': {
        const specs = task.tables || [{ columns: task.columns, rows: task.rows }];
        specs.forEach(spec => {
          if (spec.title) lines.push(spec.title);
          if (spec.columns) lines.push(spec.columns.join(' | '));
          spec.rows.forEach(r => lines.push(r.cells.map(c => c === '' ? '_____' : c).join(' | ')));
        });
        break;
      }
      case 'freeform':
        if (task.title) lines.push(task.title);
        if (task.wordBank) lines.push(`Žodžiai: ${task.wordBank.join(', ')}`);
        if (task.verbHints) lines.push(`Veiksmažodžiai: ${task.verbHints.join(', ')}`);
        lines.push(task.raw || '');
        break;
      default:
        lines.push('(nežinomas užduoties tipas)');
    }
    return lines;
  }

  function answerLines(task) {
    const a = AnswerStore.get(task.id).value;
    const lines = [];
    if (a == null) return ['(neatsakyta)'];
    switch (task.taskType) {
      case 'cloze':
        if (!task.items) {
          lines.push(typeof a === 'string' && a.trim() ? a : '(neatsakyta)');
          break;
        }
        task.items.forEach((item, i) => {
          if (item.given) return;
          const key = itemKey(item, i);
          const label = item.number != null ? item.number : i + 1;
          lines.push(`${label}. ${(a && a[key]) || '(neatsakyta)'}`);
        });
        break;
      case 'open_questions':
        if (task.questions && task.questions.length) {
          task.questions.forEach((q, i) => lines.push(`${i + 1}. ${(a && a[i]) || '(neatsakyta)'}`));
        } else {
          lines.push(typeof a === 'string' && a.trim() ? a : '(neatsakyta)');
        }
        break;
      case 'writing':
      case 'speaking':
      case 'phrase_building':
      case 'freeform':
        lines.push(typeof a === 'string' && a.trim() ? a : '(neatsakyta)');
        break;
      case 'true_false':
        task.statements.forEach(s => {
          if (s.given) return;
          const v = a && a[s.number];
          lines.push(`${s.number}. ${v === 'correct' ? 'Teisingas' : v === 'incorrect' ? 'Neteisingas' : '(nepažymėta)'}`);
        });
        break;
      case 'matching':
        task.left.forEach((t, i) => {
          if (task.given && task.given[String(i + 1)]) return;
          lines.push(`${i + 1}. ${t} → ${(a && a[i]) || '(nepasirinkta)'}`);
        });
        break;
      case 'ordering': {
        const items = task.items || [];
        const isObj = items.length && typeof items[0] === 'object';
        items.forEach((it, i) => {
          if (isObj && it.given != null) return;
          const label = isObj ? `${it.label}. ${it.name}` : it;
          lines.push(`${label} → vieta ${(a && a[i]) || '(nepažymėta)'}`);
        });
        break;
      }
      case 'transform':
        task.items.forEach((item, i) => {
          if (item.given) return;
          const key = itemKey(item, i);
          lines.push(`${item.number}. ${(a && a[key]) || '(neatsakyta)'}`);
        });
        break;
      case 'fill_table': {
        const specs = task.tables || [{ columns: task.columns, rows: task.rows }];
        specs.forEach((spec, si) => {
          spec.rows.forEach((r, ri) => {
            r.cells.forEach((c, ci) => {
              if (c === '') lines.push(`(${si + 1},${ri + 1},${ci + 1}): ${(a && a[`${si}-${ri}-${ci}`]) || '(neatsakyta)'}`);
            });
          });
        });
        break;
      }
      default:
        lines.push(JSON.stringify(a));
    }
    return lines;
  }

  function buildText(task, ctx) {
    const parts = [];
    parts.push(`Patikrink mano atsakymus šiai lietuvių kalbos (B lygis) užduočiai iš vadovėlio "Nė dienos be lietuvių kalbos".`);
    parts.push(`${ctx.chapterNum} skyrius — ${ctx.chapterTitle} — ${ctx.sectionTitle}${task.sourcePage ? ` (p. ${task.sourcePage})` : ''}`);
    parts.push('');
    parts.push(`Užduotis${task.number ? ' Nr. ' + task.number : ''}: ${task.instruction || ''}`);
    if (ctx.grammarHintText) {
      parts.push(`Susijusi gramatikos taisyklė: ${ctx.grammarHintText}`);
    }
    parts.push('');
    parts.push('Originalus turinys:');
    parts.push(...originalContentLines(task));
    parts.push('');
    parts.push('Mano atsakymai:');
    parts.push(...answerLines(task));
    parts.push('');
    if (ctx.hasImages) {
      parts.push('(Pastaba: ši užduotis remiasi nuotraukomis / paveikslėliais, kurių šiame tekste nėra — jei reikia, pridėk ekrano nuotrauką.)');
    }
    if (task.summaryNotVerbatim) {
      parts.push('(Pastaba: susijęs skaitymo tekstas šioje programėlėje yra tik santrauka, ne originalus knygos tekstas.)');
    }
    parts.push('Patikrink, ar atsakymai teisingi. Jei klaidų yra, paaiškink kas negerai ir pasiūlyk pataisytą variantą.');
    return parts.join('\n');
  }

  async function copyTask(task, ctx) {
    const text = buildText(task, ctx);
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
      document.body.removeChild(ta);
      return ok;
    }
  }

  return { buildText, copyTask };
})();
