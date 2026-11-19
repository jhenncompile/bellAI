// Configuración dinámica sobre app.json.
// Firebase (notificaciones push en Android): si existe ./google-services.json se incluye en la
// compilación. Sin el archivo la app compila igual, sin push (queda el aviso local de respaldo).
const fs = require('fs');
const path = require('path');

const GOOGLE_SERVICES = './google-services.json';

module.exports = ({ config }) => {
  if (fs.existsSync(path.resolve(GOOGLE_SERVICES))) {
    config.android = { ...config.android, googleServicesFile: GOOGLE_SERVICES };
  }
  return config;
};
