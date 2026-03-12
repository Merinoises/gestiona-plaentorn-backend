const mongoose = require('mongoose');
const Asignacion = require('../models/asignacion');
const Usuario = require('../models/usuario');
const Centro = require('../models/centro');
const Actividad = require('../models/actividad');

const { sendPush } = require('../helpers/notifications');

const TIME_ZONE = 'Europe/Madrid';

function esObjectIdValido(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function obtenerPartesEnMadrid(date) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(date);

  const get = (type) => parts.find((p) => p.type === type)?.value;

  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    second: Number(get('second')),
  };
}

function obtenerWeekdayEuropeo(date) {
  const p = obtenerPartesEnMadrid(date);
  const utc = new Date(Date.UTC(p.year, p.month - 1, p.day));
  const day = utc.getUTCDay(); // 0 domingo, 1 lunes, ..., 6 sábado
  return day === 0 ? 7 : day;
}

function minutosDelDia(date) {
  const p = obtenerPartesEnMadrid(date);
  return p.hour * 60 + p.minute;
}

function mismaFecha(a, b) {
  const pa = obtenerPartesEnMadrid(a);
  const pb = obtenerPartesEnMadrid(b);

  return (
    pa.year === pb.year &&
    pa.month === pb.month &&
    pa.day === pb.day
  );
}

function asignacionCabeEnBloque(start, end, bloque) {
  const weekday = obtenerWeekdayEuropeo(start);
  if (!bloque.weekdays.includes(weekday)) {
    return false;
  }

  if (!mismaFecha(start, end)) {
    return false;
  }

  const inicioAsignacion = minutosDelDia(start);
  const finAsignacion = minutosDelDia(end);

  const inicioBloque = bloque.startHour * 60 + bloque.startMinute;
  const finBloque = bloque.endHour * 60 + bloque.endMinute;

  return inicioAsignacion >= inicioBloque && finAsignacion <= finBloque;
}

function encontrarBloqueCompatible(start, end, bloquesHorarios) {
  for (const bloque of bloquesHorarios) {
    if (asignacionCabeEnBloque(start, end, bloque)) {
      return bloque;
    }
  }
  return null;
}

function convertirHoraLocalMadridAUtc(year, month, day, hour = 0, minute = 0) {
  let utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));

  for (let i = 0; i < 3; i++) {
    const p = obtenerPartesEnMadrid(utcDate);

    const deseado = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
    const actual = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0, 0);

    const diffMs = deseado - actual;
    if (diffMs === 0) break;

    utcDate = new Date(utcDate.getTime() + diffMs);
  }

  return utcDate;
}

function obtenerRangoUtcDeDiaMadrid(fechaStr) {
  const [yearStr, monthStr, dayStr] = fechaStr.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (!year || !month || !day) {
    throw new Error('Fecha no válida');
  }

  const inicioDia = convertirHoraLocalMadridAUtc(year, month, day, 0, 0);

  const siguienteDiaUtc = new Date(Date.UTC(year, month - 1, day));
  siguienteDiaUtc.setUTCDate(siguienteDiaUtc.getUTCDate() + 1);

  const finExclusivo = convertirHoraLocalMadridAUtc(
    siguienteDiaUtc.getUTCFullYear(),
    siguienteDiaUtc.getUTCMonth() + 1,
    siguienteDiaUtc.getUTCDate(),
    0,
    0
  );

  return { inicioDia, finExclusivo };
}

async function popularAsignacion(asignacionId) {
  return Asignacion.findById(asignacionId)
    .populate('monitorId', 'nombre rol activo')
    .populate('centroId', 'nombre ubicacion activo')
    .populate('actividadId', 'nombre descripcion centroId activo');
}

function formatearFechaHoraAsignacion(inicio, fin) {
  return {
    fecha: inicio.toLocaleDateString('es-ES', {
      timeZone: 'Europe/Madrid',
    }),
    horaInicio: inicio.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Europe/Madrid',
    }),
    horaFin: fin.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Europe/Madrid',
    }),
  };
}

