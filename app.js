const path = require('path');

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const versionRoutes = require('./routes/version');

require("node:dns/promises").setServers(["1.1.1.1", "8.8.8.8"]);

const app = express();

require('dotenv').config({ path: path.join(__dirname, '.env') });
const MONGODB_URI = process.env.MONGODB_URI;

// this will parse any incoming request
// whose Content-Type is application/json
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/centros', require('./routes/centro'));
app.use('/api/monitores', require('./routes/monitores'));
app.use(versionRoutes.routes);
app.use('/api/actividades', require('./routes/actividades'));
app.use('/api/asignaciones', require('./routes/asignaciones'));


// Habilitamos CORS para evitar bloqueos de origen cruzado
app.use(cors());

// 2) Servir la carpeta public/images en la ruta /images
app.use(
  '/images',
  express.static(path.join(__dirname, 'public/images/optimizadas'))
);

const PORT = process.env.PORT || 3000;
async function startServer() {
    try {
      await mongoose.connect(MONGODB_URI);
      console.log('✅ MongoDB connected - Gestiona app');
      app.listen(PORT, () => {
        console.log(`🚀 Server listening on port ${PORT}`);
      });
    } catch (error) {
      console.error('❌ Error connecting to MongoDB', error);
    }
  }

  startServer();