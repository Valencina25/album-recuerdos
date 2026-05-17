const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { WebSocketServer } = require('ws');
const Database = require('better-sqlite3');

const cloudinary = require('cloudinary').v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const db = new Database(path.join(__dirname, 'album.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS fotos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    src TEXT NOT NULL,
    data BLOB,
    fecha TEXT NOT NULL,
    lat REAL,
    lng REAL
  );
  CREATE TABLE IF NOT EXISTS contactos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    edad INTEGER NOT NULL,
    correo TEXT NOT NULL,
    telefono TEXT DEFAULT '',
    sitioweb TEXT DEFAULT '',
    fecha TEXT NOT NULL
  );
`);

try {
  db.exec('ALTER TABLE fotos ADD COLUMN data BLOB');
} catch (e) {
  // Column already exists
}

const insertFoto = db.prepare(
  'INSERT INTO fotos (nombre, src, data, fecha, lat, lng) VALUES (?, ?, ?, ?, ?, ?)'
);
const deleteFoto = db.prepare('DELETE FROM fotos WHERE id = ?');
const deleteAllFotos = db.prepare('DELETE FROM fotos');
const getAllFotos = db.prepare('SELECT id, nombre, src, fecha, lat, lng FROM fotos ORDER BY id DESC');
const getFotoById = db.prepare('SELECT * FROM fotos WHERE id = ?');

const insertContacto = db.prepare(
  'INSERT INTO contactos (nombre, edad, correo, telefono, sitioweb, fecha) VALUES (?, ?, ?, ?, ?, ?)'
);
const getAllContactos = db.prepare('SELECT * FROM contactos ORDER BY id DESC');

let lastId = db.prepare('SELECT COALESCE(MAX(id), 0) as maxId FROM fotos').get().maxId;

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const PORT = process.env.PORT || 3001;

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'sync' }));
  let signalPeer = false;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'signal-peer-ready') {
      signalPeer = true;
      return;
    }

    if (msg.type === 'signal' && msg.target) {
      const peer = [...wss.clients].find(c => c !== ws && c.readyState === 1);
      if (peer) {
        peer.send(JSON.stringify({ type: 'signal', from: 'peer', data: msg.data }));
      }
    }
  });

  ws.on('close', () => { signalPeer = false; });
});

function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(msg);
  });
}

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

app.get('/api/fotos', (req, res) => {
  const fotos = getAllFotos.all().map(f => ({ ...f, src: `/api/fotos/${f.id}/imagen` }));
  res.json(fotos);
});

app.get('/api/fotos/:id/imagen', (req, res) => {
  const foto = getFotoById.get(parseInt(req.params.id));
  if (!foto || !foto.data) {
    return res.status(404).send('Imagen no encontrada');
  }
  const ext = foto.src.split('.').pop();
  const contentType = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
  res.set('Content-Type', contentType);
  res.send(foto.data);
});

app.post('/api/fotos', upload.single('foto'), async (req, res) => {
  let imageData = null;
  let ext = 'jpg';
  let filename = null;

  if (req.file) {
    imageData = fs.readFileSync(req.file.path);
    ext = path.extname(req.file.originalname).slice(1);
    filename = req.file.filename;
    fs.unlinkSync(req.file.path);
  } else if (req.body && req.body.src) {
    const base64Data = req.body.src.replace(/^data:image\/\w+;base64,/, '');
    imageData = Buffer.from(base64Data, 'base64');
    ext = req.body.src.match(/^data:image\/(\w+)/)?.[1] || 'jpg';
    filename = Date.now() + '-' + Math.round(Math.random() * 1E9) + '.' + ext;
  } else {
    return res.status(400).json({ error: 'No se recibió imagen' });
  }

  const lat = req.body?.lat ? parseFloat(req.body.lat) : null;
  const lng = req.body?.lng ? parseFloat(req.body.lng) : null;
  const fecha = new Date().toLocaleDateString('es-ES');

  let cloudUrl = null;
  if (process.env.CLOUDINARY_CLOUD_NAME) {
    try {
      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload(`data:image/${ext};base64,${imageData.toString('base64')}`, {
          folder: 'album-recuerdos',
          public_id: filename
        }, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
      cloudUrl = result.secure_url;
    } catch (e) {
      console.error('Cloudinary error:', e.message);
    }
  }

  const info = insertFoto.run(
    req.body?.nombre || 'foto',
    filename,
    imageData,
    fecha,
    lat,
    lng
  );

  const foto = getFotoById.get(info.lastInsertRowid);
  const finalSrc = cloudUrl || `/api/fotos/${foto.id}/imagen`;
  broadcast({ type: 'sync' });
  res.json({ ...foto, src: finalSrc });
});

app.delete('/api/fotos/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const foto = getFotoById.get(id);

  if (!foto) {
    return res.status(404).json({ error: 'Foto no encontrada' });
  }

  deleteFoto.run(id);
  broadcast({ type: 'sync' });
  res.json({ success: true });
});

app.delete('/api/fotos', (req, res) => {
  deleteAllFotos.run();
  broadcast({ type: 'sync' });
  res.json({ success: true });
});

app.post('/api/contacto', (req, res) => {
  const { nombre, edad, correo, telefono, sitioweb } = req.body;
  if (!nombre || !edad || !correo) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }
  insertContacto.run(
    nombre, parseInt(edad), correo, telefono || '', sitioweb || '', new Date().toISOString()
  );
  res.json({ success: true });
});

app.get('/api/contacto', (req, res) => {
  const list = getAllContactos.all();
  res.json(list);
});

app.use(express.static(__dirname));
app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));

server.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}`);
});
