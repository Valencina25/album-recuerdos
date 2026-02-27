const ADMIN_PASSWORD = "admin123";

const DB_NAME = "AlbumFotosDB";
const DB_VERSION = 1;
const STORE_NAME = "fotos";

let db;
let fotos = [];
let ready = false;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

async function loadFotos() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => {
      fotos = request.result.sort((a, b) => b.id - a.id);
      window.fotos = fotos;
      ready = true;
      resolve(fotos);
    };
    
    request.onerror = () => reject(request.error);
  });
}

async function addFoto(foto) {
  return new Promise((resolve, reject) => {
    foto.id = Date.now();
    foto.fecha = new Date().toLocaleDateString();
    
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(foto);
    
    request.onsuccess = () => {
      fotos.unshift(foto);
      window.fotos = fotos;
      resolve(foto);
    };
    
    request.onerror = () => reject(request.error);
  });
}

async function removeFoto(id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    
    request.onsuccess = () => {
      fotos = fotos.filter(f => f.id !== id);
      window.fotos = fotos;
      resolve();
    };
    
    request.onerror = () => reject(request.error);
  });
}

async function resetFotos() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();
    
    request.onsuccess = () => {
      fotos = [];
      window.fotos = fotos;
      resolve();
    };
    
    request.onerror = () => reject(request.error);
  });
}

async function initData() {
  await openDB();
  await loadFotos();
}

initData();

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
