// Formats a task (original book content + the learner's current answers) as plain text,
// for copying to the clipboard and pasting into Claude (mobile or desktop) for manual
// verification. This app never talks to any AI API directly.
const CopyForCheck = (() => {
  function originalContentLines(task) {
    const lines = [];
    switch (task.taskType) {
      case 'cloze':
        task.items.forEach((item, i) => lines.push(`${i + 1}. ${item.prefix} .....`));
        break;
      case 'open_questions':
        task.questions.forEach((q, i) => lines.push(`${i + 1}. ${q}`));
        break;
      case 'writing':
      case 'speaking':
        if (task.prompt) lines.push(task.prompt);
        if (task.wordBank && task.wordBank.length) lines.push(`(Žodžiai: ${task.wordBank.join(', ')})`);
        break;
      case 'true_false':
        task.statements.forEach(s => lines.push(`${s.number}. ${s.text}${s.given ? '  [pavyzdys]' : ''}`));
        break;
      case 'matching':
        lines.push('Kairė:');
        task.left.forEach((t, i) => lines.push(`  ${i + 1}. ${t}`));
        lines.push('Dešinė:');
        task.right.forEach((t, j) => lines.push(`  ${String.fromCharCode(65 + j)}. ${t}`));
        break;
      case 'ordering':
        task.items.forEach((t, i) => lines.push(`${String.fromCharCode(65 + i)}. ${t}`));
        break;
      case 'phrase_building':
        if (task.wordBankA) lines.push(`Žodžiai A: ${task.wordBankA.join(', ')}`);
        if (task.wordBankB) lines.push(`Žodžiai B: ${task.wordBankB.join(', ')}`);
        if (task.example) lines.push(`Pavyzdys: ${task.example}`);
        break;
      case 'transform':
        task.sentences.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
        break;
      case 'fill_table':
        if (task.columns) lines.push(task.columns.join(' | '));
        task.rows.forEach(r => lines.push(r.cells.map(c => c === '' ? '_____' : c).join(' | ')));
        break;
      case 'freeform':
        lines.push(task.raw);
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
        task.items.forEach((item, i) => lines.push(`${i + 1}. ${item.prefix} ${(a && a[i]) || '(neatsakyta)'}`));
        break;
      case 'open_questions':
        task.questions.forEach((q, i) => lines.push(`${i + 1}. ${(a && a[i]) || '(neatsakyta)'}`));
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
        task.left.forEach((t, i) => lines.push(`${i + 1}. ${t} → ${(a && a[i]) || '(nepasirinkta)'}`));
        break;
      case 'ordering':
        task.items.forEach((t, i) => lines.push(`${String.fromCharCode(65 + i)}. ${t} → vieta ${(a && a[i]) || '(nepažymėta)'}`));
        break;
      case 'transform':
        task.sentences.forEach((s, i) => lines.push(`${i + 1}. ${(a && a[i]) || '(neatsakyta)'}`));
        break;
      case 'fill_table':
        task.rows.forEach((r, ri) => {
          r.cells.forEach((c, ci) => {
            if (c === '') lines.push(`(${ri + 1},${ci + 1}): ${(a && a[`${ri}-${ci}`]) || '(neatsakyta)'}`);
          });
        });
        break;
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
    if (task.taskType === 'ordering' || (ctx.hasImages)) {
      parts.push('(Pastaba: ši užduotis remiasi nuotraukomis / paveikslėliais, kurių tekste nėra — jei reikia, pridėk ekrano nuotrauką.)');
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
      // Fallback for browsers/contexts where clipboard API is blocked.
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
