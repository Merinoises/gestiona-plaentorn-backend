const mongoose = require('mongoose');
const Actividad = require('../models/actividad');
const Centro = require('../models/centro');
const Asignacion = require('../models/asignacion');

function esObjectIdValido(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function validarBloqueHorario(bloque) {
  if (!bloque) {
    return 'Bloque horario no enviado';
  }

  const {
    weekdays,
    startHour,
    startMinute,
    endHour,
    endMinute,
  } = bloque;

  if (!Array.isArray(weekdays) || weekdays.length === 0) {
    return 'Cada bloque debe tener al menos un weekday';
  }

  const weekdaysValidos = weekdays.every((d) =>
    Number.isInteger(d) && d >= 1 && d <= 7
  );
  if (!weekdaysValidos) {
    return 'Los weekdays deben ser números enteros entre 1 y 7';
  }

  const camposHora = [startHour, startMinute, endHour, endMinute];
  const hayCampoInvalido = camposHora.some((v) => !Number.isInteger(v));
  if (hayCampoInvalido) {
    return 'Las horas y minutos deben ser números enteros';
  }

  if (startHour < 0 || startHour > 23 || endHour < 0 || endHour > 23) {
    return 'Las horas deben estar entre 0 y 23';
  }

  if (startMinute < 0 || startMinute > 59 || endMinute < 0 || endMinute > 59) {
    return 'Los minutos deben estar entre 0 y 59';
  }

  const inicio = startHour * 60 + startMinute;
  const fin = endHour * 60 + endMinute;

  if (inicio >= fin) {
    return 'La hora de fin debe ser posterior a la de inicio';
  }

  return null;
}

function validarBloquesHorarios(bloquesHorarios) {
  if (bloquesHorarios === undefined) return null;

  if (!Array.isArray(bloquesHorarios)) {
    return 'bloquesHorarios debe ser un array';
  }

  for (const bloque of bloquesHorarios) {
    const error = validarBloqueHorario(bloque);
    if (error) return error;
  }

  return null;
}

/**
 * POST /api/actividades
 */
exports.crearActividad = async (req, res) => {
  try {
    const {
      nombre,
      descripcion,
      centroId,
      bloquesHorarios = [],
      activo,
    } = req.body;

    if (!nombre || !centroId) {
      return res.status(400).json({
        ok: false,
        msg: 'Debe enviar al menos nombre y centroId',
      });
    }

    if (!esObjectIdValido(centroId)) {
      return res.status(400).json({
        ok: false,
        msg: 'centroId no es válido',
      });
    }

    const errorBloques = validarBloquesHorarios(bloquesHorarios);
    if (errorBloques) {
      return res.status(400).json({
        ok: false,
        msg: errorBloques,
      });
    }

    const centro = await Centro.findById(centroId);
    if (!centro) {
      return res.status(404).json({
        ok: false,
        msg: 'Centro no encontrado',
      });
    }

    const existeActividad = await Actividad.findOne({
      nombre: nombre.trim(),
      centroId,
    });

    if (existeActividad) {
      return res.status(400).json({
        ok: false,
        msg: 'Ya existe una actividad con ese nombre en ese centro',
      });
    }

    const actividad = new Actividad({
      nombre: nombre.trim(),
      descripcion: descripcion?.trim() || '',
      centroId,
      bloquesHorarios,
      activo: activo ?? true,
    });

    const savedActividad = await actividad.save();

    const actividadPopulada = await Actividad.findById(savedActividad._id)
      .populate('centroId', 'nombre ubicacion');

    return res.status(201).json({
      ok: true,
      actividad: actividadPopulada,
    });
  } catch (error) {
    console.error('Error al crear actividad:', error);
    return res.status(500).json({
      ok: false,
      msg: 'Hable con el administrador',
    });
  }
};

/**
 * GET /api/actividades
 */
exports.getAllActividades = async (req, res) => {
  try {
    const actividades = await Actividad.find()
      .populate('centroId', 'nombre ubicacion')
      .sort({ nombre: 1 });

    return res.status(200).json({
      ok: true,
      actividades,
    });
  } catch (error) {
    console.error('Error al obtener actividades:', error);
    return res.status(500).json({
      ok: false,
      msg: 'Error en el servidor al obtener actividades',
    });
  }
};

/**
 * GET /api/actividades/:id
 */
exports.getActividadById = async (req, res) => {
  try {
    const actividadId = req.params.id;

    if (!esObjectIdValido(actividadId)) {
      return res.status(400).json({
        ok: false,
        msg: 'ID de actividad no válido',
      });
    }

    const actividad = await Actividad.findById(actividadId)
      .populate('centroId', 'nombre ubicacion');

    if (!actividad) {
      return res.status(404).json({
        ok: false,
        msg: 'Actividad no encontrada',
      });
    }

    return res.status(200).json({
      ok: true,
      actividad,
    });
  } catch (error) {
    console.error('Error al obtener actividad:', error);
    return res.status(500).json({
      ok: false,
      msg: 'Error interno al obtener actividad',
    });
  }
};

/**
 * GET /api/actividades/centro/:centroId
 */
exports.getActividadesByCentro = async (req, res) => {
  try {
    const { centroId } = req.params;

    if (!esObjectIdValido(centroId)) {
      return res.status(400).json({
        ok: false,
        msg: 'ID de centro no válido',
      });
    }

    const centro = await Centro.findById(centroId);
    if (!centro) {
      return res.status(404).json({
        ok: false,
        msg: 'Centro no encontrado',
      });
    }

    const actividades = await Actividad.find({ centroId })
      .populate('centroId', 'nombre ubicacion')
      .sort({ nombre: 1 });

    return res.status(200).json({
      ok: true,
      actividades,
    });
  } catch (error) {
    console.error('Error al obtener actividades del centro:', error);
    return res.status(500).json({
      ok: false,
      msg: 'Error interno al obtener actividades del centro',
    });
  }
};

/**
 * PUT /api/actividades/:id
 */
exports.updateActividad = async (req, res) => {
  try {
    const actividadId = req.params.id;
    const {
      nombre,
      descripcion,
      centroId,
      bloquesHorarios,
      activo,
    } = req.body;

    if (!esObjectIdValido(actividadId)) {
      return res.status(400).json({
        ok: false,
        msg: 'ID de actividad no válido',
      });
    }

    if (!nombre || !centroId) {
      return res.status(400).json({
        ok: false,
        msg: 'Debe enviar al menos nombre y centroId',
      });
    }

    if (!esObjectIdValido(centroId)) {
      return res.status(400).json({
        ok: false,
        msg: 'centroId no es válido',
      });
    }

    const errorBloques = validarBloquesHorarios(bloquesHorarios);
    if (errorBloques) {
      return res.status(400).json({
        ok: false,
        msg: errorBloques,
      });
    }

    const centro = await Centro.findById(centroId);
    if (!centro) {
      return res.status(404).json({
        ok: false,
        msg: 'Centro no encontrado',
      });
    }

    const duplicada = await Actividad.findOne({
      _id: { $ne: actividadId },
      nombre: nombre.trim(),
      centroId,
    });

    if (duplicada) {
      return res.status(400).json({
        ok: false,
        msg: 'Ya existe otra actividad con ese nombre en ese centro',
      });
    }

    const datosActualizar = {
      nombre: nombre.trim(),
      descripcion: descripcion?.trim() || '',
      centroId,
    };

    if (bloquesHorarios !== undefined) {
      datosActualizar.bloquesHorarios = bloquesHorarios;
    }

    if (activo !== undefined) {
      datosActualizar.activo = activo;
    }

    const actividadActualizada = await Actividad.findByIdAndUpdate(
      actividadId,
      datosActualizar,
      {
        new: true,
        runValidators: true,
      }
    ).populate('centroId', 'nombre ubicacion');

    if (!actividadActualizada) {
      return res.status(404).json({
        ok: false,
        msg: 'Actividad no encontrada',
      });
    }

    return res.status(200).json({
      ok: true,
      actividad: actividadActualizada,
    });
  } catch (error) {
    console.error('Error al actualizar actividad:', error);
    return res.status(500).json({
      ok: false,
      msg: 'Error interno al actualizar actividad',
    });
  }
};

/**
 * DELETE /api/actividades/:id
 * Elimina la actividad y sus asignaciones asociadas
 */
exports.deleteActividad = async (req, res) => {
  try {
    const actividadId = req.params.id;

    if (!esObjectIdValido(actividadId)) {
      return res.status(400).json({
        ok: false,
        msg: 'ID de actividad no válido',
      });
    }

    const actividad = await Actividad.findById(actividadId);

    if (!actividad) {
      return res.status(404).json({
        ok: false,
        msg: 'Actividad no encontrada',
      });
    }

    const resultadoAsignaciones = await Asignacion.deleteMany({ actividadId });
    await Actividad.findByIdAndDelete(actividadId);

    return res.status(200).json({
      ok: true,
      msg: 'Actividad eliminada correctamente',
      eliminadas: {
        asignaciones: resultadoAsignaciones.deletedCount,
      },
    });
  } catch (error) {
    console.error('Error al eliminar actividad:', error);
    return res.status(500).json({
      ok: false,
      msg: 'Error interno al eliminar actividad',
    });
  }
};