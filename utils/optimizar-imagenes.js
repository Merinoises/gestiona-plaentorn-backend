// optimizar-imagenes.js
const fs    = require('fs').promises;
const path  = require('path');
const sharp = require('sharp');

(async () => {
  try {
    // 1) Define tus rutas aquí, ajusta si tus imágenes están en public/images/temas
    const inputDir  = path.join(__dirname, '../public/images');
    const outputDir = path.join(__dirname, '../public/images/optimizadas');

    console.log('📁 Input dir:', inputDir);
    console.log('📁 Output dir:', outputDir);

    // 2) Crea la carpeta de salida
    await fs.mkdir(outputDir, { recursive: true });
    console.log('✅ Output directory ready');

    // 3) Lee los archivos
    const files = await fs.readdir(inputDir);
    console.log(`🔍 Found ${files.length} items in input dir`);

    // 4) Filtra y procesa
    let count = 0;
    for (const file of files) {
      if (!/\.(png)$/i.test(file)) continue;

      const inPath  = path.join(inputDir, file);
      const outName = file.replace(/\.png$/i, '.png'); // misma extensión
      const outPath = path.join(outputDir, outName);

      console.log(`   • Optimizing ${file} → ${outName}`);
      await sharp(inPath)
        .resize({ width: 800 })
        .png({ compressionLevel: 9, adaptiveFiltering: true })
        .toFile(outPath);

      count++;
    }

    console.log(`✅ Done! Optimized ${count} PNG files.`);
  } catch (err) {
    console.error('❌ Error in optimization script:', err);
  }
})();