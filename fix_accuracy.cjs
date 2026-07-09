const fs = require('fs');
let code = fs.readFileSync('src/lib/geo.ts', 'utf8');

code = code.replace(
  "  if (purpose === 'driver') return accuracy <= LOCATION_ACCURACY_METERS.driverSuspicious;\n  return accuracy <= LOCATION_ACCURACY_METERS.customerUsable;",
  "  if (purpose === 'driver') return accuracy <= LOCATION_ACCURACY_METERS.driverSuspicious;\n  if (purpose === 'wilaya') return accuracy <= 20000;\n  return accuracy <= LOCATION_ACCURACY_METERS.customerUsable;"
);

fs.writeFileSync('src/lib/geo.ts', code);
