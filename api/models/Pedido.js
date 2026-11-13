// models/Pedido.js
// 🧾 Pedidos por encargo (contrapedido) que registran los empleados desde /admin.
// No tocan el stock: son camisetas que se le piden al proveedor.
//
// Flujo semanal:
//   Nuevo         → "Por revisar": lo registró un empleado; Johanna lo revisa (lo editan él o Johanna)
//   Por confirmar → Johanna lo mandó a confirmar: el empleado que lo registró le manda la imagen al cliente
//                   (si el empleado lo edita, vuelve a Por revisar)
//   Confirmado    → el cliente confirmó: entra oficialmente al pedido de la semana (solo Johanna/súper lo editan)
//   Pedido        → el viernes se "cierra la semana": todos los Confirmado pasan a un PedidoLote (#1, #2…). Ya no se editan.
//   Llegó      → llegó el pedido semanal al proveedor → todos sus pedidos quedan listos para avisar
//   Avisado    → se le escribió al cliente por WhatsApp
//   Completado → se le entregó
import mongoose from 'mongoose';

export const ESTADOS_PEDIDO = ['Nuevo', 'Por confirmar', 'Confirmado', 'Pedido', 'Llegó', 'Avisado', 'Completado'];
// Estados "cerrados": a partir de aquí corre el tiempo de borrado automático (ver utils/pedidosLimpieza.js)
export const ESTADOS_CERRADOS = ['Completado'];
// Estados que cada empleado puede marcar a mano (después de que llegó el pedido semanal)
export const ESTADOS_ENTREGA = ['Llegó', 'Avisado', 'Completado'];
export const METODOS_PAGO = ['', 'SINPE', 'Efectivo', 'Transferencia', 'Datáfono', 'Mixto'];
export const ENTREGAS = ['Correos de CR', 'Mensajero', 'Retiro en tienda', 'Otro'];
export const MANGAS = ['Corta', 'Larga'];
/** 📸 Todas las fotos de las camisetas de un pedido (frente/espalda + parche), para limpiar Cloudinary */
export const fotosDeItems = (items) => (items || []).flatMap((i) => [...(i?.fotos || []), ...(i?.fotoParche ? [i.fotoParche] : [])]);
// Estados de la semana en curso (antes de cerrar el pedido semanal)
export const ESTADOS_SEMANA = ['Nuevo', 'Por confirmar', 'Confirmado'];
export const METODOS_ABONO = ['SINPE', 'Efectivo', 'Transferencia', 'Datáfono'];

/** 💰 Pagado = adelanto + abonos; saldo = total − pagado (sirve con documentos lean o de Mongoose) */
export const pagadoDe = (p) => (p?.adelanto || 0) + (p?.abonos || []).reduce((a, x) => a + (x?.monto || 0), 0);
export const saldoDe = (p) => Math.max(0, (p?.total || 0) - pagadoDe(p));

// 💵 Abono: pago que hace el cliente después del adelanto (ej. abona ₡10.000 una semana antes de que llegue)
const AbonoSchema = new mongoose.Schema(
  {
    monto:  { type: Number, min: 1, required: true },
    metodo: { type: String, enum: [...METODOS_ABONO, ''], default: '' },
    nota:   { type: String, trim: true, maxlength: 200, default: '' },
    fecha:  { type: Date, default: Date.now },
    por:    { type: String, default: '' },
    porId:  { type: String, default: '' },
  },
  { _id: true }
);

const ItemSchema = new mongoose.Schema(
  {
    producto: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    equipo:   { type: String, trim: true, maxlength: 150, required: true }, // "Team" en el Excel
    version:  { type: String, trim: true, maxlength: 40, default: '' },    // Fan / Player / Retro…
    talla:    { type: String, trim: true, maxlength: 40, required: true },
    nombre:   { type: String, trim: true, maxlength: 40, default: '' },    // nombre en la espalda
    dorsal:   { type: String, trim: true, maxlength: 10, default: '' },    // número
    parche:   { type: String, trim: true, maxlength: 120, default: '' },    // parche en texto (Johanna a veces escribe, a veces pone foto)
    fotoParche: { type: String, default: '' },                              // 📸 foto del parche (opcional, Cloudinary products/pedidos)
    manga:    { type: String, enum: MANGAS, default: 'Corta' },             // Larga → "LONG SLEEVE" en la talla (como en la hoja)
    cantidad: { type: Number, min: 1, max: 99, default: 1 },
    precio:   { type: Number, min: 0, default: 0 },                         // precio unitario al cliente (₡)
    costoProveedor: { type: Number, min: 0, default: 0 },                   // "Price" del Excel (opcional)
    // 📸 Fotos de la camiseta (máx. 2): subidas al registrar el pedido (products/pedidos) o, en pedidos viejos, copia de las del catálogo
    fotos:    { type: [String], default: [] },
  },
  { _id: true }
);

