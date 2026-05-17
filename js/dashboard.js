// =============================
// RENDER FOTOS
// =============================
function renderFotos() {
  const container = document.getElementById('gallery');
  if (!container) return;
  
  if (fotos.length === 0) {
    container.innerHTML = '<p class="empty-message">No hay fotos. Sube la primera!</p>';
    return;
  }
  
  container.innerHTML = fotos.map((foto, i) => `
    <div class="photo-card" onclick="openFullscreen(${i})">
      <div class="photo-wrapper">
        <img src="${foto.src}" alt="${foto.nombre || 'Foto'}" loading="lazy">
        ${foto.lat ? '<span class="photo-geo-badge">📍</span>' : ''}
      </div>
      <div class="photo-info">
        <p>${foto.fecha}</p>
      </div>
    </div>
  `).join('');
}

function deleteFoto(id) {
  if (confirm('¿Eliminar esta foto?')) {
    removeFoto(id).then(() => {
      renderFotos();
      showToast('Foto eliminada');
    });
  }
}

// =============================
// TOAST
// =============================
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

// =============================
// CANVAS EDITOR
// =============================
let editorFile = null;
let editorImage = null;
let editorFilter = 'none';
let editorCloseTimer = null;
let editorFileUrl = null;

function openEditor(file) {
  if (editorCloseTimer) {
    clearTimeout(editorCloseTimer);
    editorCloseTimer = null;
  }
  document.getElementById('file-info').innerHTML = '';
  editorFile = file;

  const overlay = document.getElementById('editor-overlay');
  const canvas = document.getElementById('editor-canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();

  const savedQuality = localStorage.getItem('editor_quality') || '80';
  const savedFilter = localStorage.getItem('editor_filter') || 'none';
  document.getElementById('editor-quality').value = savedQuality;
  editorFilter = savedFilter;

  img.onload = () => {
    editorImage = img;
    const maxW = 1200;
    let w = img.width;
    let h = img.height;
    if (w > maxW) { h = h * maxW / w; w = maxW; }
    canvas.width = w;
    canvas.height = h;
    applyFilter(ctx, img, savedFilter);
    document.querySelectorAll('.btn-filter').forEach(b => b.classList.toggle('active', b.dataset.filter === savedFilter));
    updateEditorInfo(file, canvas);
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  };
  const uploadBtn = document.querySelector('.editor-upload-btn');
  if (uploadBtn) { uploadBtn.textContent = 'Subir foto'; uploadBtn.disabled = false; }
  const progressWrap = document.getElementById('upload-progress');
  if (progressWrap) progressWrap.style.display = 'none';
  const progressFill = document.getElementById('upload-progress-fill');
  if (progressFill) progressFill.style.width = '0%';

  if (editorFileUrl) URL.revokeObjectURL(editorFileUrl);
  editorFileUrl = URL.createObjectURL(file);
  img.src = editorFileUrl;
}

const filterWorker = new Worker(URL.createObjectURL(new Blob([`
self.onmessage = (e) => {
  const d = new Uint8ClampedArray(e.data.data);
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i+1], b = d[i+2];
    if (e.data.f === 'g') { const x = 0.299*r+0.587*g+0.114*b; d[i]=d[i+1]=d[i+2]=x; }
    else if (e.data.f === 's') { d[i]=Math.min(255,r*0.393+g*0.769+b*0.189); d[i+1]=Math.min(255,r*0.349+g*0.686+b*0.168); d[i+2]=Math.min(255,r*0.272+g*0.534+b*0.131); }
    else if (e.data.f === 'i') { d[i]=255-r; d[i+1]=255-g; d[i+2]=255-b; }
  }
  self.postMessage({ b: d.buffer, w: e.data.w, h: e.data.h }, [d.buffer]);
};
`])));
let filterPending = false;

filterWorker.onmessage = (e) => {
  const canvas = document.getElementById('editor-canvas');
  const ctx = canvas.getContext('2d');
  const imageData = new ImageData(new Uint8ClampedArray(e.data.b), e.data.w, e.data.h);
  ctx.putImageData(imageData, 0, 0);
  filterPending = false;
};

function applyFilter(ctx, img, filter) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.drawImage(img, 0, 0, ctx.canvas.width, ctx.canvas.height);

  if (filter === 'none') { editorFilter = filter; return; }
  if (filterPending) return;

  const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  filterPending = true;
  const flt = { 'grayscale': 'g', 'sepia': 's', 'invert': 'i' }[filter] || 'g';
  filterWorker.postMessage({ data: imageData.data.buffer, f: flt, w: imageData.width, h: imageData.height }, [imageData.data.buffer]);
  editorFilter = filter;
}

