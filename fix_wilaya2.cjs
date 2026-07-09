const fs = require('fs');
let code = fs.readFileSync('src/context/WilayaContext.tsx', 'utf8');

const oldRegex = /const state = data\.address\?\.state \|\| data\.address\?\.region;/;
code = code.replace(oldRegex, 'const state = data.province || data.city || data.commune;');

fs.writeFileSync('src/context/WilayaContext.tsx', code);