function haCambiadoAsignacion({
  monitorAnteriorId,
  nuevoMonitorId,
  centroAnteriorId,
  nuevoCentroId,
  actividadAnteriorId,
  nuevaActividadId,
  startAnterior,
  nuevoStart,
  endAnterior,
  nuevoEnd,
  observacionesAnteriores,
  nuevasObservaciones,
  estadoAnterior,
  nuevoEstado,
}) {
  return (
    monitorAnteriorId !== nuevoMonitorId ||
    centroAnteriorId !== nuevoCentroId ||
    actividadAnteriorId !== nuevaActividadId ||
    new Date(startAnterior).getTime() !== new Date(nuevoStart).getTime() ||
    new Date(endAnterior).getTime() !== new Date(nuevoEnd).getTime() ||
    (observacionesAnteriores || '') !== (nuevasObservaciones || '') ||
    estadoAnterior !== nuevoEstado
  );
}

/**
 * POST /api/asignaciones
 */
exports.crearAsignacion = async (req, res) => {
  try {
    const {
      monitorId,
      centroId,
      actividadId,
      bloqueHorarioId,
      start,
      end,
      observaciones,
      estado,
    } = req.body;

    if (!monitorId || !centroId || !actividadId || !start || !end) {
      return res.status(400).json({
        ok: false,
        msg: 'Debe enviar monitorId, centroId, actividadId, start y end',
      });
    }

    if (
      !esObjectIdValido(monitorId) ||
      !esObjectIdValido(centroId) ||
      !esObjectIdValido(actividadId)
    ) {
      return res.status(400).json({
        ok: false,
        msg: 'Algún identificador no es válido',
      });
    }

    const fechaInicio = new Date(start);
    const fechaFin = new Date(end);

    if (isNaN(fechaInicio.getTime()) || isNaN(fechaFin.getTime())) {
      return res.status(400).json({
        ok: false,
        msg: 'Las fechas start/end no son válidas',
      });
    }

    if (fechaInicio >= fechaFin) {
      return res.status(400).json({
        ok: false,
        msg: 'La fecha de fin debe ser posterior a la de inicio',
      });
    }

    if (!mismaFecha(fechaInicio, fechaFin)) {
      return res.status(400).json({
        ok: false,
        msg: 'La asignación debe empezar y terminar el mismo día',
      });
    }

    const [monitor, centro, actividad] = await Promise.all([
      Usuario.findById(monitorId),
      Centro.findById(centroId),
      Actividad.findById(actividadId),
    ]);

    if (!monitor) {
      return res.status(404).json({
        ok: false,
        msg: 'Monitor no encontrado',
      });
    }

    if (monitor.rol !== 'monitor') {
      return res.status(400).json({
        ok: false,
        msg: 'El usuario indicado no tiene rol monitor',
      });
    }

    if (!centro) {
      return res.status(404).json({
        ok: false,
        msg: 'Centro no encontrado',
      });
    }

    if (!actividad) {
      return res.status(404).json({
        ok: false,
        msg: 'Actividad no encontrada',
      });
    }

    if (actividad.centroId.toString() !== centroId) {
      return res.status(400).json({
        ok: false,
        msg: 'La actividad no pertenece al centro indicado',
      });
    }

    let bloqueCompatible = null;

    if (bloqueHorarioId) {
      bloqueCompatible = actividad.bloquesHorarios.id(bloqueHorarioId);

      if (!bloqueCompatible) {
        return res.status(400).json({
          ok: false,
          msg: 'El bloqueHorarioId no existe dentro de la actividad',
        });
      }

      if (!asignacionCabeEnBloque(fechaInicio, fechaFin, bloqueCompatible)) {
        return res.status(400).json({
          ok: false,
          msg: 'La asignación no encaja dentro del bloque horario indicado',
        });
      }
    } else {
      bloqueCompatible = encontrarBloqueCompatible(
        fechaInicio,
        fechaFin,
        actividad.bloquesHorarios
      );

      if (!bloqueCompatible) {
        return res.status(400).json({
          ok: false,
          msg: 'La asignación no encaja en ningún bloque horario de la actividad',
        });
      }
    }

    const solape = await Asignacion.findOne({
      monitorId,
      estado: { $ne: 'cancelada' },
      start: { $lt: fechaFin },
      end: { $gt: fechaInicio },
    });

    if (solape) {
      return res.status(400).json({
        ok: false,
        msg: 'El monitor ya tiene otra asignación en esa franja horaria',
      });
    }

    const asignacion = new Asignacion({
      monitorId,
      centroId,
      actividadId,
      bloqueHorarioId: bloqueCompatible?._id || null,
      start: fechaInicio,
      end: fechaFin,
      observaciones: observaciones?.trim() || '',
      estado: estado || 'confirmada',
    });

    await asignacion.save();

    const asignacionPopulada = await popularAsignacion(asignacion._id);

    const { fecha, horaInicio, horaFin } = formatearFechaHoraAsignacion(
      fechaInicio,
      fechaFin
    );

    // ─── Envío del push ───
    if (monitor.fcmToken) {
      const titulo = 'Actividad asignada';
      const cuerpo = `Se te ha asignado la actividad ${actividad.nombre} el ${fecha} de ${horaInicio} a ${horaFin} en ${centro.nombre}`;
      await sendPush(monitor.fcmToken, titulo, cuerpo);
      console.log(titulo);
      console.log(cuerpo);
    }

    return res.status(201).json({
      ok: true,
      asignacion: asignacionPopulada,
    });
  } catch (error) {
    console.error('Error al crear asignación:', error);
    return res.status(500).json({
      ok: false,
      msg: 'Hable con el administrador',
    });
  }
};