function setEditorFilter(filter) {
  localStorage.setItem('editor_filter', filter);
  document.querySelectorAll('.btn-filter').forEach(b => b.classList.toggle('active', b.dataset.filter === filter));
  const canvas = document.getElementById('editor-canvas');
  const ctx = canvas.getContext('2d');
  applyFilter(ctx, editorImage, filter);
}

function updateEditorInfo(file, canvas) {
  const el = document.getElementById('editor-info');
  const sizeMB = (file.size / 1024 / 1024).toFixed(2);
  const newSize = estimateSize(canvas.width, canvas.height);
  el.textContent = `${canvas.width}×${canvas.height}px | Original: ${sizeMB}MB → ~${newSize.toFixed(1)}MB`;

  const quality = document.getElementById('editor-quality');
  document.getElementById('editor-quality-val').textContent = quality.value + '%';
}

function estimateSize(w, h) {
  return w * h * 3 / 1024 / 1024;
}

function closeEditor() {
  const overlay = document.getElementById('editor-overlay');
  overlay.classList.remove('active');
  document.body.style.overflow = '';
  if (editorCloseTimer) {
    clearTimeout(editorCloseTimer);
    editorCloseTimer = null;
  }
  if (editorFileUrl) {
    URL.revokeObjectURL(editorFileUrl);
    editorFileUrl = null;
  }
  editorFile = null;
}

function uploadFromEditor() {
  const canvas = document.getElementById('editor-canvas');
  const quality = parseInt(document.getElementById('editor-quality').value) / 100;
  const btn = document.querySelector('.editor-upload-btn');
  const progressFill = document.getElementById('upload-progress-fill');
  const progressWrap = document.getElementById('upload-progress');

  btn.textContent = 'Obteniendo ubicación…';
  btn.disabled = true;
  progressWrap.style.display = '';

  Promise.all([
    new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality)),
    getLocation(),
  ]).then(([blob, location]) => {
    const processedFile = new File([blob], editorFile.name, { type: 'image/jpeg' });
    btn.textContent = 'Subiendo… 0%';
    return addFoto(processedFile, location, (pct) => {
      progressFill.style.width = pct + '%';
      btn.textContent = `Subiendo… ${pct}%`;
    }).then(() => {
      renderFotos();
      showToast(location ? 'Foto subida con ubicación' : 'Foto subida');
      editorCloseTimer = setTimeout(() => { closeEditor(); }, 300);
      document.getElementById('photo-upload').value = '';
    });
  }).catch((err) => {
    console.error(err);
    showToast('Error al subir la foto');
    btn.textContent = 'Subir foto';
    btn.disabled = false;
    progressFill.style.width = '0%';
    progressWrap.style.display = 'none';
  });
}

// =============================
// FILE API — DRAG & DROP + INFO
// =============================
function showFileInfo(file) {
  const el = document.getElementById('file-info');
  const types = { 'image/jpeg': 'JPEG', 'image/png': 'PNG', 'image/webp': 'WebP', 'image/gif': 'GIF', 'image/avif': 'AVIF' };
  const tipo = types[file.type] || file.type || 'Desconocido';
  const size = file.size > 1048576 ? (file.size / 1048576).toFixed(1) + ' MB' : (file.size / 1024).toFixed(0) + ' KB';
  const date = new Date(file.lastModified).toLocaleDateString('es-ES');

  const img = new Image();
  img.onload = () => {
    el.innerHTML = `
      <span class="file-info-badge">${tipo}</span>
      <span class="file-info-badge">${img.naturalWidth}×${img.naturalHeight}</span>
      <span class="file-info-badge">${size}</span>
      <span class="file-info-badge">${date}</span>
      <span class="file-info-name">${file.name}</span>
    `;
    URL.revokeObjectURL(img.src);
  };
  img.src = URL.createObjectURL(file);
}

function processFile(file) {
  if (!file.type.startsWith('image/')) {
    showToast('Solo se permiten imágenes');
    return;
  }
  showFileInfo(file);
  openEditor(file);
}

function handleUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  processFile(file);
}

document.addEventListener('DOMContentLoaded', () => {
  const zone = document.getElementById('drop-zone');
  if (!zone) return;

  ['dragenter', 'dragover'].forEach(e => {
    zone.addEventListener(e, (ev) => { ev.preventDefault(); zone.classList.add('drag-over'); });
  });
  ['dragleave', 'drop'].forEach(e => {
    zone.addEventListener(e, (ev) => { ev.preventDefault(); zone.classList.remove('drag-over'); });
  });
  zone.addEventListener('drop', (ev) => {
    const file = ev.dataTransfer.files[0];
    if (file) { processFile(file); document.getElementById('photo-upload').value = ''; }
  });
});

