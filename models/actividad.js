const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const BloqueHorarioSchema = new Schema(
  {
    weekdays: {
      type: [Number],
      enum: [1, 2, 3, 4, 5, 6, 7],
      required: true,
      default: [],
    },
    startHour: {
      type: Number,
      required: true,
      min: 0,
      max: 23,
    },
    startMinute: {
      type: Number,
      required: true,
      min: 0,
      max: 59,
    },
    endHour: {
      type: Number,
      required: true,
      min: 0,
      max: 23,
    },
    endMinute: {
      type: Number,
      required: true,
      min: 0,
      max: 59,
    },
  },
  { _id: true }
);

const ActividadSchema = new Schema(
  {
    nombre: {
      type: String,
      required: true,
      trim: true,
    },
    descripcion: {
      type: String,
      default: '',
      trim: true,
    },
    centroId: {
      type: Schema.Types.ObjectId,
      ref: 'Centro',
      required: true,
    },
    bloquesHorarios: {
      type: [BloqueHorarioSchema],
      default: [],
    },
    activo: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

ActividadSchema.index({ centroId: 1, nombre: 1 });

module.exports = model('Actividad', ActividadSchema);