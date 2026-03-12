const express = require('express');

const actividadesController = require('../controllers/actividades');
const { validarJWT } = require('../middlewares/validar-jwt');

const router = express.Router();

router.post('/', validarJWT, actividadesController.crearActividad);
router.get('/', validarJWT, actividadesController.getAllActividades);
router.get('/centro/:centroId', validarJWT, actividadesController.getActividadesByCentro);
router.get('/:id', validarJWT, actividadesController.getActividadById);
router.put('/:id', validarJWT, actividadesController.updateActividad);
router.delete('/:id', validarJWT, actividadesController.deleteActividad);

module.exports = router;