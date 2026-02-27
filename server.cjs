const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static('uploads'));

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

const DB_FILE = path.join(__dirname, 'fotos.json');

function loadFotos() {
  if (fs.existsSync(DB_FILE)) {
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    fotos = data.fotos || [];
    nextId = data.nextId || 1;
  } else {
    fotos = [];
    nextId = 1;
  }
}

function saveFotos() {
  fs.writeFileSync(DB_FILE, JSON.stringify({ fotos, nextId }, null, 2));
}

loadFotos();

app.get('/api/fotos', (req, res) => {
  res.json(fotos);
});

app.post('/api/fotos', upload.single('foto'), (req, res) => {
  let fotoData;
  let ext = 'jpg';

  if (req.file) {
    fotoData = req.file;
    ext = path.extname(req.file.originalname).slice(1);
  } else if (req.body && req.body.src) {
    const base64Data = req.body.src.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const filename = Date.now() + '-' + Math.round(Math.random() * 1E9) + '.' + (req.body.src.match(/^data:image\/(\w+)/)?.[1] || 'jpg');
    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, buffer);
    fotoData = { originalname: req.body.nombre || 'foto', filename };
    ext = filename.split('.').pop();
  } else {
    return res.status(400).json({ error: 'No se recibió imagen' });
  }

  const foto = {
    id: nextId++,
    nombre: req.body?.nombre || fotoData.originalname,
    src: `/uploads/${fotoData.filename}`,
    fecha: new Date().toLocaleDateString('es-ES')
  };

  fotos.unshift(foto);
  saveFotos();
  res.json(foto);
});

app.delete('/api/fotos/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const index = fotos.findIndex(f => f.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Foto no encontrada' });
  }

  const foto = fotos[index];
  const filePath = path.join(__dirname, foto.src);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  fotos.splice(index, 1);
  saveFotos();
  res.json({ success: true });
});

app.delete('/api/fotos', (req, res) => {
  fotos.forEach(foto => {
    const filePath = path.join(__dirname, foto.src);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  });
  fotos = [];
  saveFotos();
  res.json({ success: true });
});

app.use(express.static(__dirname));
app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));

app.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}`);
});
