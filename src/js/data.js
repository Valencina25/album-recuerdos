const ADMIN_PASSWORD = "admin123";

const PHOTOS_DEFAULT = [];

let fotos = [];

function initData() {
  const stored = localStorage.getItem('album_fotos');
  if (stored) {
    fotos = JSON.parse(stored);
  } else {
    fotos = [...PHOTOS_DEFAULT];
  }
}

function saveFotos() {
  localStorage.setItem('album_fotos', JSON.stringify(fotos));
}

function addFoto(foto) {
  foto.id = Date.now();
  foto.fecha = new Date().toLocaleDateString();
  fotos.unshift(foto);
  saveFotos();
  return foto;
}

function removeFoto(id) {
  fotos = fotos.filter(f => f.id !== id);
  saveFotos();
}

function resetFotos() {
  fotos = [...PHOTOS_DEFAULT];
  saveFotos();
}

initData();

window.fotos = fotos;
window.addFoto = addFoto;
window.removeFoto = removeFoto;
window.resetFotos = resetFotos;
window.ADMIN_PASSWORD = ADMIN_PASSWORD;
