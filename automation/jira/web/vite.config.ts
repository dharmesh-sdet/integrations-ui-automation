import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Built files go to dist/, which jira/server/server.ts serves for the page routes.
export default defineConfig({ plugins: [react()], build: { outDir: 'dist', emptyOutDir: true } });
