const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const UsuarioSchema = new Schema(
  {
    nombre: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    rol: {
      type: String,
      enum: ['admin', 'monitor', 'observador'],
      default: 'monitor',
      required: true,
    },
    fcmToken: {
      type: String,
      default: null,
    },
    activo: {
      type: Boolean,
      default: true,
    },
    telefono: {
      type: String,
      default: null,
    },
    email: {
      type: String,
      default: null,
      trim: true,
      lowercase: true,
    },
    avisos: {
      type: String,
      default: null, // o '' si prefieres cadena vacía
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

UsuarioSchema.index({ nombre: 1 }, { unique: true });
UsuarioSchema.index({ email: 1 }, { sparse: true });

module.exports = model('Usuario', UsuarioSchema);