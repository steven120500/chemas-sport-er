// scripts/cloudinaryOrphans.js
// -----------------------------------------------------------------------------
// Encuentra imágenes en Cloudinary que NINGÚN producto ni factura usa.
//
//   node scripts/cloudinaryOrphans.js                 -> SOLO REPORTE (no borra nada)
//   node scripts/cloudinaryOrphans.js --delete --yes  -> borra las huérfanas de carpetas "products*"
//
// Opciones:
//   --min-age-days=N   ignora imágenes subidas hace menos de N días (default 3),
//                      para no tocar algo que se está subiendo justo ahora
//   --all-folders      al borrar, incluye carpetas fuera de "products*" (por defecto NO)
//
// El reporte completo se guarda en scripts/output/cloudinary-orphans-<fecha>.json
// -----------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const { default: cloudinary, publicIdFromUrl } = await import('../config/cloudinary.js');
const { default: connectDB } = await import('../config/db.js');
const { default: Product } = await import('../models/Product.js');
const { default: TiendaFactura } = await import('../models/TiendaFactura.js');
const { default: Pedido } = await import('../models/Pedido.js');

// cloudinary.config() se ejecutó al importar; lo reafirmamos ya con el .env cargado
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const args = process.argv.slice(2);
const DELETE = args.includes('--delete') && args.includes('--yes');
const ALL_FOLDERS = args.includes('--all-folders');
const MIN_AGE_DAYS = Number((args.find((a) => a.startsWith('--min-age-days=')) || '').split('=')[1] || 3);

if (args.includes('--delete') && !args.includes('--yes')) {
  console.log('⚠️  Para borrar de verdad usá: --delete --yes   (sin --yes solo se genera el reporte)');
}

const fmtMB = (b) => `${(b / 1024 / 1024).toFixed(1)} MB`;
const CLD_URL_RX = /https?:\/\/res\.cloudinary\.com\/[^\s"'<>]+/gi;

await connectDB();

/* 1) Todo lo que la base de datos referencia */
const referenced = new Set();
const addUrl = (u) => { const id = publicIdFromUrl(u); if (id) referenced.add(id); };

const products = await Product.find({}, 'images imageSrc imageSrc2 dorsalOptions').lean();
for (const p of products) {
  for (const img of p.images || []) {
    if (img?.public_id) referenced.add(img.public_id);
    addUrl(typeof img === 'string' ? img : img?.url);
  }
  addUrl(p.imageSrc);
  addUrl(p.imageSrc2);
  for (const o of p.dorsalOptions || []) addUrl(o?.imageUrl);
}

// Facturas: guardan miniaturas para reimprimir tiquetes. Buscamos cualquier URL de Cloudinary dentro.
const facturas = await TiendaFactura.find({}, 'ventas').lean();
for (const f of facturas) {
  for (const m of JSON.stringify(f.ventas || []).matchAll(CLD_URL_RX)) addUrl(m[0]);
}

// Pedidos: guardan las fotos de frente/espalda de cada camiseta encargada
const pedidos = await Pedido.find({}, 'items.fotos').lean();
for (const pe of pedidos) for (const it of pe.items || []) for (const u of it.fotos || []) addUrl(u);

console.log(`📦 ${products.length} productos, ${facturas.length} facturas y ${pedidos.length} pedidos referencian ${referenced.size} imágenes`);

/* 2) Todo lo que hay en Cloudinary */
const all = [];
let cursor;
do {
  const r = await cloudinary.api.resources({ type: 'upload', resource_type: 'image', max_results: 500, next_cursor: cursor });
  all.push(...r.resources);
  cursor = r.next_cursor;
  process.stdout.write(`\r☁️  Listando Cloudinary… ${all.length}`);
} while (cursor);
console.log();

/* 3) Cruce */
const cutoff = Date.now() - MIN_AGE_DAYS * 24 * 60 * 60 * 1000;
const orphans = all.filter((r) => !referenced.has(r.public_id) && new Date(r.created_at).getTime() < cutoff);
const recentUnref = all.filter((r) => !referenced.has(r.public_id) && new Date(r.created_at).getTime() >= cutoff);
const missing = [...referenced].filter((id) => !all.some((r) => r.public_id === id));

const byFolder = {};
for (const r of orphans) {
  const folder = r.public_id.includes('/') ? r.public_id.split('/').slice(0, -1).join('/') : '(raíz)';
  byFolder[folder] ??= { count: 0, bytes: 0 };
  byFolder[folder].count += 1;
  byFolder[folder].bytes += r.bytes || 0;
}

const totalBytes = all.reduce((a, r) => a + (r.bytes || 0), 0);
const orphanBytes = orphans.reduce((a, r) => a + (r.bytes || 0), 0);

console.log('\n================ REPORTE ================');
console.log(`Imágenes en Cloudinary:   ${all.length}  (${fmtMB(totalBytes)})`);
console.log(`En uso:                   ${all.length - orphans.length - recentUnref.length}`);
console.log(`Huérfanas (>${MIN_AGE_DAYS} días):    ${orphans.length}  (${fmtMB(orphanBytes)})`);
console.log(`Sin uso pero recientes:   ${recentUnref.length}  (no se tocan)`);
console.log(`Referenciadas que NO existen en Cloudinary: ${missing.length}`);
console.log('\nHuérfanas por carpeta:');
for (const [folder, v] of Object.entries(byFolder).sort((a, b) => b[1].count - a[1].count)) {
  console.log(`  ${folder.padEnd(28)} ${String(v.count).padStart(6)}  ${fmtMB(v.bytes)}`);
}

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'output');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `cloudinary-orphans-${new Date().toISOString().slice(0, 10)}.json`);
fs.writeFileSync(outFile, JSON.stringify({
  generatedAt: new Date().toISOString(),
  minAgeDays: MIN_AGE_DAYS,
  totals: { cloudinary: all.length, referenced: referenced.size, orphans: orphans.length, orphanBytes, missing: missing.length },
  byFolder,
  orphans: orphans.map((r) => ({ public_id: r.public_id, bytes: r.bytes, created_at: r.created_at, url: r.secure_url })),
  missing,
}, null, 2));
console.log(`\n📝 Reporte completo: ${outFile}`);

/* 4) Borrado (solo con --delete --yes) */
if (DELETE) {
  const toDelete = orphans.filter((r) => ALL_FOLDERS || r.public_id.startsWith('products'));
  console.log(`\n🗑️  Borrando ${toDelete.length} imágenes${ALL_FOLDERS ? '' : ' (solo carpetas products*)'}…`);
  let done = 0;
  for (let i = 0; i < toDelete.length; i += 100) {
    const batch = toDelete.slice(i, i + 100).map((r) => r.public_id);
    try {
      await cloudinary.api.delete_resources(batch, { resource_type: 'image', type: 'upload' });
      done += batch.length;
      process.stdout.write(`\r   ${done}/${toDelete.length}`);
    } catch (err) {
      console.error(`\n   Error en lote ${i / 100 + 1}:`, err?.error?.message || err?.message || err);
    }
  }
  console.log(`\n✅ Listo: ${done} borradas.`);
} else {
  console.log('\nℹ️  No se borró nada. Revisá el reporte y, si está bien, corré con --delete --yes');
}

await mongoose.disconnect();
