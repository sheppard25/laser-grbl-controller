module.exports = function override(config) {
  // Ignore source map warnings from react-zoom-pan-pinch
  config.ignoreWarnings = [
    {
      module: /node_modules\/react-zoom-pan-pinch/,
      message: /Failed to parse source map/,
    },
  ];
  
  return config;
};
