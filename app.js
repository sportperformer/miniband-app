(function () {
  'use strict';

  const STORAGE_KEY = 'miniband-status-v1';

  const PARTIA_LABELS = { Gorna: 'Górna', Dolna: 'Dolna', Core: 'Core', 'Cale cialo': 'Całe ciało' };
  const MIEJSCE_LABELS = { Dowolnie: 'Dowolnie', Silownia: 'Siłownia' };

  const state = {
    partia: 'all',
    miejsce: 'all',
    status: 'all',
    search: ''
  };

  const els = {
    list: document.getElementById('list'),
    emptyState: document.getElementById('emptyState'),
    searchInput: document.getElementById('searchInput'),
    partiaChips: document.getElementById('partiaChips'),
    miejsceChips: document.getElementById('miejsceChips'),
    statusChips: document.querySelector('[data-group="status"]'),
    progressCount: document.getElementById('progressCount'),
    loopFill: document.getElementById('loopFillEl'),
    exportBtn: document.getElementById('exportBtn'),
    importInput: document.getElementById('importInput')
  };

  // ---------- Persistence ----------

  function loadDoneMap() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveDoneMap(map) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch (e) {
      /* localStorage niedostepny - stan nie zostanie zachowany */
    }
  }

  function applyStoredState() {
    const doneMap = loadDoneMap();
    let changed = false;
    EXERCISES.forEach((ex) => {
      if (Object.prototype.hasOwnProperty.call(doneMap, ex.id)) {
        ex.done = !!doneMap[ex.id];
      } else {
        doneMap[ex.id] = ex.done;
        changed = true;
      }
    });
    if (changed) saveDoneMap(doneMap);
  }

  function persistOne(id, done) {
    const map = loadDoneMap();
    map[id] = done;
    saveDoneMap(map);
  }

  // ---------- Chips (dynamiczne, wg danych) ----------

  function buildDynamicChips(container, values, labels, group) {
    const unique = [...new Set(values)];
    unique.forEach((val) => {
      const btn = document.createElement('button');
      btn.className = 'chip';
      btn.dataset.value = val;
      btn.textContent = labels[val] || val;
      container.appendChild(btn);
    });
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('.chip');
      if (!btn) return;
      container.querySelectorAll('.chip').forEach((c) => c.classList.remove('is-active'));
      btn.classList.add('is-active');
      state[group] = btn.dataset.value;
      render();
    });
  }

  function initChips() {
    buildDynamicChips(els.partiaChips, EXERCISES.map((e) => e.partia), PARTIA_LABELS, 'partia');
    buildDynamicChips(els.miejsceChips, EXERCISES.map((e) => e.miejsce), MIEJSCE_LABELS, 'miejsce');
    els.statusChips.addEventListener('click', (e) => {
      const btn = e.target.closest('.chip');
      if (!btn) return;
      els.statusChips.querySelectorAll('.chip').forEach((c) => c.classList.remove('is-active'));
      btn.classList.add('is-active');
      state.status = btn.dataset.value;
      render();
    });
  }

  // ---------- Filtering ----------

  function getFiltered() {
    const q = state.search.trim().toLowerCase();
    return EXERCISES.filter((ex) => {
      if (state.partia !== 'all' && ex.partia !== state.partia) return false;
      if (state.miejsce !== 'all' && ex.miejsce !== state.miejsce) return false;
      if (state.status === 'todo' && ex.done) return false;
      if (state.status === 'done' && !ex.done) return false;
      if (q && !ex.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }

  // ---------- Card rendering ----------

  const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="#121316" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>';
  const CHEVRON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';

  function miejsceTagClass(miejsce) {
    return miejsce === 'Silownia' ? 'tag-silownia' : 'tag-dowolnie';
  }

  function buildPanelContent(ex) {
    if (ex.isYoutube && ex.videoId) {
      return {
        type: 'youtube',
        html: '<div class="video-frame"></div><p class="offline-note">Podgląd wymaga połączenia z internetem</p>'
      };
    }
    if (ex.link) {
      return {
        type: 'link',
        html: '<a class="external-link-btn" href="' + ex.link + '" target="_blank" rel="noopener">Otwórz materiał referencyjny ↗</a>'
      };
    }
    return {
      type: 'none',
      html: '<div class="no-ref">Brak materiału referencyjnego</div>'
    };
  }

  function renderCard(ex) {
    const card = document.createElement('article');
    card.className = 'card-wrap';
    card.dataset.id = ex.id;

    const row = document.createElement('div');
    row.className = 'card';
    row.dataset.done = ex.done ? 'true' : 'false';

    row.innerHTML =
      '<button class="check-btn" aria-label="Oznacz jako nagrane">' +
        '<span class="check-circle">' + CHECK_SVG + '</span>' +
      '</button>' +
      '<button class="card-main">' +
        '<div class="card-top">' +
          '<span class="lp">#' + ex.id + '</span>' +
          '<span class="tag ' + miejsceTagClass(ex.miejsce) + '">' + (MIEJSCE_LABELS[ex.miejsce] || ex.miejsce) + '</span>' +
        '</div>' +
        '<h3 class="name">' + escapeHtml(ex.name) + '</h3>' +
      '</button>' +
      '<button class="expand-btn" aria-label="Pokaż wzorzec">' + CHEVRON_SVG + '</button>';

    const panelWrap = document.createElement('div');
    panelWrap.className = 'card-panel';
    panelWrap.hidden = true;

    const inner = document.createElement('div');
    inner.className = 'panel-inner';
    panelWrap.appendChild(inner);

    let expanded = false;
    const panelData = buildPanelContent(ex);

    function toggleExpand() {
      expanded = !expanded;
      row.classList.toggle('is-expanded', expanded);
      panelWrap.hidden = !expanded;
      if (expanded) {
        inner.innerHTML = panelData.html;
        if (panelData.type === 'youtube') {
          const frame = inner.querySelector('.video-frame');
          const iframe = document.createElement('iframe');
          iframe.src = 'https://www.youtube-nocookie.com/embed/' + ex.videoId + '?start=' + (ex.start || 0) + '&rel=0';
          iframe.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture';
          iframe.allowFullscreen = true;
          iframe.loading = 'lazy';
          frame.appendChild(iframe);
        }
      } else {
        inner.innerHTML = '';
      }
    }

    row.querySelector('.card-main').addEventListener('click', toggleExpand);
    row.querySelector('.expand-btn').addEventListener('click', toggleExpand);

    row.querySelector('.check-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      ex.done = !ex.done;
      row.dataset.done = ex.done ? 'true' : 'false';
      persistOne(ex.id, ex.done);
      updateProgress();
      if (state.status !== 'all') render();
    });

    card.appendChild(row);
    card.appendChild(panelWrap);
    return card;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function render() {
    const filtered = getFiltered();
    els.list.innerHTML = '';
    if (filtered.length === 0) {
      els.emptyState.hidden = false;
    } else {
      els.emptyState.hidden = true;
      const frag = document.createDocumentFragment();
      filtered.forEach((ex) => frag.appendChild(renderCard(ex)));
      els.list.appendChild(frag);
    }
    updateProgress();
  }

  // ---------- Progress loop ----------

  function updateProgress() {
    const total = EXERCISES.length;
    const done = EXERCISES.filter((e) => e.done).length;
    els.progressCount.textContent = done + ' / ' + total;

    const len = els.loopFill.getTotalLength();
    const pct = total ? done / total : 0;
    els.loopFill.style.strokeDasharray = len;
    els.loopFill.style.strokeDashoffset = len * (1 - pct);

    if (pct >= 1 && total > 0) {
      els.loopFill.style.stroke = 'var(--success)';
    } else {
      els.loopFill.style.stroke = 'var(--accent)';
    }
  }

  function initLoop() {
    const len = els.loopFill.getTotalLength();
    els.loopFill.style.strokeDasharray = len;
    els.loopFill.style.strokeDashoffset = len;
  }

  // ---------- Search ----------

  let searchTimer = null;
  els.searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    const val = e.target.value;
    searchTimer = setTimeout(() => {
      state.search = val;
      render();
    }, 120);
  });

  // ---------- Export / import ----------

  els.exportBtn.addEventListener('click', () => {
    const map = loadDoneMap();
    const blob = new Blob([JSON.stringify(map, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = 'miniband-postep-' + date + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  els.importInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        const current = loadDoneMap();
        Object.assign(current, imported);
        saveDoneMap(current);
        applyStoredState();
        render();
      } catch (err) {
        alert('Nie udało się wczytać pliku - sprawdź czy to poprawny eksport z tej aplikacji.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  // ---------- Init ----------

  applyStoredState();
  initChips();
  initLoop();
  render();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch(() => {});
    });
  }
})();