/**
 * GET /api/asignaciones
 * Admite filtros opcionales por query:
 * ?monitorId=
 * ?centroId=
 * ?actividadId=
 * ?fecha=2026-03-09
 */
exports.getAsignaciones = async (req, res) => {
  try {
    const { monitorId, centroId, actividadId, fecha } = req.query;

    const filtro = {};

    if (monitorId) {
      if (!esObjectIdValido(monitorId)) {
        return res.status(400).json({
          ok: false,
          msg: 'monitorId no válido',
        });
      }
      filtro.monitorId = monitorId;
    }

    if (centroId) {
      if (!esObjectIdValido(centroId)) {
        return res.status(400).json({
          ok: false,
          msg: 'centroId no válido',
        });
      }
      filtro.centroId = centroId;
    }

    if (actividadId) {
      if (!esObjectIdValido(actividadId)) {
        return res.status(400).json({
          ok: false,
          msg: 'actividadId no válido',
        });
      }
      filtro.actividadId = actividadId;
    }

    if (fecha) {
      let inicioDia;
      let finExclusivo;

      try {
        ({ inicioDia, finExclusivo } = obtenerRangoUtcDeDiaMadrid(fecha));
      } catch (_) {
        return res.status(400).json({
          ok: false,
          msg: 'Fecha no válida. Usa formato YYYY-MM-DD',
        });
      }

      filtro.start = { $lt: finExclusivo };
      filtro.end = { $gte: inicioDia };
    }

    const asignaciones = await Asignacion.find(filtro)
      .populate('monitorId', 'nombre rol activo')
      .populate('centroId', 'nombre ubicacion activo')
      .populate('actividadId', 'nombre descripcion centroId activo')
      .sort({ start: 1 });

    return res.status(200).json({
      ok: true,
      asignaciones,
    });
  } catch (error) {
    console.error('Error al obtener asignaciones:', error);
    return res.status(500).json({
      ok: false,
      msg: 'Error interno al obtener asignaciones',
    });
  }
};

