/* 29N · Visor de programas electorales — sin dependencias */
(() => {
  'use strict';

  const D = window.DATOS;
  if (!D) {
    document.getElementById('app').innerHTML =
      '<p>No se encontró <code>datos.js</code>. Ejecuta <code>node scripts/build.mjs</code>.</p>';
    return;
  }

  // ---------- Utilidades ----------
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const store = {
    get(k, d) { try { const v = localStorage.getItem('29n:' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem('29n:' + k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } },
  };
  const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // ---------- Datos ----------
  const partidos = D.partidos;
  const temas = D.temas;
  const comparativas = D.comparativas || {};
  const P = Object.fromEntries(partidos.map((p) => [p.id, p]));
  const T = Object.fromEntries(temas.map((t) => [t.id, t]));
  const propuestas = partidos.flatMap((p) => p.propuestas.map((x) => ({ ...x, partido: p.id })));
  const PR = Object.fromEntries(propuestas.map((x) => [x.id, x]));
  const subNombre = (x) => T[x.tema]?.subtemas?.find((s) => s.id === x.subtema)?.nombre;

  const CONC = { alta: 'Concreta', media: 'Parcial', baja: 'Genérica' };
  const CONC_AYUDA = {
    alta: 'Incluye cifras, plazos o mecanismos concretos',
    media: 'Indica qué quiere hacer pero sin cifras o plazos',
    baja: 'Declaración de intenciones difícil de evaluar',
  };
  const TIPO = { nueva: 'Medida nueva', ampliacion: 'Amplía algo existente', reforma: 'Reforma', recorte: 'Reduce / baja', derogacion: 'Elimina / revierte' };
  const POST = { si: 'SÍ', no: 'NO', matiz: 'MATIZ', sin: '—' };

  // ---------- Estado ----------
  const state = {
    activos: store.get('activos', partidos.map((p) => p.id)).filter((id) => P[id]),
    votos: store.get('votos', {}),
    filtros: { q: '', tema: '', concrecion: '', voto: '' },
    bru: store.get('bru', { ciegas: true, temas: [], importante: false }),
    orden: store.get('orden', []),
    anterior: null,
  };
  if (!state.activos.length) state.activos = partidos.map((p) => p.id);
  // Orden aleatorio estable para la brújula
  {
    const set = new Set(state.orden);
    state.orden = state.orden.filter((id) => PR[id]).concat(shuffle(propuestas.map((x) => x.id).filter((id) => !set.has(id))));
    store.set('orden', state.orden);
  }

  const activos = () => partidos.filter((p) => state.activos.includes(p.id));
  const guardarVotos = () => store.set('votos', state.votos);

  // ---------- Componentes ----------
  const pbadge = (pid) => `<span class="pbadge" style="--c:${P[pid].color}">${esc(P[pid].siglas)}</span>`;
  const tagConc = (c) => c ? `<span class="tag ${c}" title="${esc(CONC_AYUDA[c])}">${CONC[c]}</span>` : '';
  const tagVoto = (id) => {
    const v = state.votos[id];
    if (!v) return '';
    const [cls, txt] = v.v > 0 ? ['voto-1', '👍'] : v.v < 0 ? ['voto-m1', '👎'] : ['voto0', '·'];
    return `<span class="tag ${cls}" title="Tu valoración">${txt}${v.w > 1 ? ' ★' : ''}</span>`;
  };

  function tarjeta(x, { partido = false, resumen = false } = {}) {
    return `<button class="card" data-id="${esc(x.id)}" style="--c:${P[x.partido].color}">
      <span class="card-m">${partido ? pbadge(x.partido) : ''}${x.breve ? '<span class="tag" title="Tema secundario, resumido">Breve</span>' : tagConc(x.concrecion)}${x.cifra ? `<span class="tag">${esc(x.cifra)}</span>` : ''}${tagVoto(x.id)}</span>
      <span class="card-t">${esc(x.titulo)}</span>
      ${resumen ? `<span class="card-r">${esc(x.resumen)}</span>` : ''}
    </button>`;
  }

  function toast(msg) {
    const t = $('#toast');
    t.innerHTML = msg;
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (t.hidden = true), 2600);
  }

  // ---------- Chips de partidos ----------
  function pintarChips() {
    $('#chips').innerHTML = `<span class="hint">Partidos:</span>` + partidos.map((p) =>
      `<button class="chip ${state.activos.includes(p.id) ? 'on' : ''}" data-p="${esc(p.id)}" style="--c:${p.color}" title="${esc(p.nombre)} — Mayús+clic para ver solo este">${esc(p.siglas)}</button>`
    ).join('');
  }
  $('#chips').addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    const id = b.dataset.p;
    if (e.shiftKey) state.activos = [id];
    else if (state.activos.includes(id)) { if (state.activos.length > 1) state.activos = state.activos.filter((x) => x !== id); }
    else state.activos = partidos.map((p) => p.id).filter((x) => x === id || state.activos.includes(x));
    store.set('activos', state.activos);
    pintarChips();
    render();
  });

  // ---------- Vista: Resumen ----------
  function vistaResumen() {
    const ps = activos();
    const cuenta = (pid, tid) => P[pid].propuestas.filter((x) => x.tema === tid).length;
    const max = Math.max(1, ...ps.flatMap((p) => temas.map((t) => cuenta(p.id, t.id))));

    const cards = ps.map((p) => {
      const principales = p.propuestas.filter((x) => !x.breve);
      const n = principales.length;
      const nb = p.propuestas.length - n;
      const c = { alta: 0, media: 0, baja: 0 };
      principales.forEach((x) => c[x.concrecion] !== undefined && c[x.concrecion]++);
      const pct = (k) => (n ? (c[k] / n) * 100 : 0);
      return `<div class="panel partido" style="--c:${p.color}">
        <h3><span>${esc(p.nombre)}</span>${pbadge(p.id)}</h3>
        <p class="small">${esc(p.resumen || '')}</p>
        ${p.ideas_fuerza?.length ? `<ul>${p.ideas_fuerza.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}
        <div class="barra" title="Grado de concreción de sus propuestas">
          <span style="width:${pct('alta')}%;background:var(--ok)"></span>
          <span style="width:${pct('media')}%;background:var(--mid)"></span>
          <span style="width:${pct('baja')}%;background:var(--ko)"></span>
        </div>
        <div class="small muted">${n} propuestas${nb ? ` + ${nb} breves` : ''} · ${Math.round(pct('alta'))}% concretas · ${Math.round(pct('baja'))}% genéricas</div>
      </div>`;
    }).join('');

    const filas = temas.map((t) => {
      const total = ps.reduce((s, p) => s + cuenta(p.id, t.id), 0);
      return `<tr><th>${t.icono || ''} ${esc(t.nombre)}</th>${ps.map((p) => {
        const n = cuenta(p.id, t.id);
        return `<td class="${n ? '' : 'cero'}" data-tema="${t.id}" style="--c:${p.color};--a:${Math.round((n / max) * 32 + 5)}%" title="${esc(p.siglas)} · ${esc(t.nombre)}: ${n} propuestas">${n || '—'}</td>`;
      }).join('')}<td class="total" data-tema="${t.id}">${total}</td></tr>`;
    }).join('');

    return `
      <h2>Resumen</h2>
      <p class="lead">Ideas fuerza de cada partido y cuánto peso da a cada tema. La barra de color indica qué parte de sus propuestas son
      <span class="tag alta">concretas</span> <span class="tag media">parciales</span> o <span class="tag baja">genéricas</span>.</p>
      <div class="partidos">${cards}</div>
      <h3>¿De qué habla cada partido?</h3>
      <p class="muted small">Número de propuestas por tema. Un hueco también es información: el partido no dice nada sobre ello. Haz clic en una celda para comparar ese tema.</p>
      <div class="panel heat-wrap"><table class="heat">
        <thead><tr><th></th>${ps.map((p) => `<th>${pbadge(p.id)}</th>`).join('')}<th class="muted">Total</th></tr></thead>
        <tbody>${filas}</tbody>
      </table></div>`;
  }

  // ---------- Vista: Comparar por tema ----------
  function vistaComparar(temaId) {
    const ps = activos();
    const ids = new Set(state.activos);
    const enTema = (tid) => propuestas.filter((x) => x.tema === tid && ids.has(x.partido));
    if (!T[temaId]) temaId = (temas.find((t) => enTema(t.id).length) || temas[0]).id;
    const t = T[temaId];
    const lista = enTema(t.id);

    const nav = temas.map((x) => {
      const n = enTema(x.id).length;
      return `<a href="#/comparar/${x.id}" title="${esc(x.nombre)}" class="${x.id === t.id ? 'on' : ''}"><span>${x.icono || ''} ${esc(x.nombre)}</span><span class="n">${n}</span></a>`;
    }).join('');

    // Claves del debate
    const comp = comparativas[t.id];
    let clave = '';
    if (comp) {
      const ejes = (comp.ejes || []).map((e) => `<tr><th>${esc(e.pregunta)}</th>${ps.map((p) => {
        const pos = e.posiciones?.[p.id];
        if (!pos) return `<td><span class="pos sin">—</span><span class="muted">Sin datos</span></td>`;
        return `<td><span class="pos ${pos.postura}">${POST[pos.postura] || ''}</span>${esc(pos.texto)}</td>`;
      }).join('')}</tr>`).join('');
      clave = `<div class="panel clave">
        <h3>Claves del debate</h3>
        <p>${esc(comp.resumen)}</p>
        ${ejes ? `<div class="ejes-wrap"><table class="ejes"><thead><tr><th>Pregunta</th>${ps.map((p) => `<th>${pbadge(p.id)}</th>`).join('')}</tr></thead><tbody>${ejes}</tbody></table></div>` : ''}
      </div>`;
    }

    // Matriz subtema × partido
    const subs = [...(t.subtemas || [])];
    const conocidos = new Set(subs.map((s) => s.id));
    if (lista.some((x) => !conocidos.has(x.subtema))) subs.push({ id: '__otros', nombre: 'Otras propuestas' });
    const subDe = (x) => (conocidos.has(x.subtema) ? x.subtema : '__otros');

    let matriz = `<div class="matriz" style="grid-template-columns:repeat(${ps.length}, minmax(150px, 1fr))">`;
    matriz += ps.map((p) => `<div class="col-h" style="--c:${p.color}">${esc(p.nombre)}</div>`).join('');
    for (const s of subs) {
      const enSub = lista.filter((x) => subDe(x) === s.id);
      if (!enSub.length) continue;
      matriz += `<div class="fila-h">${esc(s.nombre)}</div>`;
      matriz += ps.map((p) => {
        const xs = enSub.filter((x) => x.partido === p.id);
        return `<div class="celda">${xs.length ? xs.map((x) => tarjeta(x, { resumen: true })).join('') : '<div class="empty">No propone nada sobre esto</div>'}</div>`;
      }).join('');
    }
    matriz += '</div>';

    return `<div class="comparar">
      <nav class="temas-nav">${nav}</nav>
      <section>
        <h2>${t.icono || ''} ${esc(t.nombre)}</h2>
        <p class="lead">${esc(t.descripcion || '')}</p>
        ${clave}
        ${lista.length ? `<div class="matriz-wrap">${matriz}</div>` : '<p class="empty">Ninguno de los partidos seleccionados tiene propuestas en este tema.</p>'}
      </section>
    </div>`;
  }

  // ---------- Vista: Explorar ----------
  function vistaExplorar() {
    const f = state.filtros;
    const opt = (v, txt, sel) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(txt)}</option>`;
    setTimeout(pintarResultados);
    return `<h2>Explorar propuestas</h2>
      <div class="filtros">
        <input type="search" id="f-q" placeholder="Buscar: alquiler, IRPF, médicos…" value="${esc(f.q)}">
        <select id="f-tema">${opt('', 'Todos los temas', f.tema)}${temas.map((t) => opt(t.id, t.nombre, f.tema)).join('')}</select>
        <select id="f-conc">${opt('', 'Cualquier concreción', f.concrecion)}${Object.entries(CONC).map(([k, v]) => opt(k, v, f.concrecion)).join('')}</select>
        <select id="f-voto">${opt('', 'Todas', f.voto)}${opt('pend', 'Sin valorar', f.voto)}${opt('si', 'Me gustan', f.voto)}${opt('no', 'No me gustan', f.voto)}${opt('imp', 'Importantes ★', f.voto)}</select>
      </div>
      <div id="res"></div>`;
  }
  function pintarResultados() {
    const res = $('#res');
    if (!res) return;
    const f = state.filtros;
    const q = norm(f.q).split(/\s+/).filter(Boolean);
    const ids = new Set(state.activos);
    const xs = propuestas.filter((x) => {
      if (!ids.has(x.partido)) return false;
      if (f.tema && x.tema !== f.tema) return false;
      if (f.concrecion && x.concrecion !== f.concrecion) return false;
      const v = state.votos[x.id];
      if (f.voto === 'pend' && v) return false;
      if (f.voto === 'si' && !(v && v.v > 0)) return false;
      if (f.voto === 'no' && !(v && v.v < 0)) return false;
      if (f.voto === 'imp' && !(v && v.w > 1)) return false;
      if (q.length) {
        const hay = norm([x.titulo, x.resumen, x.cita, x.cifra, subNombre(x), T[x.tema]?.nombre, P[x.partido].siglas].join(' '));
        if (!q.every((w) => hay.includes(w))) return false;
      }
      return true;
    });
    if (!xs.length) { res.innerHTML = '<p class="empty">Ninguna propuesta coincide con los filtros.</p>'; return; }
    res.innerHTML = `<p class="muted small">${xs.length} propuestas</p>` + temas.map((t) => {
      const g = xs.filter((x) => x.tema === t.id);
      if (!g.length) return '';
      return `<div class="grupo-tema"><h3>${t.icono || ''} ${esc(t.nombre)} <span class="muted small">(${g.length})</span></h3>
        <div class="grid-cards">${g.map((x) => tarjeta(x, { partido: true, resumen: true })).join('')}</div></div>`;
    }).join('');
  }
  document.addEventListener('input', (e) => {
    const map = { 'f-q': 'q', 'f-tema': 'tema', 'f-conc': 'concrecion', 'f-voto': 'voto' };
    if (map[e.target.id]) { state.filtros[map[e.target.id]] = e.target.value; pintarResultados(); }
  });

  // ---------- Vista: Brújula ----------
  function colaBrujula() {
    const ids = new Set(state.activos);
    const ts = state.bru.temas;
    return state.orden.map((id) => PR[id]).filter((x) =>
      x && ids.has(x.partido) && !state.votos[x.id] && (!ts.length || ts.includes(x.tema)));
  }
  function afinidad(temaId) {
    return activos().map((p) => {
      let s = 0, w = 0, n = 0;
      for (const x of p.propuestas) {
        if (temaId && x.tema !== temaId) continue;
        const v = state.votos[x.id];
        if (!v) continue;
        s += v.v * v.w; w += v.w; n++;
      }
      return { p, n, pct: w ? Math.round(((s / w + 1) / 2) * 100) : null };
    });
  }

  function vistaBrujula() {
    const cola = colaBrujula();
    const x = cola[0];
    const ids = new Set(state.activos);
    const universo = propuestas.filter((y) => ids.has(y.partido) && (!state.bru.temas.length || state.bru.temas.includes(y.tema)));
    const hechas = universo.length - cola.length;
    const b = state.bru;

    let pregunta;
    if (!x) {
      pregunta = `<div class="panel pregunta"><h3>¡Has valorado todas las propuestas${b.temas.length ? ' de los temas elegidos' : ''}!</h3>
        <p class="muted">Revisa tus resultados a la derecha, o cambia los temas/partidos para seguir.</p></div>`;
    } else {
      const im = x.implicaciones || {};
      pregunta = `<div class="panel pregunta">
        <div class="card-m"><span class="tag">${T[x.tema]?.icono || ''} ${esc(T[x.tema]?.nombre)}${subNombre(x) ? ' · ' + esc(subNombre(x)) : ''}</span>
          ${b.ciegas ? '' : pbadge(x.partido)} ${tagConc(x.concrecion)}</div>
        <div class="titulo">${esc(x.titulo)}</div>
        <p>${esc(x.resumen)}</p>
        <details class="mas"><summary>Ver implicaciones</summary>
          <dl class="small">
            ${im.afecta_a ? `<dt><b>A quién afecta:</b></dt><dd>${esc(im.afecta_a)}</dd>` : ''}
            ${im.coste ? `<dt><b>Coste:</b></dt><dd>${esc(im.coste)}</dd>` : ''}
            ${im.viabilidad ? `<dt><b>Viabilidad:</b></dt><dd>${esc(im.viabilidad)}</dd>` : ''}
          </dl>
          ${prosContras(im)}
        </details>
        <div class="votar">
          <button class="si" data-voto="1" title="Tecla A">👍 De acuerdo</button>
          <button class="ne" data-voto="0" title="Tecla N">Me da igual</button>
          <button class="no" data-voto="-1" title="Tecla D">👎 En desacuerdo</button>
        </div>
        <div class="opciones">
          <label><input type="checkbox" id="b-imp" ${b.importante ? 'checked' : ''}> ★ Esto me importa mucho (cuenta doble)</label>
          <button class="btn" data-saltar title="Tecla S">Saltar</button>
        </div>
        <div class="progress"><span style="width:${universo.length ? (hechas / universo.length) * 100 : 0}%"></span></div>
        <div class="small muted">${hechas} de ${universo.length} valoradas · Atajos: A / N / D / S</div>
      </div>`;
    }

    const temaChecks = temas.filter((t) => universo.length || true).map((t) =>
      `<label class="small"><input type="checkbox" data-btema="${t.id}" ${b.temas.includes(t.id) ? 'checked' : ''}> ${esc(t.nombre)}</label>`).join(' ');

    const af = afinidad().sort((a, b2) => (b2.pct ?? -1) - (a.pct ?? -1));
    const algunVoto = af.some((a) => a.n);
    const resultados = algunVoto ? `<div class="afinidad">${af.map((a) =>
      `<div class="af-row" style="--c:${a.p.color}">${pbadge(a.p.id)}
        <div class="af-bar"><span style="width:${a.pct ?? 0}%"></span></div>
        <b title="${a.n} propuestas valoradas">${a.pct == null ? '—' : a.pct + '%'}</b></div>`).join('')}</div>
        <p class="small muted">Porcentaje de acuerdo con las propuestas de cada partido que has valorado (las marcadas ★ cuentan doble).
        Mide coincidencia con lo que proponen, no con lo que callan.</p>` :
      '<p class="muted">Valora algunas propuestas para ver tu afinidad con cada partido.</p>';

    const porTema = algunVoto ? (() => {
      const ps = activos();
      const filas = temas.map((t) => {
        const r = afinidad(t.id);
        if (!r.some((a) => a.n)) return '';
        return `<tr><td>${esc(t.nombre)}</td>${r.map((a) => `<td>${a.pct == null ? '<span class="muted">—</span>' : a.pct + '%'}</td>`).join('')}</tr>`;
      }).join('');
      return `<details class="mas" open><summary>Afinidad por tema</summary>
        <table class="tabla"><thead><tr><th></th>${ps.map((p) => `<th>${pbadge(p.id)}</th>`).join('')}</tr></thead><tbody>${filas}</tbody></table></details>`;
    })() : '';

    const nVotos = Object.keys(state.votos).length;
    return `<h2>Mi brújula</h2>
      <p class="lead">Valora propuestas sin saber de quién son y descubre con qué partido coincides más. Tus respuestas se guardan solo en este navegador.</p>
      <div class="brujula">
        <div>
          ${pregunta}
          <div class="panel" style="margin-top:14px">
            <label><input type="checkbox" id="b-ciegas" ${b.ciegas ? 'checked' : ''}> Modo a ciegas (ocultar el partido)</label>
            <details class="mas"><summary>Limitar a ciertos temas ${b.temas.length ? `(${b.temas.length})` : ''}</summary>
              <div style="display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:8px">${temaChecks}</div></details>
            ${state.anterior ? `<p class="small muted" style="margin-bottom:0">La anterior («${esc(PR[state.anterior].titulo)}») era de ${pbadge(PR[state.anterior].partido)}</p>` : ''}
          </div>
        </div>
        <div class="panel">
          <h3>Tu afinidad</h3>
          ${resultados}
          ${porTema}
          ${nVotos ? `<details class="mas"><summary>Tus ${nVotos} respuestas</summary>
            <div class="grid-cards" style="grid-template-columns:1fr;margin-top:8px">${Object.keys(state.votos).filter((id) => PR[id]).map((id) => tarjeta(PR[id], { partido: true })).join('')}</div>
            <p><button class="btn" id="b-reset">Borrar todas mis respuestas</button></p></details>` : ''}
        </div>
      </div>`;
  }

  function votar(id, v, w) {
    state.votos[id] = { v, w };
    guardarVotos();
  }

  document.addEventListener('click', (e) => {
    const vb = e.target.closest('.pregunta [data-voto]');
    if (vb) return accionBrujula(Number(vb.dataset.voto));
    if (e.target.closest('[data-saltar]')) return accionBrujula('saltar');
    if (e.target.id === 'b-reset') {
      if (e.target.dataset.confirm) {
        state.votos = {}; state.anterior = null; guardarVotos(); render(); toast('Respuestas borradas');
      } else {
        e.target.dataset.confirm = '1';
        e.target.textContent = '¿Seguro? Pulsa otra vez para borrar';
        e.target.classList.add('primary');
      }
    }
  });
  document.addEventListener('change', (e) => {
    if (e.target.id === 'b-ciegas') { state.bru.ciegas = e.target.checked; store.set('bru', state.bru); render(); }
    if (e.target.id === 'b-imp') { state.bru.importante = e.target.checked; store.set('bru', state.bru); }
    if (e.target.dataset.btema) {
      const t = e.target.dataset.btema;
      state.bru.temas = e.target.checked ? [...state.bru.temas, t] : state.bru.temas.filter((x) => x !== t);
      store.set('bru', state.bru); render();
    }
  });

  function accionBrujula(a) {
    const x = colaBrujula()[0];
    if (!x) return;
    if (a === 'saltar') {
      state.orden = state.orden.filter((id) => id !== x.id).concat(x.id);
      store.set('orden', state.orden);
    } else {
      votar(x.id, a, state.bru.importante ? 2 : 1);
      state.anterior = x.id;
      state.bru.importante = false;
      store.set('bru', state.bru);
    }
    render();
  }
  document.addEventListener('keydown', (e) => {
    if (vistaActual !== 'brujula' || $('#detalle').open || e.metaKey || e.ctrlKey || e.altKey) return;
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName) && e.target.type !== 'checkbox') return;
    const k = e.key.toLowerCase();
    const m = { a: 1, n: 0, d: -1, s: 'saltar' };
    if (k in m) { e.preventDefault(); accionBrujula(m[k]); }
  });

  // ---------- Detalle (modal) ----------
  function prosContras(im) {
    if (!im.a_favor?.length && !im.en_contra?.length) return '';
    const ul = (xs) => xs?.length ? `<ul>${xs.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : '<p class="empty">—</p>';
    return `<div class="prosc"><div class="pro"><h4>Argumentos a favor</h4>${ul(im.a_favor)}</div>
      <div class="con"><h4>Argumentos en contra</h4>${ul(im.en_contra)}</div></div>`;
  }

  function abrirDetalle(id) {
    const x = PR[id];
    if (!x) return;
    const p = P[x.partido];
    const im = x.implicaciones || {};
    const v = state.votos[id];
    const rel = propuestas.filter((y) => y.id !== id && y.tema === x.tema && y.partido !== x.partido && (x.subtema ? y.subtema === x.subtema : true));
    const dlg = $('#detalle');
    dlg.innerHTML = `<div class="det" style="--c:${p.color}">
      <div class="det-h">
        <div class="card-m">${pbadge(p.id)}<span class="tag">${T[x.tema]?.icono || ''} ${esc(T[x.tema]?.nombre)}${subNombre(x) ? ' · ' + esc(subNombre(x)) : ''}</span>
          ${tagConc(x.concrecion)}${x.tipo ? `<span class="tag">${esc(TIPO[x.tipo] || x.tipo)}</span>` : ''}</div>
        <button class="cerrar" data-cerrar aria-label="Cerrar">✕</button>
      </div>
      <h2>${esc(x.titulo)}</h2>
      <p>${esc(x.resumen)}</p>
      ${x.cifra ? `<p><b>Compromiso cuantificado:</b> ${esc(x.cifra)}</p>` : ''}
      ${x.cita ? `<blockquote>«${esc(x.cita)}»<cite>${esc(p.nombre)} · ${esc(p.fuente || 'programa')}${x.pagina ? `, pág. ${esc(x.pagina)} del PDF` : ''}</cite></blockquote>` : ''}
      ${x.breve ? '<p class="small muted">Ficha breve: tema secundario resumido para conocer la postura del partido, sin análisis de implicaciones.</p>' : '<h3>Implicaciones</h3>'}
      <dl>
        ${im.afecta_a ? `<dt>A quién afecta</dt><dd>${esc(im.afecta_a)}</dd>` : ''}
        ${im.coste ? `<dt>Coste y financiación</dt><dd>${esc(im.coste)}</dd>` : ''}
        ${im.viabilidad ? `<dt>Viabilidad</dt><dd>${esc(im.viabilidad)}</dd>` : ''}
        ${x.concrecion ? `<dt>Concreción</dt><dd>${CONC[x.concrecion]}: ${CONC_AYUDA[x.concrecion]}</dd>` : ''}
      </dl>
      ${prosContras(im)}
      <h3>¿Qué te parece?</h3>
      <div class="votar" data-id="${esc(id)}">
        <button class="si ${v?.v === 1 ? 'on' : ''}" data-dvoto="1">👍 De acuerdo</button>
        <button class="ne ${v?.v === 0 ? 'on' : ''}" data-dvoto="0">Me da igual</button>
        <button class="no ${v?.v === -1 ? 'on' : ''}" data-dvoto="-1">👎 En desacuerdo</button>
      </div>
      <div class="opciones">
        <label><input type="checkbox" id="d-imp" ${v?.w > 1 ? 'checked' : ''}> ★ Me importa mucho</label>
        ${v ? '<button class="btn" data-dborrar>Quitar valoración</button>' : ''}
      </div>
      <div class="relacionadas">
        <h3>Qué proponen los demás sobre ${esc(subNombre(x) || T[x.tema]?.nombre)}</h3>
        ${rel.length ? `<div class="grid-cards">${rel.map((y) => tarjeta(y, { partido: true, resumen: true })).join('')}</div>` : '<p class="empty">Ningún otro partido tiene propuestas sobre esto.</p>'}
      </div>
    </div>`;
    if (!dlg.open) dlg.showModal();
    dlg.scrollTop = 0;
  }

  const dlg = $('#detalle');
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg || e.target.closest('[data-cerrar]')) return dlg.close();
    const id = dlg.querySelector('.votar')?.dataset.id;
    const b = e.target.closest('[data-dvoto]');
    if (b) { votar(id, Number(b.dataset.dvoto), $('#d-imp').checked ? 2 : 1); abrirDetalle(id); render(); return; }
    if (e.target.closest('[data-dborrar]')) { delete state.votos[id]; guardarVotos(); abrirDetalle(id); render(); }
  });
  dlg.addEventListener('change', (e) => {
    if (e.target.id !== 'd-imp') return;
    const id = dlg.querySelector('.votar')?.dataset.id;
    if (state.votos[id]) { state.votos[id].w = e.target.checked ? 2 : 1; guardarVotos(); render(); }
  });

  // Abrir detalle desde cualquier tarjeta (incluidas las del modal)
  document.addEventListener('click', (e) => {
    const c = e.target.closest('.card[data-id]');
    if (c) abrirDetalle(c.dataset.id);
    const td = e.target.closest('table.heat td[data-tema]');
    if (td) location.hash = '#/comparar/' + td.dataset.tema;
  });

  // ---------- Router ----------
  let vistaActual = 'resumen';
  function render() {
    const [, vista = 'resumen', arg] = (location.hash || '#/resumen').split('/');
    vistaActual = vista;
    document.querySelectorAll('#tabs a').forEach((a) => a.classList.toggle('on', a.dataset.v === vista));
    const app = $('#app');
    const scroll = window.scrollY;
    app.innerHTML =
      vista === 'comparar' ? vistaComparar(arg) :
      vista === 'explorar' ? vistaExplorar() :
      vista === 'brujula' ? vistaBrujula() :
      vistaResumen();
    window.scrollTo(0, scroll);
  }
  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

  $('#aviso-demo').hidden = !D.demo;
  pintarChips();
  render();
})();
