const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: {
    background: './src/background.js',
    content: './src/content.js',
    popup: './src/popup.js'
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
  optimization: {
    minimize: false,
    sideEffects: false
  },
  // Ensure Webpack doesn't try to use Node.js polyfills for Transformers.js in the browser
  resolve: {
    fallback: {
      "fs": false,
      "path": false,
      "crypto": false
    }
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: '../node_modules/onnxruntime-web/dist/*.wasm',
          to: '[name][ext]'
        },
        {
          from: 'src/worklet.js',
          to: 'worklet.js'
        }
      ]
    })
  ]
};