const pedidoSchema = new mongoose.Schema(
  {
    numero: { type: Number, unique: true, index: true },
    fechaYMD: { type: String, required: true, index: true }, // YYYY-MM-DD (hora de Costa Rica)
    fecha: { type: String, required: true },                 // legible

    cliente: {
      nombre:    { type: String, trim: true, maxlength: 120, required: true },
      telefono:  { type: String, trim: true, maxlength: 30, default: '' },
      entrega:   { type: String, enum: ENTREGAS, default: 'Correos de CR' },
      direccion: { type: String, trim: true, maxlength: 400, default: '' },
    },

    items: {
      type: [ItemSchema],
      validate: { validator: (v) => Array.isArray(v) && v.length > 0 && v.length <= 50, message: 'El pedido necesita entre 1 y 50 camisetas.' },
    },

    total:    { type: Number, min: 0, default: 0 },
    adelanto: { type: Number, min: 0, default: 0 }, // "Pago" del Excel
    metodoPago: { type: String, enum: METODOS_PAGO, default: '' },
    abonos:   { type: [AbonoSchema], default: [] },
    notas:    { type: String, trim: true, maxlength: 1000, default: '' },

    estado: { type: String, enum: ESTADOS_PEDIDO, default: 'Nuevo', index: true },
    historialEstados: {
      type: [{ estado: String, por: String, fecha: { type: Date, default: Date.now }, _id: false }],
      default: [],
    },
    cerradoAt: { type: Date, default: null, index: true }, // cuándo pasó a Completado

    // 📦 Pedido semanal al que pertenece (se asigna al cerrar la semana)
    lote:       { type: mongoose.Schema.Types.ObjectId, ref: 'PedidoLote', default: null, index: true },
    loteNumero: { type: Number, default: null },

    avisado: {
      fecha: { type: Date, default: null },
      por:   { type: String, default: '' },
    },

    // 🚚 Guía de envío hecha desde el pedido (también queda en la lista de Guías)
    guia: {
      numero: { type: String, trim: true, maxlength: 60, default: '' },
      tipo:   { type: String, enum: ['', 'Correos', 'Mensajero'], default: '' },
      fecha:  { type: Date, default: null },
      por:    { type: String, default: '' },
    },

    registradoPor:   { type: String, default: '' },
    registradoPorId: { type: String, default: '' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

pedidoSchema.virtual('pagado').get(function () { return pagadoDe(this); });
pedidoSchema.virtual('saldo').get(function () { return saldoDe(this); });

pedidoSchema.pre('validate', function () {
  // precios enteros, igual que en Product
  for (const it of this.items || []) {
    it.precio = Math.trunc(Number(it.precio) || 0);
    it.cantidad = Math.max(1, Math.trunc(Number(it.cantidad) || 1));
  }
  this.total = (this.items || []).reduce((a, it) => a + it.precio * it.cantidad, 0);
  this.adelanto = Math.trunc(Number(this.adelanto) || 0);
});

pedidoSchema.index({ createdAt: -1 });

export default mongoose.model('Pedido', pedidoSchema);

/* 🔢 Contador para el número consecutivo del pedido */
const contadorSchema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } });
export const Contador = mongoose.models.Contador || mongoose.model('Contador', contadorSchema);

async function siguiente(id) {
  const c = await Contador.findOneAndUpdate({ _id: id }, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return c.seq;
}
export const siguienteNumeroPedido = () => siguiente('pedido');
export const siguienteNumeroLote = () => siguiente('lote');

/* 📦 Pedido semanal al proveedor (lo cierra el súper admin o Johanna, normalmente los viernes) */
const loteSchema = new mongoose.Schema(
  {
    numero:     { type: Number, unique: true, index: true },
    fechaYMD:   { type: String, required: true },
    fecha:      { type: String, required: true },
    cerradoPor: { type: String, default: '' },
    estado:     { type: String, enum: ['Pedido', 'Llegó'], default: 'Pedido' },
    llegoAt:    { type: Date, default: null },
    llegoPor:   { type: String, default: '' },
  },
  { timestamps: true }
);
export const PedidoLote = mongoose.models.PedidoLote || mongoose.model('PedidoLote', loteSchema);
