const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

router.get('/app-version', (req, res) => {
  const versionPath = path.join(__dirname, '..', 'public', 'version', 'version-app.json');

  fs.readFile(versionPath, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'No se pudo leer la versión' });
    }
    try {
      const versionData = JSON.parse(data);
      res.json(versionData);
    } catch (parseErr) {
      res.status(500).json({ error: 'Error al interpretar el JSON' });
    }
  });
});

exports.routes = router;
