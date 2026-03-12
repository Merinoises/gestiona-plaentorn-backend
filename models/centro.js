const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const CentroSchema = new Schema(
  {
    nombre: {
      type: String,
      required: true,
      trim: true,
    },
    ubicacion: {
      type: String,
      required: true,
      trim: true,
    },
    activo: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

CentroSchema.index({ nombre: 1 });

module.exports = model('Centro', CentroSchema);
