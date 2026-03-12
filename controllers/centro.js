const Centro = require('../models/centro');
const Actividad = require('../models/actividad');
const Asignacion = require('../models/asignacion');

/**
 * POST /api/centros
 * Crear un nuevo centro
 */
exports.crearCentro = async (req, res) => {
  try {
    const { nombre, ubicacion, activo } = req.body;

    if (!nombre || !ubicacion) {
      return res.status(400).json({
        ok: false,
        msg: 'Debe enviar nombre y ubicación',
      });
    }

    const existeCentro = await Centro.findOne({
      nombre: nombre.trim(),
      ubicacion: ubicacion.trim(),
    });

    if (existeCentro) {
      return res.status(400).json({
        ok: false,
        msg: 'Ya existe un centro con ese nombre y ubicación',
      });
    }

    const centro = new Centro({
      nombre: nombre.trim(),
      ubicacion: ubicacion.trim(),
      activo: activo ?? true,
    });

    const savedCentro = await centro.save();

    return res.status(201).json({
      ok: true,
      centro: savedCentro,
    });
  } catch (error) {
    console.error('Error al crear centro:', error);
    return res.status(500).json({
      ok: false,
      msg: 'Hable con el administrador',
    });
  }
};

/**
 * GET /api/centros
 * Obtener todos los centros
 */
exports.getAllCentros = async (req, res) => {
  try {
    const centros = await Centro.find().sort({ nombre: 1 });

    return res.status(200).json({
      ok: true,
      centros,
    });
  } catch (error) {
    console.error('Error al obtener centros:', error);
    return res.status(500).json({
      ok: false,
      msg: 'Error en el servidor al obtener centros',
    });
  }
};

/**
 * GET /api/centros/:id
 * Obtener un centro por ID
 */
exports.getCentroById = async (req, res) => {
  try {
    const centroId = req.params.id;

    const centro = await Centro.findById(centroId);

    if (!centro) {
      return res.status(404).json({
        ok: false,
        msg: 'Centro no encontrado',
      });
    }

    return res.status(200).json({
      ok: true,
      centro,
    });
  } catch (error) {
    console.error('Error al obtener centro:', error);
    return res.status(500).json({
      ok: false,
      msg: 'Error interno al obtener centro',
    });
  }
};

/**
 * PUT /api/centros/:id
 * Actualizar un centro existente
 */
exports.updateCentro = async (req, res) => {
  try {
    const centroId = req.params.id;
    const { nombre, ubicacion, activo } = req.body;

    if (!nombre || !ubicacion) {
      return res.status(400).json({
        ok: false,
        msg: 'Debe enviar nombre y ubicación',
      });
    }

    const centroExistente = await Centro.findOne({
      _id: { $ne: centroId },
      nombre: nombre.trim(),
      ubicacion: ubicacion.trim(),
    });

    if (centroExistente) {
      return res.status(400).json({
        ok: false,
        msg: 'Ya existe otro centro con ese nombre y ubicación',
      });
    }

    const actualizado = await Centro.findByIdAndUpdate(
      centroId,
      {
        nombre: nombre.trim(),
        ubicacion: ubicacion.trim(),
        ...(activo !== undefined && { activo }),
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!actualizado) {
      return res.status(404).json({
        ok: false,
        msg: `No existe un centro con ID ${centroId}`,
      });
    }

    return res.status(200).json({
      ok: true,
      centro: actualizado,
    });
  } catch (error) {
    console.error('Error al actualizar centro:', error);
    return res.status(500).json({
      ok: false,
      msg: 'Error interno al actualizar el centro',
    });
  }
};

/**
 * DELETE /api/centros/:id
 * Borra un centro y en cascada sus actividades y asignaciones
 */
exports.deleteCentro = async (req, res) => {
  try {
    const centroId = req.params.id;

    const centro = await Centro.findById(centroId);
    if (!centro) {
      return res.status(404).json({
        ok: false,
        msg: 'Centro no encontrado',
      });
    }

    // 1) Buscar actividades del centro
    const actividades = await Actividad.find({ centroId }).select('_id');
    const actividadIds = actividades.map((a) => a._id);

    // 2) Borrar asignaciones relacionadas con el centro
    const resultadoAsignaciones = await Asignacion.deleteMany({ centroId });

    // 3) Borrar actividades del centro
    const resultadoActividades = await Actividad.deleteMany({ centroId });

    // 4) Borrar el centro
    await Centro.findByIdAndDelete(centroId);

    return res.status(200).json({
      ok: true,
      msg: 'Centro eliminado correctamente',
      eliminadas: {
        asignaciones: resultadoAsignaciones.deletedCount,
        actividades: resultadoActividades.deletedCount,
      },
    });
  } catch (error) {
    console.error('Error al eliminar centro:', error);
    return res.status(500).json({
      ok: false,
      msg: 'Error interno al eliminar centro',
    });
  }
};
