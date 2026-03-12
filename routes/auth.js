const express = require('express');

const authController = require('../controllers/auth');
const { validarJWT } = require('../middlewares/validar-jwt');

const router = express.Router();

router.post('/login', authController.login);
router.post('/crear-usuario', authController.crearUsuario);
router.get('/renew', validarJWT, authController.renewToken);
router.post('/fcm-token', validarJWT, authController.fcmToken);

module.exports = router;