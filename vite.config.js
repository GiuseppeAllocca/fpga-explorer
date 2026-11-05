import { defineConfig } from 'vite';

// CSP solo in build: il server di sviluppo ha bisogno di script inline per l'HMR.
const csp = {
  name: 'csp',
  apply: 'build',
  transformIndexHtml: html =>
    html.replace('<title>', `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'">\n<title>`),
};

export default defineConfig({
  base: './',
  plugins: [csp],
  build: {
    rollupOptions: { input: { index: 'index.html', '3d': '3d.html' } },
  },
});
