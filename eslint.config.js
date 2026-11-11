// eslint.config.js — konfigurasi linter (J.620100.012.01)
module.exports = [
  {
    files: ["**/*.js"],
    ignores: ["node_modules/**", "eslint.config.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        document: "readonly",
        window: "readonly",
        localStorage: "readonly",
        FileReader: "readonly",
        Blob: "readonly",
        URL: "readonly"
      }
    },
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "error",
      "semi": ["error", "always"],
      "eqeqeq": "error",
      "no-var": "error",
      "prefer-const": "warn"
    }
  }
];
