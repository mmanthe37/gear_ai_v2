module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Apply react-native-dotenv only to project source files, not node_modules.
    // react-native-dotenv replaces ALL process.env.* references (including Expo's
    // internal EXPO_ROUTER_APP_ROOT) with absolute paths from the Node.js env,
    // which breaks Metro's require.context route discovery in expo-router/_ctx.web.js.
    overrides: [
      {
        exclude: /node_modules/,
        plugins: [
          [
            'module:react-native-dotenv',
            {
              moduleName: '@env',
              path: '.env',
              safe: false,
              allowUndefined: true,
              verbose: false,
            },
          ],
        ],
      },
    ],
  };
};

