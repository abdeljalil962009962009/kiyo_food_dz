const fs = require('fs');
let code = fs.readFileSync('src/context/WilayaContext.tsx', 'utf8');

code = code.replace(
  "import { requestBestCurrentPosition } from '../lib/geo';",
  "import { requestBestCurrentPosition, reverseGeocode } from '../lib/geo';"
);

const oldFetchRegex = /\/\/ Reverse geocode to get wilaya[\s\S]*?const data = await res\.json\(\);/m;
const newFetchCode = `
      // Reverse geocode to get wilaya
      const data = await reverseGeocode(point.lat, point.lng, 'en');
`;
code = code.replace(oldFetchRegex, newFetchCode.trim());

// We also need to fix the extraction of the province
const oldExtractRegex = /const stateName = data\.address\?\.state \|\| data\.address\?\.province;/m;
const newExtractCode = `const stateName = data.province || data.city;`;
code = code.replace(oldExtractRegex, newExtractCode);

fs.writeFileSync('src/context/WilayaContext.tsx', code);
