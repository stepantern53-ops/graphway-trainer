import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
export default defineConfig({
 plugins:[react()],
 resolve:{alias:{'@graphway/math-core':fileURLToPath(new URL('../../packages/math-core/src/index.ts',import.meta.url)),'@graphway/contracts':fileURLToPath(new URL('../../packages/contracts/src/index.ts',import.meta.url))}},
 server:{host:'127.0.0.1',port:Number(process.env.WEB_PORT??5173),strictPort:true,proxy:{'/api':{target:`http://127.0.0.1:${process.env.PORT??3001}`,changeOrigin:false}}},
 build:{outDir:'dist',emptyOutDir:true}
});
