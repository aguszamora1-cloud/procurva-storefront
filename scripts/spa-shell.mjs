// Renombra dist/index.html → dist/app.html después del build.
//
// En Vercel un archivo estático gana SIEMPRE sobre los rewrites de vercel.json.
// Con dist/index.html presente, la home ("/") se servía directo y nunca llegaba
// al rewrite de bots (/api/site/html), así que la vista previa del link en
// WhatsApp/Google salía con "Tienda online" y la "P". Sin index.html, "/" pasa
// por los rewrites como cualquier otra ruta: los bots van a la función y los
// visitantes al catch-all → /app.html (sigue siendo estático, desde el CDN).
import { renameSync } from 'node:fs';

renameSync('dist/index.html', 'dist/app.html');
