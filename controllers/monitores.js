const mongoose = require('mongoose');
const Usuario = require('../models/usuario');
const Asignacion = require('../models/asignacion');
const { sendPush } = require('../helpers/notifications');

function esObjectIdValido(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function inicioDelDia(fecha) {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  return d;
}

function finDelDia(fecha) {
  const d = new Date(fecha);
  d.setHours(23, 59, 59, 999);
  return d;
}

function inicioDeMes(year, month) {
  return new Date(year, month - 1, 1, 0, 0, 0, 0);
}

function finDeMes(year, month) {
  return new Date(year, month, 0, 23, 59, 59, 999);
}

function duracionHoras(inicio, fin) {
  return (new Date(fin) - new Date(inicio)) / (1000 * 60 * 60);
}

/**
 * GET /api/monitores
 * Lista básica de monitores para selector o listado
 */
exports.getMonitores = async (req, res) => {
  try {
    const monitores = await Usuario.find({ rol: 'monitor' })
      .select('nombre nombreReal rol activo telefono email fcmToken avisos createdAt updatedAt')
      .sort({ nombre: 1 });

    return res.status(200).json({
      ok: true,
      monitores,
    });
  } catch (error) {
    console.error('Error al obtener monitores:', error);
    return res.status(500).json({
      ok: false,
      msg: 'No fue posible cargar los monitores',
    });
  }
};

/**
 * GET /api/monitores/:id
 * Información básica del monitor + últimas asignaciones
 */
exports.getMonitorById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!esObjectIdValido(id)) {
      return res.status(400).json({
        ok: false,
        msg: 'ID de monitor no válido',
      });
    }

    const monitor = await Usuario.findOne({ _id: id, rol: 'monitor' })
      .select('nombre nombreReal rol activo telefono email fcmToken avisos createdAt updatedAt');

    if (!monitor) {
      return res.status(404).json({
        ok: false,
        msg: 'Monitor no encontrado',
      });
    }

    const ultimasAsignaciones = await Asignacion.find({
      monitorId: id,
      estado: { $ne: 'cancelada' },
    })
      .populate('centroId', 'nombre ubicacion')
      .populate('actividadId', 'nombre descripcion')
      .sort({ start: -1 })
      .limit(10);

    return res.status(200).json({
      ok: true,
      monitor,
      ultimasAsignaciones,
    });
  } catch (error) {
    console.error('Error al obtener monitor:', error);
    return res.status(500).json({
      ok: false,
      msg: 'Error interno al obtener monitor',
    });
  }
};

/**
 * GET /api/monitores/:id/resumen?year=2026&month=3&precioHora=12.5
 * Resumen operativo del monitor.
 * precioHora es opcional y solo se usa para estimar sueldo sin guardarlo.
 */
