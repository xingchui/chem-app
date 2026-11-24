import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: './', // 相对路径：Electron file:// 加载必需
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        // 把体积较大的第三方库拆成独立 chunk，避免单个文件超过 500 kB
        codeSplitting: {
          groups: [
            { name: 'katex', test: /node_modules[\\/]katex[\\/]/, priority: 20 },
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
