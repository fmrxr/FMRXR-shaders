import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Syne', 'sans-serif'],
      },
      colors: {
        forge: {
          bg:      '#0a0a0c',
          bg2:     '#0f0f13',
          bg3:     '#14141a',
          bg4:     '#1a1a22',
          bg5:     '#202030',
          border:  '#ffffff12',
          border2: '#ffffff20',
          text:    '#e8e8f0',
          text2:   '#9090a8',
          accent:  '#6c63ff',
          accent2: '#ff6b9d',
          accent3: '#00d9b8',
          green:   '#00ff88',
          red:     '#ff4466',
          amber:   '#ffb830',
        },
      },
    },
  },
  plugins: [],
};

export default config;
