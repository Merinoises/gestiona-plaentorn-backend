const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const AsignacionSchema = new Schema(
  {
    monitorId: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
    },
    centroId: {
      type: Schema.Types.ObjectId,
      ref: 'Centro',
      required: true,
    },
    actividadId: {
      type: Schema.Types.ObjectId,
      ref: 'Actividad',
      required: true,
    },
    bloqueHorarioId: {
      type: Schema.Types.ObjectId,
      required: false,
      default: null,
    },
    start: {
      type: Date,
      required: true,
    },
    end: {
      type: Date,
      required: true,
    },
    observaciones: {
      type: String,
      default: '',
      trim: true,
    },
    estado: {
      type: String,
      enum: ['confirmada', 'cancelada'],
      default: 'confirmada',
    },
  },
  { timestamps: true }
);

AsignacionSchema.index({ monitorId: 1, start: 1, end: 1 });
AsignacionSchema.index({ centroId: 1, start: 1, end: 1 });
AsignacionSchema.index({ actividadId: 1, start: 1, end: 1 });

module.exports = model('Asignacion', AsignacionSchema);