const express = require('express');

const monitoresController = require('../controllers/monitores');
const { validarJWT } = require('../middlewares/validar-jwt');

const router = express.Router();

router.get('/', validarJWT, monitoresController.getMonitores);
router.get('/:id', validarJWT, monitoresController.getMonitorById);
router.get('/:id/resumen', validarJWT, monitoresController.getResumenMonitor);
router.put('/:id', validarJWT, monitoresController.updateMonitor);

module.exports = router;