/**
 * GET /api/asignaciones/:id
 */
exports.getAsignacionById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!esObjectIdValido(id)) {
      return res.status(400).json({
        ok: false,
        msg: 'ID de asignación no válido',
      });
    }

    const asignacion = await popularAsignacion(id);

    if (!asignacion) {
      return res.status(404).json({
        ok: false,
        msg: 'Asignación no encontrada',
      });
    }

    return res.status(200).json({
      ok: true,
      asignacion,
    });
  } catch (error) {
    console.error('Error al obtener asignación:', error);
    return res.status(500).json({
      ok: false,
      msg: 'Error interno al obtener asignación',
    });
  }
};

/**
 * GET /api/asignaciones/monitor/:monitorId
 */
exports.getAsignacionesByMonitor = async (req, res) => {
  try {
    const { monitorId } = req.params;

    if (!esObjectIdValido(monitorId)) {
      return res.status(400).json({
        ok: false,
        msg: 'ID de monitor no válido',
      });
    }

    const asignaciones = await Asignacion.find({ monitorId })
      .populate('monitorId', 'nombre rol activo')
      .populate('centroId', 'nombre ubicacion activo')
      .populate('actividadId', 'nombre descripcion centroId activo')
      .sort({ start: 1 });

    return res.status(200).json({
      ok: true,
      asignaciones,
    });
  } catch (error) {
    console.error('Error al obtener asignaciones del monitor:', error);
    return res.status(500).json({
      ok: false,
      msg: 'Error interno al obtener asignaciones del monitor',
    });
  }
};

/**
 * GET /api/asignaciones/centro/:centroId
 */
exports.getAsignacionesByCentro = async (req, res) => {
  try {
    const { centroId } = req.params;

    if (!esObjectIdValido(centroId)) {
      return res.status(400).json({
        ok: false,
        msg: 'ID de centro no válido',
      });
    }

    const asignaciones = await Asignacion.find({ centroId })
      .populate('monitorId', 'nombre rol activo')
      .populate('centroId', 'nombre ubicacion activo')
      .populate('actividadId', 'nombre descripcion centroId activo')
      .sort({ start: 1 });

    return res.status(200).json({
      ok: true,
      asignaciones,
    });
  } catch (error) {
    console.error('Error al obtener asignaciones del centro:', error);
    return res.status(500).json({
      ok: false,
      msg: 'Error interno al obtener asignaciones del centro',
    });
  }
};

/**
 * PUT /api/asignaciones/:id
 */
