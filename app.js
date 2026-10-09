// ============================================================
// PS4 Game Manager - Loja web
// ============================================================

const STORAGE_KEY = 'ps4gm_pc_url';

let allGames = [];
let pcUrl = localStorage.getItem(STORAGE_KEY) || '';

// ---------- Elementos ----------
const $grid = document.getElementById('grid');
const $search = document.getElementById('search');
const $empty = document.getElementById('empty');
const $modal = document.getElementById('modal');
const $pcUrl = document.getElementById('pcUrl');
const $pcStatus = document.getElementById('pcStatus');
const $pcStatusText = document.getElementById('pcStatusText');
const $toast = document.getElementById('toast');

// ---------- Botões ----------
document.getElementById('configBtn').onclick = openModal;
document.getElementById('changeBtn').onclick = openModal;
document.getElementById('cancelBtn').onclick = closeModal;
document.getElementById('saveBtn').onclick = savePcUrl;

// ---------- Inicialização ----------
init();

function init() {
  if (pcUrl) showPcStatus();
  loadGames();
}

function openModal() {
  $pcUrl.value = pcUrl || 'http://192.168.0.10:8080';
  $modal.classList.remove('hidden');
}

function closeModal() {
  $modal.classList.add('hidden');
}

function savePcUrl() {
  let url = $pcUrl.value.trim();
  if (!url) { toast('Endereço inválido', 'error'); return; }
  if (!url.startsWith('http')) url = 'http://' + url;
  url = url.replace(/\/+$/, '');

  pcUrl = url;
  localStorage.setItem(STORAGE_KEY, pcUrl);
  closeModal();
  showPcStatus();
  toast('PC configurado: ' + pcUrl, 'success');
}

function showPcStatus() {
  $pcStatus.classList.remove('hidden');
  $pcStatusText.textContent = '🖥 PC configurado: ' + pcUrl;
}

// ---------- Carregar jogos ----------
async function loadGames() {
  // Tenta do PC local primeiro
  if (pcUrl) {
    try {
      const r = await fetch(pcUrl + '/api/games', { signal: AbortSignal.timeout(5000) });
      if (r.ok) {
        allGames = await r.json();
        render(allGames);
        return;
      }
    } catch (e) {
      console.warn('PC offline, usando catálogo embutido');
    }
  }

  // Fallback: catálogo embutido (JSON estático no GitHub)
  try {
    const r = await fetch('games.json');
    if (r.ok) {
      const data = await r.json();
      allGames = Object.values(data.DATA || data).map(g => ({
        title_id: g.title_id,
        name: g.name,
        region: g.region,
        version: g.version,
        size: formatSize(g.size),
        cover_url: g.cover_url
      }));
      render(allGames);
      return;
    }
  } catch (e) {
    console.error(e);
  }

  toast('Não foi possível carregar o catálogo', 'error');
}

function formatSize(bytes) {
  if (!bytes) return 'N/A';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes, i = 0;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return size.toFixed(2) + ' ' + units[i];
}

// ---------- Renderizar cards ----------
function render(list) {
  $grid.innerHTML = '';

  if (!list.length) {
    $empty.classList.remove('hidden');
    return;
  }
  $empty.classList.add('hidden');

  list.slice(0, 500).forEach(g => {
    const card = document.createElement('div');
    card.className = 'card';

    const img = document.createElement('img');
    img.className = 'cover';
    img.src = g.cover_url;
    img.loading = 'lazy';
    img.onerror = () => { img.style.display = 'none'; };
    card.appendChild(img);

    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = g.name;
    card.appendChild(name);

    const info1 = document.createElement('div');
    info1.className = 'info';
    info1.textContent = g.title_id + ' • ' + g.region;
    card.appendChild(info1);

    const info2 = document.createElement('div');
    info2.className = 'info';
    info2.textContent = g.size;
    card.appendChild(info2);

    const btn = document.createElement('button');
    btn.className = 'btn-send';
    btn.textContent = 'ENVIAR PARA O PS4';
    btn.onclick = () => sendGame(g.title_id, btn);
    card.appendChild(btn);

    $grid.appendChild(card);
  });
}

// ---------- Enviar ----------
async function sendGame(titleId, btn) {
  if (!pcUrl) {
    toast('Configure o PC primeiro', 'error');
    openModal();
    return;
  }

  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'ENVIANDO...';

  try {
    const r = await fetch(pcUrl + '/api/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title_id: titleId }),
      signal: AbortSignal.timeout(10000)
    });

    const j = await r.json();
    if (j.ok) {
      toast(j.message || 'Enviado com sucesso', 'success');
      btn.textContent = '✓ ENVIADO';
      setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 3000);
    } else {
      toast(j.message || 'Erro no envio', 'error');
      btn.textContent = original;
      btn.disabled = false;
    }
  } catch (e) {
    toast('PC inacessível. Verifique se o PS4GameManager está aberto.', 'error');
    btn.textContent = original;
    btn.disabled = false;
  }
}

// ---------- Busca ----------
$search.oninput = () => {
  const q = $search.value.toLowerCase().trim();
  if (!q) { render(allGames); return; }
  render(allGames.filter(g =>
    (g.name || '').toLowerCase().includes(q) ||
    (g.title_id || '').toLowerCase().includes(q) ||
    (g.region || '').toLowerCase().includes(q)
  ));
};

// ---------- Toast ----------
let toastTimer = null;
function toast(msg, type) {
  $toast.textContent = msg;
  $toast.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    $toast.className = 'toast';
  }, 4000);
}
