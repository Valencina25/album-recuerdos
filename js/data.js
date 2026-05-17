const ADMIN_PASSWORD = "admin123";
const API = '/api/fotos';
const DB_NAME = 'AlbumFotosDB';
const DB_VERSION = 2;
const STORE_NAME = 'fotos';

let fotos = [];
let ready = false;
let db = null;
let ws = null;

function connectWS() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${proto}//${location.host}`);

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'sync') {
        fetch(API).then(r => r.json()).then(serverFotos => {
          fotos = serverFotos;
          window.fotos = fotos;
          if (window.renderFotos) window.renderFotos();
          if (window.renderAdminList) window.renderAdminList();
        }).catch(() => {});
      }
    } catch {}
  };

  ws.onclose = () => {
    setTimeout(connectWS, 3000);
  };
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      if (!event.target.result.objectStoreNames.contains(STORE_NAME)) {
        const store = event.target.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('fecha', 'fecha', { unique: false });
      }
    };
  });
}

async function idbGetAll() {
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(foto) {
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  return new Promise((resolve, reject) => {
    const req = store.put(foto);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(id) {
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function idbClear() {
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  return new Promise((resolve, reject) => {
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function syncFromServer() {
  try {
    const res = await fetch(API);
    const serverFotos = await res.json();
    fotos = serverFotos;
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    await new Promise((resolve, reject) => {
      const clearReq = store.clear();
      clearReq.onerror = () => reject(clearReq.error);
      clearReq.onsuccess = () => {
        let pending = serverFotos.length;
        if (!pending) return resolve();
        serverFotos.forEach(f => {
          const putReq = store.put(f);
          putReq.onsuccess = () => { if (--pending === 0) resolve(); };
          putReq.onerror = () => reject(putReq.error);
        });
      };
    });
  } catch {}
}

async function loadFotos() {
  db = await openDB();
  connectWS();

  const local = await idbGetAll();
  if (local.length > 0) {
    fotos = local.sort((a, b) => b.id - a.id);
    window.fotos = fotos;
    ready = true;
  }

  await syncFromServer();

  window.fotos = fotos;
  ready = true;
  return fotos;
}

function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 5000 }
    );
  });
}

async function addFoto(file, location, onProgress) {
  const formData = new FormData();
  formData.append('foto', file);
  formData.append('nombre', file.name);
  if (location) {
    formData.append('lat', location.lat);
    formData.append('lng', location.lng);
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', API);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const foto = JSON.parse(xhr.responseText);
        fotos.unshift(foto);
        window.fotos = fotos;
        await idbPut(foto);
        resolve(foto);
      } else {
        reject(new Error('Error al subir foto'));
      }
    };

    xhr.onerror = () => reject(new Error('Error de conexión'));
    xhr.send(formData);
  });
}

async function removeFoto(id) {
  const res = await fetch(`${API}/${id}`, { method: 'DELETE' });
  if (!res.ok && (await res.json()).error !== 'Foto no encontrada') return;
  fotos = fotos.filter(f => f.id !== id);
  window.fotos = fotos;
  await idbDelete(id);
}

async function resetFotos() {
  await fetch(API, { method: 'DELETE' });
  fotos = [];
  window.fotos = fotos;
  await idbClear();
}

async function initData() {
  await loadFotos();
}

initData().catch(console.error);

window.fotos = fotos;
window.addFoto = addFoto;
window.removeFoto = removeFoto;
window.resetFotos = resetFotos;
window.ADMIN_PASSWORD = ADMIN_PASSWORD;
window.dbReady = () => new Promise(resolve => {
  const check = setInterval(() => {
    if (ready) {
      clearInterval(check);
      resolve();
    }
  }, 50);
});
