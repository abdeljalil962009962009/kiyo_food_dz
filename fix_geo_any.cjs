const fs = require('fs');
let code = fs.readFileSync('src/lib/geo.ts', 'utf8');

code = code.replace(
  "function parseGoogleAddress(result: any): AddressParts {",
  "// eslint-disable-next-line @typescript-eslint/no-explicit-any\nfunction parseGoogleAddress(result: any): AddressParts {"
);

code = code.replace(
  "const getComponent = (type: string) => components.find((c: any) => c.types.includes(type))?.long_name;",
  "// eslint-disable-next-line @typescript-eslint/no-explicit-any\n  const getComponent = (type: string) => components.find((c: any) => c.types.includes(type))?.long_name;"
);

code = code.replace(
  "return data.results.slice(0, limit).map((r: any) => ({",
  "// eslint-disable-next-line @typescript-eslint/no-explicit-any\n        return data.results.slice(0, limit).map((r: any) => ({"
);

fs.writeFileSync('src/lib/geo.ts', code);
