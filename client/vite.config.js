import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';

//Add the svgr inside the plugins arr
export default defineConfig({
  plugins: [react(), svgr()],
});
