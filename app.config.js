// Configuración base en app.json. Al publicar la versión web en GitHub Pages, la app vive en
// una subcarpeta (/multi-lab): el flujo de publicación la indica con WEB_BASE_URL.
module.exports = ({ config }) =>
  process.env.WEB_BASE_URL
    ? { ...config, experiments: { ...config.experiments, baseUrl: process.env.WEB_BASE_URL } }
    : config;
