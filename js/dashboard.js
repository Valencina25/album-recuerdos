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
  
  container.innerHTML = fotos.map(foto => `
    <div class="photo-card">
      <div class="photo-wrapper">
        <img src="${foto.src}" alt="${foto.nombre || 'Foto'}">
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
// SUBIR FOTO
// =============================
function handleUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    addFoto({
      nombre: file.name,
      src: e.target.result
    }).then(() => {
      renderFotos();
      showToast('Foto subida correctamente');
      event.target.value = '';
    });
  };
  reader.readAsDataURL(file);
}

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
function showSection(sectionId) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('[data-nav]').forEach(l => l.classList.remove('active'));
  
  const target = document.getElementById(sectionId);
  if (target) target.classList.add('active');
  document.querySelectorAll(`[data-nav="${sectionId}"]`).forEach(l => l.classList.add('active'));
  
  if (sectionId === 'admin') {
    const pwd = prompt('Introduce contraseña de admin:');
    if (pwd !== ADMIN_PASSWORD) {
      alert('Contraseña incorrecta');
      showSection('home');
      return;
    }
    renderAdminList();
  }
}

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
});

window.deleteFoto = deleteFoto;
window.renderFotos = renderFotos;
window.renderAdminList = renderAdminList;
window.showToast = showToast;
window.showSection = showSection;
