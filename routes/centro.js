const express = require('express');

const centrosController = require('../controllers/centro');

const router = express.Router();

router.post('/', centrosController.crearCentro);
router.get('/', centrosController.getAllCentros);
router.get('/:id', centrosController.getCentroById);
router.put('/:id', centrosController.updateCentro);
router.delete('/:id', centrosController.deleteCentro);

module.exports = router;