exports.getResumenMonitor = async (req, res) => {
  try {
    const { id } = req.params;
    const now = new Date();

    const year = parseInt(req.query.year, 10) || now.getFullYear();
    const month = parseInt(req.query.month, 10) || now.getMonth() + 1;
    const precioHora = req.query.precioHora !== undefined
      ? Number(req.query.precioHora)
      : null;

    if (!esObjectIdValido(id)) {
      return res.status(400).json({
        ok: false,
        msg: 'ID de monitor no válido',
      });
    }

    if (precioHora !== null && Number.isNaN(precioHora)) {
      return res.status(400).json({
        ok: false,
        msg: 'precioHora no es válido',
      });
    }

    const monitor = await Usuario.findOne({ _id: id, rol: 'monitor' })
      .select('nombre nombreReal rol activo telefono email fcmToken avisos createdAt updatedAt');

    if (!monitor) {
      return res.status(404).json({
        ok: false,
        msg: 'Monitor no encontrado',
      });
    }

    const inicioMes = inicioDeMes(year, month);
    const finMes = finDeMes(year, month);
    const hoyInicio = inicioDelDia(now);
    const hoyFin = finDelDia(now);

    const [asignacionesMes, asignacionesHoy, proximaAsignacion] = await Promise.all([
      Asignacion.find({
        monitorId: id,
        estado: { $ne: 'cancelada' },
        start: { $gte: inicioMes, $lte: finMes },
      })
        .populate('centroId', 'nombre ubicacion')
        .populate('actividadId', 'nombre descripcion')
        .sort({ start: 1 }),

      Asignacion.find({
        monitorId: id,
        estado: { $ne: 'cancelada' },
        start: { $lte: hoyFin },
        end: { $gte: hoyInicio },
      })
        .populate('centroId', 'nombre ubicacion')
        .populate('actividadId', 'nombre descripcion')
        .sort({ start: 1 }),

      Asignacion.findOne({
        monitorId: id,
        estado: { $ne: 'cancelada' },
        start: { $gte: now },
      })
        .populate('centroId', 'nombre ubicacion')
        .populate('actividadId', 'nombre descripcion')
        .sort({ start: 1 }),
    ]);

    const totalHorasMes = asignacionesMes.reduce((acc, a) => {
      return acc + duracionHoras(a.start, a.end);
    }, 0);

    const totalAsignacionesMes = asignacionesMes.length;

    const centrosUnicosMes = [
      ...new Set(
        asignacionesMes
          .map((a) => a.centroId?._id?.toString())
          .filter(Boolean)
      ),
    ].length;

    const actividadesUnicasMes = [
      ...new Set(
        asignacionesMes
          .map((a) => a.actividadId?._id?.toString())
          .filter(Boolean)
      ),
    ].length;

    const estimacionSueldoMes =
      precioHora !== null ? totalHorasMes * precioHora : null;

    return res.status(200).json({
      ok: true,
      monitor,
      resumen: {
        year,
        month,
        totalHorasMes,
        totalAsignacionesMes,
        centrosUnicosMes,
        actividadesUnicasMes,
        asignacionesHoy: asignacionesHoy.length,
        estimacionSueldoMes,
        precioHoraUsado: precioHora,
      },
      hoy: asignacionesHoy,
      proximaAsignacion,
      ultimasAsignaciones: asignacionesMes.slice(-10).reverse(),
    });
  } catch (error) {
    console.error('Error al obtener resumen del monitor:', error);
    return res.status(500).json({
      ok: false,
      msg: 'Error interno al obtener el resumen del monitor',
    });
  }
};

/**
 * PUT /api/monitores/:id
 * Solo actualiza campos que existen en tu modelo actual
 */
exports.updateMonitor = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, activo, telefono, email, fcmToken, avisos } = req.body;

    if (!esObjectIdValido(id)) {
      return res.status(400).json({
        ok: false,
        msg: 'ID de monitor no válido',
      });
    }

    if (avisos !== undefined && typeof avisos !== 'string') {
      return res.status(400).json({
        ok: false,
        msg: 'El campo avisos debe ser un texto',
      });
    }

    const monitor = await Usuario.findOne({ _id: id, rol: 'monitor' });

    if (!monitor) {
      return res.status(404).json({
        ok: false,
        msg: 'Monitor no encontrado',
      });
    }

    if (nombre !== undefined) {
      monitor.nombre = nombre.trim().toLowerCase();
    }

    if (activo !== undefined) {
      monitor.activo = activo;
    }

    if (telefono !== undefined) {
      monitor.telefono = telefono?.trim() || null;
    }

    if (email !== undefined) {
      monitor.email = email?.trim().toLowerCase() || null;
    }

    if (fcmToken !== undefined) {
      monitor.fcmToken = fcmToken || null;
    }

    const avisosAnteriores = (monitor.avisos || '').trim();

    if (avisos !== undefined) {
      monitor.avisos = avisos.trim();
    }

    await monitor.save();

    const avisosActuales = (monitor.avisos || '').trim();
    const debeEnviarPush =
      avisos !== undefined &&
      avisosActuales.length > 0 &&
      avisosActuales !== avisosAnteriores &&
      !!monitor.fcmToken;

    if (debeEnviarPush) {
      const titulo = 'Nuevo aviso de coordinación';
      const cuerpo = avisosActuales.length > 120
        ? `${avisosActuales.substring(0, 117)}...`
        : avisosActuales;

      await sendPush(monitor.fcmToken, titulo, cuerpo);
      console.log(titulo);
      console.log(cuerpo);
    }

    return res.status(200).json({
      ok: true,
      monitor,
    });
  } catch (error) {
    console.error('Error al actualizar monitor:', error);
    return res.status(500).json({
      ok: false,
      msg: 'Error interno al actualizar el monitor',
    });
  }
};