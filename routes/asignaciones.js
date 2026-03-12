const express = require('express');

const asignacionesController = require('../controllers/asignaciones');
const { validarJWT } = require('../middlewares/validar-jwt');

const router = express.Router();

router.post('/', validarJWT, asignacionesController.crearAsignacion);
router.get('/', validarJWT, asignacionesController.getAsignaciones);
router.get('/monitor/:monitorId', validarJWT, asignacionesController.getAsignacionesByMonitor);
router.get('/centro/:centroId', validarJWT, asignacionesController.getAsignacionesByCentro);
router.get('/:id', validarJWT, asignacionesController.getAsignacionById);
router.put('/:id', validarJWT, asignacionesController.updateAsignacion);
router.delete('/:id', validarJWT, asignacionesController.deleteAsignacion);

module.exports = router;