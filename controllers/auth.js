const bcrypt = require('bcryptjs');

const Usuario = require('../models/usuario');
const { generarJWT } = require('../helpers/jwt');

function limpiarUsuario(usuarioDoc) {
  const { password, __v, ...usuarioLimpio } = usuarioDoc.toObject();
  return usuarioLimpio;
}

exports.crearUsuario = async (req, res, next) => {
  if (req.body.nombre) {
    req.body.nombre = req.body.nombre.toLowerCase().trim();
  }

  if (req.body.email) {
    req.body.email = req.body.email.toLowerCase().trim();
  }

  const { nombre, password, rol, activo, telefono, email, fcmToken } = req.body;

  try {
    if (!nombre || !password) {
      return res.status(400).json({
        ok: false,
        msg: 'Debe enviar nombre y password',
      });
    }

    const existeNombre = await Usuario.findOne({ nombre });
    console.log('nombre: ', nombre);
    console.log('existeNombre: ', existeNombre);
    if (existeNombre) {
      return res.status(400).json({
        ok: false,
        msg: 'El usuario ya está registrado',
      });
    }

    const usuario = new Usuario({
      nombre,
      password,
      ...(rol !== undefined && { rol }),
      ...(activo !== undefined && { activo }),
      ...(telefono !== undefined && { telefono }),
      ...(email !== undefined && { email }),
      ...(fcmToken !== undefined && { fcmToken }),
    });

    const salt = await bcrypt.genSalt(10);
    usuario.password = await bcrypt.hash(password, salt);

    await usuario.save();

    const token = await generarJWT(usuario.id);
    const usuarioResp = limpiarUsuario(usuario);

    return res.status(201).json({
      ok: true,
      usuario: usuarioResp,
      token,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      ok: false,
      msg: 'Hable con el administrador',
    });
  }
};

exports.login = async (req, res, next) => {
  let { nombre, password } = req.body;

  try {
    if (!nombre || !password) {
      return res.status(400).json({
        ok: false,
        msg: 'Debe enviar nombre y password',
      });
    }

    nombre = nombre.toLowerCase().trim();

    const usuarioDB = await Usuario.findOne({ nombre });
    if (!usuarioDB) {
      return res.status(404).json({
        ok: false,
        msg: 'Nombre o contraseña incorrectos',
      });
    }

    const validPassword = bcrypt.compareSync(password, usuarioDB.password);
    if (!validPassword) {
      return res.status(400).json({
        ok: false,
        msg: 'Nombre o contraseña incorrectos',
      });
    }

    const token = await generarJWT(usuarioDB.id);
    const usuarioResp = limpiarUsuario(usuarioDB);

    return res.status(200).json({
      ok: true,
      usuario: usuarioResp,
      token,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      ok: false,
      msg: 'Hable con el administrador',
    });
  }
};

exports.renewToken = async (req, res, next) => {
  try {
    const uid = req.uid;

    const usuario = await Usuario.findById(uid);
    if (!usuario) {
      return res.status(404).json({
        ok: false,
        msg: 'Token no válido — el usuario no existe',
      });
    }

    const token = await generarJWT(uid);
    const usuarioResp = limpiarUsuario(usuario);

    return res.json({
      ok: true,
      usuario: usuarioResp,
      token,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      ok: false,
      msg: 'Error del servidor',
    });
  }
};

exports.fcmToken = async (req, res, next) => {
  try {
    const userId = req.uid;
    const { fcmToken } = req.body;

    if (!fcmToken) {
      return res.status(400).json({
        ok: false,
        msg: 'Firebase Cloud Messaging token requerido',
      });
    }

    const user = await Usuario.findByIdAndUpdate(
      userId,
      { fcmToken },
      { new: true }
    );

    return res.json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      ok: false,
      msg: 'Error del servidor',
    });
  }
};

