import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

/** Inlines the favicon/touch icon so the single-file build has no external files. */
function inlineIcons(): Plugin {
  const dataUri = (file: string) => `data:image/png;base64,${readFileSync(new URL(`./public/${file}`, import.meta.url)).toString('base64')}`;
  return {
    name: 'inline-icons',
    transformIndexHtml: (html) =>
      html.replace('href="./favicon.png"', `href="${dataUri('favicon.png')}"`).replace('href="./apple-touch-icon.png"', `href="${dataUri('apple-touch-icon.png')}"`),
  };
}

// `vite build`               → dist/ (a normal static website, deployable anywhere)
// `vite build --mode single` → dist-single/pirate-token.html (one self-contained file)
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    base: './',
    plugins: [react(), ...(single ? [viteSingleFile(), inlineIcons()] : [])],
    publicDir: single ? false : 'public',
    build: {
      target: ['es2020', 'safari15'],
      outDir: single ? 'dist-single' : 'dist',
      assetsInlineLimit: single ? 100_000_000 : 0,
    },
  };
});