// =============================
// ADMIN
// =============================
function renderAdminList() {
  const container = document.getElementById('admin-list');
  if (!container) return;
  
  container.innerHTML = fotos.map(foto => `
    <tr>
      <td>${foto.id}</td>
      <td>${foto.nombre || 'Sin nombre'}</td>
      <td>${foto.fecha}</td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="deleteFoto(${foto.id})">Eliminar</button>
      </td>
    </tr>
  `).join('');
}

// =============================
// NAVEGACIÓN
// =============================
function showSection(sectionId, pushHistory = true) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('[data-nav]').forEach(l => l.classList.remove('active'));
  
  const target = document.getElementById(sectionId);
  if (target) target.classList.add('active');
  document.querySelectorAll(`[data-nav="${sectionId}"]`).forEach(l => l.classList.add('active'));
  
  if (sectionId === 'admin') {
    if (!sessionStorage.getItem('admin_auth')) {
      const pwd = prompt('Introduce contraseña de admin:');
      if (pwd !== ADMIN_PASSWORD) {
        alert('Contraseña incorrecta');
        showSection('home');
        return;
      }
      sessionStorage.setItem('admin_auth', '1');
    }
    renderAdminList();
  }

  if (pushHistory) {
    const url = sectionId === 'home' ? '/' : '/' + sectionId;
    history.pushState({ section: sectionId }, '', url);
  }
}

window.addEventListener('popstate', (e) => {
  const section = e.state?.section || 'home';
  showSection(section, false);
});

// =============================
// INICIALIZAR
// =============================
document.addEventListener('DOMContentLoaded', async () => {
  await dbReady();
  
  // Navegación
  document.querySelectorAll('[data-nav]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      showSection(link.dataset.nav);
    });
  });
  
  // Upload
  const uploadInput = document.getElementById('photo-upload');
  if (uploadInput) {
    uploadInput.addEventListener('change', handleUpload);
  }

  // Editor quality slider
  const qualitySlider = document.getElementById('editor-quality');
  if (qualitySlider) {
    qualitySlider.addEventListener('input', () => {
      localStorage.setItem('editor_quality', qualitySlider.value);
      document.getElementById('editor-quality-val').textContent = qualitySlider.value + '%';
      if (editorImage) updateEditorInfo(editorFile, document.getElementById('editor-canvas'));
    });
  }
  
  // Reset admin
  const btnReset = document.getElementById('btn-reset');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (confirm('¿Eliminar todas las fotos?')) {
        resetFotos().then(() => {
          renderFotos();
          renderAdminList();
          showToast('Todas las fotos eliminadas');
        });
      }
    });
  }
  
  renderFotos();

  // History API — restore section from URL on initial load
  const initial = location.pathname.replace('/', '') || 'home';
  if (initial !== 'home') {
    showSection(initial, false);
    history.replaceState({ section: initial }, '', location.pathname);
  }

  // Page Visibility — refresh data when user returns
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      fetch('/api/fotos').then(r => r.json()).then(serverFotos => {
        fotos = serverFotos;
        window.fotos = fotos;
        const section = document.querySelector('.section.active');
        renderFotos();
        if (section && section.id === 'admin') renderAdminList();
      }).catch(() => {});
    }
  });
});

// =============================
// WEBRTC — P2P Photo Share
// =============================
let pc = null;
let dc = null;
let signalWS = null;

function getSTUN() {
  return { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
}

function onSignal(data) {
  if (!data || !pc) return;

  if (data.candidate) {
    pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => {});
    return;
  }

  if (!data.sdp) return;
  const desc = new RTCSessionDescription(data.sdp);

  if (data.sdp.type === 'offer') {
    pc.setRemoteDescription(desc).then(() =>
      pc.createAnswer().then((a) => {
        pc.setLocalDescription(a);
        signalWS.send(JSON.stringify({ type: 'signal', target: 'peer', data: { sdp: a } }));
      })
    ).catch(() => {});
  } else {
    pc.setRemoteDescription(desc).catch(() => {});
  }
}

function connectSignal() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  signalWS = new WebSocket(`${proto}//${location.host}`);
  signalWS.onmessage = (e) => {
    try { const m = JSON.parse(e.data); if (m.type === 'signal') onSignal(m.data); } catch {}
  };
  signalWS.onopen = () => signalWS.send(JSON.stringify({ type: 'signal-peer-ready' }));
}

function shareViaWebRTC(foto) {
  if (pc) { showToast('Ya hay una sesión activa'); return; }

  if (!signalWS || signalWS.readyState !== WebSocket.OPEN) {
    showToast('Conectando señalización…');
    connectSignal();
    const check = setInterval(() => {
      if (signalWS && signalWS.readyState === WebSocket.OPEN) {
        clearInterval(check);
        doShare(foto);
      }
    }, 200);
    return;
  }
  doShare(foto);
}

