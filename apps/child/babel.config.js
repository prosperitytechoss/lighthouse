module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    // Required by react-native-reanimated v4 / react-native-keyboard-controller.
    // Must be the LAST plugin.
    plugins: ["react-native-worklets/plugin"],
  };
};
