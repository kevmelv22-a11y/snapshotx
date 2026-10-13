// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // Supabase Edge Functions run on Deno (npm:/jsr: specifiers); they are not part of the app bundle.
    ignores: ["dist/*", "supabase/functions/**"],
  }
]);
