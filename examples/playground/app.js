/* global window, document, navigator, localStorage, location, setTimeout, clearTimeout */
(function () {
  'use strict';

  const K = window.KitSim;
  const NP = window.NutritionPack;
  const C = window.PG_CONTENT;

  // ------------------------------------------------------------------ utilidades
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (t) =>
    String(t).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  /** Markdown mínimo: `código` e **negrito**. */
  const md = (t) =>
    esc(t)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  const store = {
    get(k) {
      try {
        return localStorage.getItem(k);
      } catch {
        return null;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, v);
      } catch {
        /* sem storage: tudo bem */
      }
    },
  };

  // ------------------------------------------------------------------ realce de sintaxe (mínimo, sem libs)
  const KEYWORDS =
    'import|export|from|const|let|var|function|async|await|return|if|else|switch|case|break|try|catch|throw|new|type|interface|extends|class|readonly|instanceof|typeof|void|as|of|in|true|false|null|undefined|default|pnpm|Copy-Item';
  function highlight(code, lang) {
    const comment = lang === 'powershell' ? '#[^\\n]*' : '\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/';
    const re = new RegExp(
      `(${comment})|(\`(?:[^\`\\\\]|\\\\.)*\`|'(?:[^'\\\\\\n]|\\\\.)*'|"(?:[^"\\\\\\n]|\\\\.)*")|\\b(${KEYWORDS})\\b|(\\b\\d+(?:\\.\\d+)?\\b)|(\\b[A-Z][A-Za-z0-9_]*\\b)|(\\b[a-zA-Z_$][\\w$]*(?=\\())`,
      'g',
    );
    let out = '';
    let last = 0;
    let m;
    while ((m = re.exec(code))) {
      out += esc(code.slice(last, m.index));
      const cls = m[1]
        ? 't-com'
        : m[2]
          ? 't-str'
          : m[3]
            ? 't-kw'
            : m[4]
              ? 't-num'
              : m[5]
                ? 't-type'
                : 't-fn';
      out += `<span class="${cls}">${esc(m[0])}</span>`;
      last = m.index + m[0].length;
    }
    return out + esc(code.slice(last));
  }
  function codeBlock(code, lang, title) {
    return `<div class="codeblock"><div class="code-head"><span>${esc(title || lang || '')}</span><button type="button" class="copy-btn">Copiar</button></div><pre><code>${highlight(code, lang)}</code></pre></div>`;
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise((resolve, reject) => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        if (document.execCommand('copy')) resolve();
        else reject(new Error('copy falhou'));
      } catch (e) {
        reject(e);
      } finally {
        ta.remove();
      }
    });
  }
  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.copy-btn');
    if (!btn) return;
    const pre = btn.closest('.codeblock').querySelector('pre');
    copyText(pre.textContent).then(
      () => flash(btn, 'Copiado ✓', true),
      () => flash(btn, 'Selecione e copie', false),
    );
  });
  function flash(btn, label, good) {
    const old = btn.dataset.label || btn.textContent;
    btn.dataset.label = old;
    btn.textContent = label;
    btn.classList.toggle('done', good);
    setTimeout(() => {
      btn.textContent = old;
      btn.classList.remove('done');
    }, 1400);
  }

  // ------------------------------------------------------------------ tema
  const root = document.documentElement;
  const savedTheme = store.get('pg-theme');
  if (savedTheme === 'light' || savedTheme === 'dark') root.setAttribute('data-theme', savedTheme);
  $('#theme-toggle').addEventListener('click', () => {
    const cur =
      root.getAttribute('data-theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    store.set('pg-theme', next);
  });

  // ------------------------------------------------------------------ roteamento por hash
  const TABS = ['visao', 'passos', 'playground', 'api'];
  const inited = {};
  let currentTab = null;

  function route() {
    const [rawTab, sub] = location.hash.slice(1).split('/');
    const tab = TABS.includes(rawTab) ? rawTab : 'visao';
    TABS.forEach((t) => {
      $('#tab-' + t).hidden = t !== tab;
    });
    $$('#tabs a').forEach((a) => {
      if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    if (!inited[tab]) {
      inited[tab] = true;
      const init = {
        visao: initOverview,
        passos: initSteps,
        playground: initPlayground,
        api: initApi,
      };
      init[tab]();
    }
    if (tab === 'passos') selectStep(sub);
    if (tab !== currentTab) window.scrollTo(0, 0);
    currentTab = tab;
  }
  window.addEventListener('hashchange', route);

  // ------------------------------------------------------------------ visão geral
  function initOverview() {
    $('#rules').innerHTML = C.RULES.map(
      (r) =>
        `<article class="card"><span class="rule-id">${esc(r.id)}</span><h3>${esc(r.title)}</h3><p class="muted">${md(r.text)}</p></article>`,
    ).join('');
    $('#overview-install').outerHTML = codeBlock(
      C.STEPS[0].files[0].code,
      'powershell',
      'PowerShell',
    );
  }

  // ------------------------------------------------------------------ passo a passo
  let stepId = null;
  function initSteps() {
    $('#stepper').innerHTML = C.STEPS.map(
      (s) => `<button type="button" data-step="${s.id}">${esc(s.title)}</button>`,
    ).join('');
    $('#stepper').addEventListener('click', (ev) => {
      const b = ev.target.closest('button[data-step]');
      if (b) location.hash = `#passos/${b.dataset.step}`;
    });
    $('#step-panel').addEventListener('click', (ev) => {
      const t = ev.target.closest('[data-file]');
      if (t) {
        showFile(Number(t.dataset.file));
        return;
      }
      const g = ev.target.closest('[data-goto]');
      if (g) location.hash = `#passos/${g.dataset.goto}`;
    });
  }
  let stepFiles = [];
  function selectStep(id) {
    const idx = Math.max(
      0,
      C.STEPS.findIndex((s) => s.id === id),
    );
    const step = C.STEPS[idx];
    stepId = step.id;
    $$('#stepper button').forEach((b) => b.classList.toggle('active', b.dataset.step === stepId));
    stepFiles = step.files;
    const prev = C.STEPS[idx - 1];
    const next = C.STEPS[idx + 1];
    const table = step.table
      ? `<div class="table-wrap"><table><thead><tr>${step.table.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${step.table.rows
          .map(
            (r) =>
              `<tr>${r.map((c, i) => `<td>${i === 0 ? `<code>${esc(c)}</code>` : md(c)}</td>`).join('')}</tr>`,
          )
          .join('')}</tbody></table></div>`
      : '';
    const notes = step.notes
      ? `<ul class="notes">${step.notes.map((n) => `<li>${md(n)}</li>`).join('')}</ul>`
      : '';
    const tabs =
      step.files.length > 1
        ? `<div class="file-tabs">${step.files.map((f, i) => `<button type="button" data-file="${i}" class="${i === 0 ? 'active' : ''}">${esc(f.name)}</button>`).join('')}</div>`
        : '';
    $('#step-panel').innerHTML = `
      <p class="eyebrow">Passo ${idx + 1} de ${C.STEPS.length}</p>
      <h2>${esc(step.title)}</h2>
      <p>${md(step.summary)}</p>
      ${tabs}
      <div id="file-view">${fileHtml(step.files[0], step.files.length === 1)}</div>
      ${notes}${table}
      <div class="step-nav">
        ${prev ? `<button class="btn" type="button" data-goto="${prev.id}">← ${esc(prev.title)}</button>` : '<span></span>'}
        ${next ? `<button class="btn primary" type="button" data-goto="${next.id}">${esc(next.title)} →</button>` : '<a class="btn primary" href="#playground">Testar no playground →</a>'}
      </div>`;
  }
  function fileHtml(file, showTitle) {
    return codeBlock(
      file.code,
      file.lang,
      showTitle ? file.name : file.lang === 'ts' ? 'TypeScript' : file.name,
    );
  }
  function showFile(i) {
    $$('#step-panel .file-tabs button').forEach((b, j) => b.classList.toggle('active', i === j));
    $('#file-view').innerHTML = fileHtml(stepFiles[i], false);
  }

  // ------------------------------------------------------------------ playground
  const BASE_ALLERGENS = ['amendoim', 'ovo', 'leite', 'glúten'];
  let state = { ...NP.DEFAULTS };
  let resultTab = 'timeline';
  let lastRun = null;
  let timer = null;

  function initPlayground() {
    $('#presets').innerHTML = NP.PRESETS.map(
      (p) => `<button type="button" class="preset" data-preset="${p.id}">${esc(p.label)}</button>`,
    ).join('');
    $('#presets').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-preset]');
      if (b) applyPreset(b.dataset.preset);
    });
    const form = $('#pg-form');
    form.addEventListener('input', onFormChange);
    form.addEventListener('change', onFormChange);
    $('#f-allergens').addEventListener('click', (ev) => {
      const c = ev.target.closest('[data-allergen]');
      if (!c) return;
      const a = c.dataset.allergen;
      state.allergens = state.allergens.includes(a)
        ? state.allergens.filter((x) => x !== a)
        : [...state.allergens, a];
      userEdited();
      renderAllergens();
      schedule(0);
    });
    $('#f-allergen-new').addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter') return;
      ev.preventDefault();
      const v = ev.target.value.trim().toLowerCase();
      if (v && !state.allergens.includes(v)) state.allergens.push(v);
      ev.target.value = '';
      userEdited();
      renderAllergens();
      schedule(0);
    });
    $('#btn-run').addEventListener('click', () => schedule(0));
    $('#btn-reset').addEventListener('click', () => applyPreset('ok'));
    $('#result-tabs').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-rt]');
      if (!b) return;
      resultTab = b.dataset.rt;
      $$('#result-tabs button').forEach((x) => x.classList.toggle('active', x === b));
      renderResultBody();
    });
    applyPreset('ok');
  }

  function applyPreset(id) {
    const p = NP.PRESETS.find((x) => x.id === id);
    state = { ...NP.DEFAULTS, allergens: [...NP.DEFAULTS.allergens], ...p.patch };
    writeForm();
    $$('#presets .preset').forEach((b) => b.classList.toggle('active', b.dataset.preset === id));
    $('#preset-desc').innerHTML = md(p.desc);
    schedule(0);
  }
  function userEdited() {
    $$('#presets .preset').forEach((b) => b.classList.remove('active'));
    $('#preset-desc').textContent = 'Configuração personalizada.';
  }
  function schedule(ms) {
    clearTimeout(timer);
    timer = setTimeout(execute, ms);
  }
  function renderAllergens() {
    const all = [...BASE_ALLERGENS, ...state.allergens.filter((a) => !BASE_ALLERGENS.includes(a))];
    $('#f-allergens').innerHTML = all
      .map(
        (a) =>
          `<button type="button" class="chip ${state.allergens.includes(a) ? 'on' : ''}" data-allergen="${esc(a)}" aria-pressed="${state.allergens.includes(a)}">${esc(a)}</button>`,
      )
      .join('');
  }
  function writeForm() {
    $('#f-request').value = state.request;
    $('#f-script').value = state.script;
    $('#f-max').value = state.maxAttempts;
    $('#f-topk').value = state.topK;
    $('#f-rag').checked = state.rag;
    $('#f-index').value = state.index;
    $('#f-tracer').value = state.tracer;
    $('#f-pre').checked = state.preGuardrail;
    $('#f-post').checked = state.postGuardrail;
    $('#f-modify').value = state.postModify;
    $('#f-validator').checked = state.calorieValidator;
    $('#f-tol').value = state.tolerance;
    $('#f-tol-out').textContent = Math.round(state.tolerance * 100) + '%';
    renderAllergens();
  }
  function onFormChange(ev) {
    if (ev.target.id === 'f-allergen-new') return;
    const num = (v, lo, hi, d) => Math.min(hi, Math.max(lo, Math.round(Number(v)) || d));
    state.request = $('#f-request').value;
    state.script = $('#f-script').value;
    state.maxAttempts = num($('#f-max').value, 1, 6, 3);
    state.topK = num($('#f-topk').value, 1, 6, 3);
    state.rag = $('#f-rag').checked;
    state.index = $('#f-index').value;
    state.tracer = $('#f-tracer').value;
    state.preGuardrail = $('#f-pre').checked;
    state.postGuardrail = $('#f-post').checked;
    state.postModify = $('#f-modify').value;
    state.calorieValidator = $('#f-validator').checked;
    state.tolerance = Number($('#f-tol').value);
    $('#f-tol-out').textContent = Math.round(state.tolerance * 100) + '%';
    userEdited();
    schedule(ev.type === 'change' ? 0 : 250);
  }

  /** Roteiro do modelo: respostas separadas por linha `---`; `!error:` simula ProviderError. */
  function parseScript(text) {
    const t = text.replace(/\r\n/g, '\n').trim();
    if (!t) return [];
    return t
      .split(/\n-{3,}\n/)
      .map((seg) => seg.trim())
      .filter(Boolean)
      .map((seg) =>
        seg.startsWith('!error:')
          ? new K.ProviderError(seg.slice(7).trim() || 'falha simulada', 'fake-provider')
          : seg,
      );
  }

  async function execute() {
    const out = {
      events: [],
      calls: [],
      hits: [],
      ranking: null,
      lines: [],
      result: null,
      error: null,
      indexed: 0,
      query: '',
    };
    const input = { request: state.request, allergens: [...state.allergens] };
    const snapshot = { ...state, allergens: [...state.allergens] };
    const pack = NP.createNutritionPack(snapshot);
    try {
      const base = K.createFakeProvider(parseScript(snapshot.script));
      const provider = {
        id: base.id,
        async generate(req) {
          const rec = { req };
          out.calls.push(rec);
          try {
            rec.res = await base.generate(req);
            return rec.res;
          } catch (e) {
            rec.err = e;
            throw e;
          }
        },
      };

      let embeddings;
      let vstore;
      let mem;
      if (snapshot.rag) {
        embeddings = K.createFakeEmbeddings();
        mem = K.createMemoryStore({
          embeddingsId: embeddings.id,
          dimensions: embeddings.dimensions,
        });
        out.indexed = (await K.indexKnowledge(pack, { embeddings, store: mem })).indexed;
        const info =
          snapshot.index === 'ok'
            ? mem.info
            : snapshot.index === 'model'
              ? { embeddingsId: 'nomic-embed-text-v1', dimensions: embeddings.dimensions }
              : { embeddingsId: embeddings.id, dimensions: 64 };
        vstore = {
          info,
          upsert: mem.upsert,
          async query(v, o) {
            out.hits = await mem.query(v, o);
            return out.hits;
          },
        };
        out.query = pack.knowledge.toQuery(input);
        const [qv] = await embeddings.embed([out.query]);
        out.ranking = await mem.query(qv, { topK: 99 });
      }

      const lineSink = (line) => out.lines.push(line);
      const chosen =
        snapshot.tracer === 'console'
          ? K.createConsoleTracer({ log: lineSink })
          : K.createNoopTracer();
      const tracer = {
        event(name, data) {
          out.events.push({ name, data });
          chosen.event(name, data);
        },
      };
      const pipeline = K.createPipeline({
        provider,
        embeddings,
        store: vstore,
        tracer,
        maxAttempts: snapshot.maxAttempts,
        topK: snapshot.topK,
      });
      out.result = await pipeline.run(pack, input);
    } catch (e) {
      out.error = e;
    }
    // validação por tentativa (para exibir os motivos de cada rejeição)
    for (const c of out.calls) {
      if (!c.res) continue;
      const p = K.parseStructuredOutput(c.res.text, pack.outputSchema);
      c.errors = p.ok ? K.runValidators(p.data, pack.validators) : p.errors;
    }
    out.snapshot = snapshot;
    out.input = input;
    lastRun = out;
    renderResult();
  }

  // ---- renderização do resultado
  function renderResult() {
    const o = lastRun;
    const r = o.result;
    let cls;
    let label;
    let body;
    if (o.error) {
      cls = 'exception';
      label = `<span class="pill exc">exceção</span><span class="status">${esc(o.error.name || 'Error')}</span>`;
      const isProv = o.error instanceof K.ProviderError;
      body = `<p>${esc(o.error.message)}</p><p class="muted small">${
        isProv
          ? 'Falha de infraestrutura: propaga como exceção, <strong>não</strong> vira <code>invalid</code> e <strong>não</strong> consome tentativa (regra 11).'
          : 'Erro de configuração/uso: o pipeline não devolve um <code>RunResult</code> neste caso.'
      }</p>`;
    } else if (r.status === 'ok') {
      cls = 'ok';
      label = '<span class="pill ok">ok</span><span class="status">status: "ok"</span>';
      const d = r.data;
      body = `<p><strong>${esc(d.title)}</strong> · ${esc(d.calories)} kcal · validado pelo schema${o.snapshot.calorieValidator ? ' e pelo validator de calorias' : ''}.</p>
        <ul>${d.ingredients.map((i) => `<li>${esc(i.name)} — ${esc(i.grams)} g</li>`).join('')}</ul>
        <p class="muted small">Passos: ${d.steps.map((s) => esc(s)).join(' → ')}</p>`;
    } else if (r.status === 'blocked') {
      cls = 'blocked';
      const end = o.events.find((e) => e.name === 'pipeline.end');
      const stage = end && end.data.stage;
      label = '<span class="pill warn">blocked</span><span class="status">status: "blocked"</span>';
      body = `<p><strong>${esc(r.guardrailId)}</strong> (estágio <code>${esc(stage || '?')}</code>): ${esc(r.reason)}.</p>
        <p class="muted small">${stage === 'pre' ? `O guardrail <code>pre</code> vetou <strong>antes</strong> de chamar o modelo: ${o.calls.length} chamada(s) ao provider (regra 7).` : 'Sem conteúdo parcial: o resultado do modelo é descartado (regra 7).'}</p>`;
    } else {
      cls = 'invalid';
      label = '<span class="pill bad">invalid</span><span class="status">status: "invalid"</span>';
      const afterModify = o.events.some((e) => e.name === 'validate.failed' && e.data.afterModify);
      body = `<p>${afterModify ? 'Um guardrail <code>post</code> modificou a saída e a <strong>revalidação</strong> falhou (regra 8):' : `Nenhuma tentativa produziu uma saída válida (${r.attempts} tentativa(s)). Erros da última:`}</p>
        <ul>${r.errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>
        <p class="muted small">Nunca há dado parcial ou não validado (CR-03).</p>`;
    }
    const raw = o.error
      ? {
          thrown: o.error.name,
          message: o.error.message,
          ...(o.error.providerId ? { providerId: o.error.providerId } : {}),
        }
      : r;
    $('#result-card').innerHTML =
      `<div class="result ${cls}"><div class="result-head">${label}</div>${body}</div>
      <details class="raw"><summary>${o.error ? 'Exceção lançada por pipeline.run' : 'RunResult devolvido por pipeline.run'} (JSON)</summary>${codeBlock(JSON.stringify(raw, null, 2), 'json', 'JSON')}</details>`;

    const tokens = o.calls.reduce(
      (s, c) => (c.res ? [s[0] + c.res.usage.inputTokens, s[1] + c.res.usage.outputTokens] : s),
      [0, 0],
    );
    const retr = o.events.find((e) => e.name === 'retrieve.done');
    const attempts = o.events.filter((e) => e.name === 'generate.attempt').length;
    $('#metrics').innerHTML = [
      ['Chamadas ao provider', o.calls.length],
      ['Tentativas (generate)', attempts],
      ['Exemplos no prompt', retr ? retr.data.retrieved : '—'],
      ['Tokens in / out', `${tokens[0]} / ${tokens[1]}`],
      ['Eventos do tracer', o.events.length],
    ]
      .map(([k, v]) => `<div class="metric"><b>${esc(v)}</b><span>${esc(k)}</span></div>`)
      .join('');
    renderResultBody();
  }

  const EVENT_LABEL = {
    'pipeline.start': 'Início do pipeline',
    'guardrail.pre': 'Guardrails · pre',
    'retrieve.done': 'Retrieve (RAG)',
    'generate.attempt': 'Generate',
    'validate.failed': 'Validação falhou',
    'guardrail.post': 'Guardrails · post',
    'pipeline.end': 'Fim do pipeline',
  };
  function renderResultBody() {
    const el = $('#result-body');
    const o = lastRun;
    if (!o) return;
    el.innerHTML = {
      timeline: viewTimeline,
      prompts: viewPrompts,
      rag: viewRag,
      trace: viewTrace,
      code: viewCode,
    }[resultTab](o);
  }

  function tone(e) {
    const d = e.data;
    if (e.name === 'validate.failed') return 'bad';
    if (e.name.startsWith('guardrail')) return d.action === 'allow' ? 'ok' : 'warn';
    if (e.name === 'retrieve.done') return d.skipped ? 'skip' : 'ok';
    if (e.name === 'pipeline.end')
      return d.status === 'ok' ? 'ok' : d.status === 'blocked' ? 'warn' : 'bad';
    return '';
  }
  function pills(data) {
    return Object.entries(data)
      .map(
        ([k, v]) =>
          `<span class="pill neutral">${esc(k)}: ${esc(typeof v === 'object' ? JSON.stringify(v) : v)}</span>`,
      )
      .join('');
  }

  function viewTimeline(o) {
    const items = o.events.map((e) => {
      let extra = '';
      if (e.name === 'generate.attempt') {
        const c = o.calls[e.data.attempt - 1];
        if (c && c.res) {
          extra = `<details class="tl-extra"><summary>Resposta do modelo</summary><pre class="inline-pre">${esc(c.res.text)}</pre></details>`;
          if (c.errors && c.errors.length)
            extra += `<div class="tl-extra">Rejeitada:<ul>${c.errors.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`;
          else extra += '<div class="tl-extra">✓ passou no schema e nos validators.</div>';
        }
      }
      if (e.name === 'retrieve.done' && o.hits.length)
        extra = `<div class="tl-extra">${o.hits.map((h) => `<code>${esc(h.id)}</code> ${h.score.toFixed(2)}`).join(' · ')}</div>`;
      if (e.name === 'retrieve.done' && e.data.skipped)
        extra = '<div class="tl-extra">Sem embeddings/store: exemplos vazios (regra 10).</div>';
      if (e.name === 'guardrail.pre' && e.data.action === 'block' && o.result)
        extra = `<div class="tl-extra">${esc(o.result.reason)}</div>`;
      if (e.name === 'guardrail.post' && e.data.action === 'block' && o.result)
        extra = `<div class="tl-extra">${esc(o.result.reason)}</div>`;
      const title =
        EVENT_LABEL[e.name] +
        (e.name === 'generate.attempt' ? ` · tentativa ${e.data.attempt}` : '');
      return `<li class="tl-item ${tone(e)}"><span class="tl-title">${esc(title)}</span><span class="tl-name">${esc(e.name)}</span><div class="tl-data">${pills(e.data)}</div>${extra}</li>`;
    });
    if (o.error)
      items.push(
        `<li class="tl-item bad"><span class="tl-title">Exceção</span><span class="tl-name">${esc(o.error.name)}</span><div class="tl-extra">${esc(o.error.message)}</div></li>`,
      );
    return `<ol class="timeline">${items.join('')}</ol>`;
  }

  function viewPrompts(o) {
    if (!o.calls.length)
      return `<div class="empty">O provider <strong>não foi chamado</strong>${o.result && o.result.status === 'blocked' ? ' — o guardrail pre bloqueou antes (regra 7).' : '.'}</div>`;
    return o.calls
      .map((c, i) => {
        const examples = (c.req.prompt.match(/<exemplo /g) || []).length;
        const retry = c.req.prompt.includes('rejeitada');
        const verdict = c.err
          ? '<span class="pill exc">erro de infraestrutura</span>'
          : c.errors && c.errors.length
            ? '<span class="pill bad">resposta rejeitada</span>'
            : '<span class="pill ok">resposta válida</span>';
        return `<article class="call"><header>Chamada ${i + 1} ${verdict}
            <span class="pill neutral">${examples} exemplo(s)</span>${retry ? '<span class="pill neutral">com feedback de retry</span>' : ''}</header>
          <div class="part"><h4>system</h4><pre>${esc(c.req.system || '(vazio)')}</pre></div>
          <div class="part"><h4>prompt enviado</h4><pre>${esc(c.req.prompt)}</pre></div>
          <div class="part"><h4>${c.err ? 'exceção' : 'resposta do modelo'}</h4><pre>${esc(c.err ? `${c.err.name}: ${c.err.message}` : c.res.text)}</pre>
            ${c.errors && c.errors.length ? `<ul>${c.errors.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</div></article>`;
      })
      .join('');
  }

  function viewRag(o) {
    if (!o.snapshot.rag)
      return '<div class="empty">RAG desligado: o retrieve é pulado e o prompt segue <strong>sem exemplos</strong> (regra 10).</div>';
    const info = `<p class="muted small">Índice em memória: <strong>${o.indexed}</strong> itens · embeddings <code>fake-hash-bow-v1</code> · 512 dimensões. Consulta (<code>toQuery</code>): <code>${esc(o.query)}</code></p>`;
    if (o.error && /Índice incompatível/.test(o.error.message))
      return `${info}<div class="result exception"><p><strong>${esc(o.error.message)}</strong></p><p class="muted small">Trocar o modelo de embeddings muda o espaço vetorial: <code>assertCompatibleIndex</code> falha de forma explícita em vez de devolver exemplos errados (regras 16–17).</p></div>`;
    const ran = o.events.some((e) => e.name === 'retrieve.done');
    const used = new Set(o.hits.map((h) => h.id));
    const rows = (o.ranking || []).map((h) => {
      const isUsed = used.has(h.id);
      return `<div class="hit ${isUsed ? 'used' : ''}"><span class="rid">${esc(h.id)}</span><span class="txt">${esc(h.payload.text)} ${isUsed ? '<span class="pill ok">no prompt</span>' : ''}</span>
        <span class="bar-wrap"><div class="bar"><i style="width:${Math.max(2, Math.round(h.score * 100))}%"></i></div><div class="score">cos = ${h.score.toFixed(3)}</div></span></div>`;
    });
    return `${info}${ran ? '' : '<p class="muted small">⚠ O retrieve não chegou a rodar neste cenário; ranking abaixo é só ilustrativo.</p>'}${rows.join('')}`;
  }

  function viewTrace(o) {
    const leak = o.events.some((e) =>
      Object.keys(e.data).some((k) =>
        ['prompt', 'text', 'output', 'response', 'system', 'input'].includes(k),
      ),
    );
    const check = `<p class="muted small">${leak ? '✗ algum evento carrega conteúdo' : '✓ Nenhum evento contém prompt ou resposta (regra 12 / CR-04): só nomes, contagens e latências.'}</p>`;
    if (o.snapshot.tracer === 'noop')
      return `${check}<div class="empty">Tracer <code>createNoopTracer()</code>: nada é escrito. A linha do tempo ao lado usa um coletor interno do playground.</div>`;
    return `${check}${codeBlock(o.lines.join('\n') || '(sem eventos)', 'json', 'createConsoleTracer → uma linha JSON por evento')}`;
  }

  function viewCode(o) {
    const s = o.snapshot;
    const deps = ['provider'];
    if (s.rag) deps.push('embeddings', 'store');
    if (s.tracer === 'console') deps.push('tracer');
    deps.push(`maxAttempts: ${s.maxAttempts}`, `topK: ${s.topK}`);
    const guards = [
      s.preGuardrail && 'allergenInRequest',
      s.postGuardrail && 'allergenInRecipe',
      s.postModify !== 'none' && 'addDisclaimer',
    ].filter(Boolean);
    const q = (t) => `'${t.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
    const code = `// Equivalente à configuração atual do playground (veja o passo a passo para definir cada peça).
const nutritionPack = definePack<NutritionInput, NutritionOutput>({
  id: 'nutrition',
  version: '0.1.0',
  prompts: { /* ... */ },
  outputSchema: nutritionOutputSchema,
  validators: [${s.calorieValidator ? `caloriesMatchTable /* tolerância ${Math.round(s.tolerance * 100)}% */` : ''}],
  guardrails: [${guards.join(', ')}],
  knowledge: { items: RECIPES, toQuery: (input) => input.request },
});

const pipeline = createPipeline({ ${deps.join(', ')} });

const result = await pipeline.run(nutritionPack, {
  request: ${q(o.input.request)},
  allergens: [${o.input.allergens.map(q).join(', ')}],
});`;
    return `${codeBlock(code, 'ts', 'TypeScript')}<p class="muted small">No kit real, o <code>provider</code> seria <code>createOllamaProvider</code> ou <code>createGeminiProvider</code>; aqui ele é o roteiro que você escreveu.</p>`;
  }

  // ------------------------------------------------------------------ referência da API
  const apiState = { q: '', sub: 'all' };
  function initApi() {
    const subs = C.API.map((g) => g.subpath);
    $('#api-filter').innerHTML = ['all', ...subs]
      .map(
        (s) =>
          `<button type="button" class="chip ${s === 'all' ? 'on' : ''}" data-sub="${esc(s)}">${s === 'all' ? 'Todos' : esc(s)}</button>`,
      )
      .join('');
    $('#api-filter').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-sub]');
      if (!b) return;
      apiState.sub = b.dataset.sub;
      $$('#api-filter .chip').forEach((c) => c.classList.toggle('on', c === b));
      renderApi();
    });
    $('#api-search').addEventListener('input', (ev) => {
      apiState.q = ev.target.value.trim().toLowerCase();
      renderApi();
    });
    renderApi();
  }
  function apiItemHtml(it, open) {
    const params = it.params
      ? `<dt>Parâmetros</dt><dd><div class="table-wrap"><table><thead><tr><th>Nome</th><th>Tipo</th><th>Descrição</th></tr></thead><tbody>${it.params
          .map(
            (p) =>
              `<tr><td><code>${esc(p.name)}${p.optional ? '?' : ''}</code></td><td><code>${esc(p.type)}</code></td><td>${md(p.desc)}</td></tr>`,
          )
          .join('')}</tbody></table></div></dd>`
      : '';
    return `<details class="api-item" ${open ? 'open' : ''}>
      <summary><span class="kind ${esc(it.kind)}">${esc(it.kind)}</span><span class="api-name">${esc(it.name)}</span>
        ${it.kind === 'function' || it.kind === 'class' ? '<span class="pill neutral" title="Assinatura definida; a implementação ainda é um esqueleto (throw new Error(\'not implemented\'))">implementação pendente</span>' : ''}
        <span class="api-sum">${md(it.summary)}</span></summary>
      <div class="api-body">
        ${codeBlock(it.signature, 'ts', 'TypeScript')}
        <dl>${params}
          ${it.returns ? `<dt>Retorna</dt><dd>${md(it.returns)}</dd>` : ''}
          ${it.throws ? `<dt>Lança</dt><dd>${md(it.throws)}</dd>` : ''}
          ${it.rules ? `<dt>ADR / regras</dt><dd>${esc(it.rules)}</dd>` : ''}
          ${it.source ? `<dt>Origem</dt><dd><code>${esc(it.source)}</code></dd>` : ''}
        </dl></div></details>`;
  }
  function renderApi() {
    const { q, sub } = apiState;
    let total = 0;
    const html = C.API.filter((g) => sub === 'all' || g.subpath === sub)
      .map((g) => {
        const items = g.items.filter(
          (it) =>
            !q || `${it.name} ${it.summary} ${it.signature} ${it.kind}`.toLowerCase().includes(q),
        );
        total += items.length;
        if (!items.length) return '';
        return `<section class="api-group"><h2>${esc(g.subpath)}</h2>${items.map((it) => apiItemHtml(it, !!q && items.length <= 6)).join('')}</section>`;
      })
      .join('');
    $('#api-list').innerHTML = html || '<div class="empty">Nada encontrado para essa busca.</div>';
    $('#api-count').textContent =
      `${total} item(ns) em ${sub === 'all' ? C.API.length + ' subpaths' : sub}`;
  }

  // ------------------------------------------------------------------ início
  route();
})();