function doShare(foto) {
  showToast('Conectando vía WebRTC…');
  pc = new RTCPeerConnection(getSTUN());
  dc = pc.createDataChannel('fotos');

  dc.onopen = () => {
    showToast('¡Conectado! Enviando foto…');
    dc.send(JSON.stringify({ src: foto.src, nombre: foto.nombre }));
  };

  dc.onclose = () => { showToast('Foto enviada'); closeWebRTC(); };
  dc.onerror = () => { showToast('Error al enviar'); closeWebRTC(); };

  pc.onicecandidate = (e) => {
    if (e.candidate) {
      signalWS.send(JSON.stringify({ type: 'signal', target: 'peer', data: { candidate: e.candidate } }));
    }
  };

  pc.createOffer().then((o) => pc.setLocalDescription(o)).then(() => {
    signalWS.send(JSON.stringify({ type: 'signal', target: 'peer', data: { sdp: pc.localDescription } }));
  }).catch(() => { closeWebRTC(); showToast('Error WebRTC'); });
}

function closeWebRTC() {
  if (dc) { dc.close(); dc = null; }
  if (pc) { pc.close(); pc = null; }
  if (signalWS) { signalWS.close(); signalWS = null; }
}

// =============================
// FULLSCREEN
// =============================
function openFullscreen(index) {
  const overlay = document.getElementById('fullscreen-overlay');
  const img = document.getElementById('fullscreen-img');
  const caption = document.getElementById('fullscreen-caption');
  const geo = document.getElementById('fullscreen-geo');

  const foto = fotos[index];
  img.src = foto.src;
  caption.textContent = foto.nombre || 'Foto';

  if (foto.lat && foto.lng) {
    geo.innerHTML = `
      <span>📍 ${foto.lat.toFixed(4)}, ${foto.lng.toFixed(4)}</span>
      <iframe
        class="geo-map"
        loading="lazy"
        src="https://www.openstreetmap.org/export/embed.html?bbox=${foto.lng - 0.01},${foto.lat - 0.01},${foto.lng + 0.01},${foto.lat + 0.01}&layer=mapnik&marker=${foto.lat},${foto.lng}"
      ></iframe>
    `;
    geo.style.display = '';
  } else {
    geo.style.display = 'none';
  }

  overlay.dataset.index = index;
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeFullscreen() {
  const overlay = document.getElementById('fullscreen-overlay');
  overlay.classList.remove('active');
  document.body.style.overflow = '';
}

function navFullscreen(dir) {
  const overlay = document.getElementById('fullscreen-overlay');
  let i = parseInt(overlay.dataset.index) + dir;
  if (i < 0) i = fotos.length - 1;
  if (i >= fotos.length) i = 0;
  openFullscreen(i);
}

document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('fullscreen-overlay');
  if (!overlay) return;

  document.getElementById('btn-webrtc-share')?.addEventListener('click', () => {
    const i = parseInt(overlay.dataset.index);
    shareViaWebRTC(fotos[i]);
  });
  let pointerLocked = false;
  let lockAccum = 0;

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeFullscreen();
  });

  const fsImg = document.getElementById('fullscreen-img');
  if (fsImg) {
    fsImg.addEventListener('click', () => {
      if (document.pointerLockElement) return;
      fsImg.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
      pointerLocked = document.pointerLockElement === fsImg;
      lockAccum = 0;
      fsImg.style.cursor = pointerLocked ? 'none' : 'pointer';
    });

    document.addEventListener('mousemove', (e) => {
      if (!pointerLocked) return;
      lockAccum += e.movementX;
      if (Math.abs(lockAccum) > 80) {
        navFullscreen(lockAccum > 0 ? 1 : -1);
        lockAccum = 0;
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (!overlay.classList.contains('active')) return;
    if (e.key === 'Escape') {
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
      closeFullscreen();
    }
    if (e.key === 'ArrowLeft') navFullscreen(-1);
    if (e.key === 'ArrowRight') navFullscreen(1);
  });

  // Contact form
  document.getElementById('form-contacto')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd);
    const msg = document.getElementById('contacto-msg');

    try {
      const res = await fetch('/api/contacto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const json = await res.json();
      if (json.success) {
        msg.className = 'contacto-msg success';
        msg.textContent = '¡Mensaje enviado correctamente!';
        e.target.reset();
      } else {
        msg.className = 'contacto-msg error';
        msg.textContent = json.error || 'Error al enviar';
      }
    } catch {
      msg.className = 'contacto-msg error';
      msg.textContent = 'Error de conexión';
    }
  });
});

window.openFullscreen = openFullscreen;
window.closeFullscreen = closeFullscreen;
window.navFullscreen = navFullscreen;
window.shareViaWebRTC = shareViaWebRTC;
window.closeWebRTC = closeWebRTC;
window.deleteFoto = deleteFoto;
window.renderFotos = renderFotos;
window.renderAdminList = renderAdminList;
window.showToast = showToast;
window.showSection = showSection;