exports.updateAsignacion = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      monitorId,
      centroId,
      actividadId,
      bloqueHorarioId,
      start,
      end,
      observaciones,
      estado,
    } = req.body;

    if (!esObjectIdValido(id)) {
      return res.status(400).json({
        ok: false,
        msg: 'ID de asignación no válido',
      });
    }

    if (!monitorId || !centroId || !actividadId || !start || !end) {
      return res.status(400).json({
        ok: false,
        msg: 'Debe enviar monitorId, centroId, actividadId, start y end',
      });
    }

    if (
      !esObjectIdValido(monitorId) ||
      !esObjectIdValido(centroId) ||
      !esObjectIdValido(actividadId)
    ) {
      return res.status(400).json({
        ok: false,
        msg: 'Algún identificador no es válido',
      });
    }

    const asignacionExistente = await Asignacion.findById(id);
    if (!asignacionExistente) {
      return res.status(404).json({
        ok: false,
        msg: 'Asignación no encontrada',
      });
    }

    // Guardamos foto del estado anterior
    const monitorAnteriorId = asignacionExistente.monitorId?.toString();
    const centroAnteriorId = asignacionExistente.centroId?.toString();
    const actividadAnteriorId = asignacionExistente.actividadId?.toString();
    const startAnterior = new Date(asignacionExistente.start);
    const endAnterior = new Date(asignacionExistente.end);
    const observacionesAnteriores = asignacionExistente.observaciones || '';
    const estadoAnterior = asignacionExistente.estado;

    const fechaInicio = new Date(start);
    const fechaFin = new Date(end);

    if (isNaN(fechaInicio.getTime()) || isNaN(fechaFin.getTime())) {
      return res.status(400).json({
        ok: false,
        msg: 'Las fechas start/end no son válidas',
      });
    }

    if (fechaInicio >= fechaFin) {
      return res.status(400).json({
        ok: false,
        msg: 'La fecha de fin debe ser posterior a la de inicio',
      });
    }

    if (!mismaFecha(fechaInicio, fechaFin)) {
      return res.status(400).json({
        ok: false,
        msg: 'La asignación debe empezar y terminar el mismo día',
      });
    }

    const [
      monitorNuevo,
      centroNuevo,
      actividadNueva,
      monitorAnterior,
      centroAnterior,
      actividadAnterior,
    ] = await Promise.all([
      Usuario.findById(monitorId),
      Centro.findById(centroId),
      Actividad.findById(actividadId),
      esObjectIdValido(monitorAnteriorId) ? Usuario.findById(monitorAnteriorId) : null,
      esObjectIdValido(centroAnteriorId) ? Centro.findById(centroAnteriorId) : null,
      esObjectIdValido(actividadAnteriorId) ? Actividad.findById(actividadAnteriorId) : null,
    ]);

    if (!monitorNuevo) {
      return res.status(404).json({
        ok: false,
        msg: 'Monitor no encontrado',
      });
    }

    if (monitorNuevo.rol !== 'monitor') {
      return res.status(400).json({
        ok: false,
        msg: 'El usuario indicado no tiene rol monitor',
      });
    }

    if (!centroNuevo) {
      return res.status(404).json({
        ok: false,
        msg: 'Centro no encontrado',
      });
    }

    if (!actividadNueva) {
      return res.status(404).json({
        ok: false,
        msg: 'Actividad no encontrada',
      });
    }

    if (actividadNueva.centroId.toString() !== centroId) {
      return res.status(400).json({
        ok: false,
        msg: 'La actividad no pertenece al centro indicado',
      });
    }

    let bloqueCompatible = null;

    if (bloqueHorarioId) {
      bloqueCompatible = actividadNueva.bloquesHorarios.id(bloqueHorarioId);

      if (!bloqueCompatible) {
        return res.status(400).json({
          ok: false,
          msg: 'El bloqueHorarioId no existe dentro de la actividad',
        });
      }

      if (!asignacionCabeEnBloque(fechaInicio, fechaFin, bloqueCompatible)) {
        return res.status(400).json({
          ok: false,
          msg: 'La asignación no encaja dentro del bloque horario indicado',
        });
      }
    } else {
      bloqueCompatible = encontrarBloqueCompatible(
        fechaInicio,
        fechaFin,
        actividadNueva.bloquesHorarios
      );

      if (!bloqueCompatible) {
        return res.status(400).json({
          ok: false,
          msg: 'La asignación no encaja en ningún bloque horario de la actividad',
        });
      }
    }

    const solape = await Asignacion.findOne({
      _id: { $ne: id },
      monitorId,
      estado: { $ne: 'cancelada' },
      start: { $lt: fechaFin },
      end: { $gt: fechaInicio },
    });

    if (solape) {
      return res.status(400).json({
        ok: false,
        msg: 'El monitor ya tiene otra asignación en esa franja horaria',
      });
    }

    const nuevasObservaciones = observaciones?.trim() || '';
    const nuevoEstado = estado || asignacionExistente.estado;

    const seHaModificado = haCambiadoAsignacion({
      monitorAnteriorId,
      nuevoMonitorId: monitorId,
      centroAnteriorId,
      nuevoCentroId: centroId,
      actividadAnteriorId,
      nuevaActividadId: actividadId,
      startAnterior,
      nuevoStart: fechaInicio,
      endAnterior,
      nuevoEnd: fechaFin,
      observacionesAnteriores,
      nuevasObservaciones,
      estadoAnterior,
      nuevoEstado,
    });

    const haCambiadoMonitor = monitorAnteriorId !== monitorId;

    asignacionExistente.monitorId = monitorId;
    asignacionExistente.centroId = centroId;
    asignacionExistente.actividadId = actividadId;
    asignacionExistente.bloqueHorarioId = bloqueCompatible?._id || null;
    asignacionExistente.start = fechaInicio;
    asignacionExistente.end = fechaFin;
    asignacionExistente.observaciones = nuevasObservaciones;
    asignacionExistente.estado = nuevoEstado;

    await asignacionExistente.save();

    const asignacionActualizada = await popularAsignacion(asignacionExistente._id);

    // Notificaciones push
    if (seHaModificado) {
      const datosNuevos = formatearFechaHoraAsignacion(fechaInicio, fechaFin);
      const datosAnteriores = formatearFechaHoraAsignacion(startAnterior, endAnterior);

      if (haCambiadoMonitor) {
        if (monitorNuevo?.fcmToken) {
          try {
            const titulo = 'Nueva actividad asignada';
            const cuerpo =
              `Se te ha asignado la actividad ${actividadNueva.nombre} ` +
              `el ${datosNuevos.fecha} de ${datosNuevos.horaInicio} a ${datosNuevos.horaFin} ` +
              `en ${centroNuevo.nombre}`;
            await sendPush(monitorNuevo.fcmToken, titulo, cuerpo);
          } catch (error) {
            console.error('Error enviando push al nuevo monitor:', error);
          }
        }

        if (monitorAnterior?.fcmToken) {
          try {
            const titulo = 'Actividad desasignada';
            const cuerpo =
              `Ya no tienes asignada la actividad ${actividadAnterior?.nombre || actividadNueva.nombre} ` +
              `del ${datosAnteriores.fecha} de ${datosAnteriores.horaInicio} a ${datosAnteriores.horaFin} ` +
              `en ${centroAnterior?.nombre || centroNuevo.nombre}`;
            await sendPush(monitorAnterior.fcmToken, titulo, cuerpo);
          } catch (error) {
            console.error('Error enviando push al monitor anterior:', error);
          }
        }
      } else {
        if (monitorNuevo?.fcmToken) {
          try {
            const titulo = 'Asignación modificada';
            const cuerpo =
              `Se ha modificado tu actividad ${actividadNueva.nombre} ` +
              `para el ${datosNuevos.fecha} de ${datosNuevos.horaInicio} a ${datosNuevos.horaFin} ` +
              `en ${centroNuevo.nombre}`;
            await sendPush(monitorNuevo.fcmToken, titulo, cuerpo);
          } catch (error) {
            console.error('Error enviando push por modificación:', error);
          }
        }
      }
    }

    return res.status(200).json({
      ok: true,
      asignacion: asignacionActualizada,
    });
  } catch (error) {
    console.error('Error al actualizar asignación:', error);
    return res.status(500).json({
      ok: false,
      msg: 'Error interno al actualizar asignación',
    });
  }
};

/**
 * DELETE /api/asignaciones/:id
 */
exports.deleteAsignacion = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(id);

    if (!esObjectIdValido(id)) {
      return res.status(400).json({
        ok: false,
        msg: 'ID de asignación no válido',
      });
    }

    const asignacion = await Asignacion.findById(id);

    if (!asignacion) {
      return res.status(404).json({
        ok: false,
        msg: 'Asignación no encontrada',
      });
    }

    await Asignacion.findByIdAndDelete(id);

    return res.status(200).json({
      ok: true,
      msg: 'Asignación eliminada correctamente',
    });
  } catch (error) {
    console.error('Error al eliminar asignación:', error);
    return res.status(500).json({
      ok: false,
      msg: 'Error interno al eliminar asignación',
    });
  }
};