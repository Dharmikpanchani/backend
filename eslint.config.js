import globals from 'globals';
import pluginJs from '@eslint/js';

export default [
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        process: 'readonly',
        // Add other globals as needed
      },
    },
    // Include rules directly from the plugin's recommended configuration
    rules: {
      ...pluginJs.configs.recommended.rules,
      'no-console': 'error', // Disallow console logs
      // Add or override rules as needed
    },
  },
];
