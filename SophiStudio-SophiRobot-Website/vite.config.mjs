import {defineConfig} from 'vite';
export default defineConfig({base:'./',optimizeDeps:{exclude:['three']},build:{rollupOptions:{input:{main:'index.html',bom:'bom.html'},output:{manualChunks:{three:['three']}}}}});
