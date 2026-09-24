const config = {
  '*.{ts,tsx,js,jsx}': ['eslint --fix', 'prettier --write'],
  '*.{json,css,md,mdx}': ['prettier --write'],
};

export default config;
