const path = require('path')

const webpackConfig = {
  mode: process.env.NODE_ENV || 'development',
  entry: {
    kepler: './src/examples/kepler/kepler.js',
  },
  output: {
    filename: '[name].js',
    path: path.join(__dirname, 'dist'),
    library: '[name]',
    libraryTarget: 'umd',
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      { test: /\.js$/, use: ['babel-loader'] },
      { test: /\.ts$/, use: ['ts-loader'] },
      { test: /\.css$/, use: ['to-string-loader', 'css-loader'] },
    ],
  },
  devServer: {
    contentBase: path.join(__dirname, 'dist'),
    disableHostCheck: true, // this is insecure, but the only way to make the iframe work...
    compress: true,
    https: true,
    port: 9000,
  },
  stats: {
    warningsFilter: /export.*liquidfillgauge.*was not found/,
  },
  performance: {
    hints: false,
    maxEntrypointSize: 512000,
    maxAssetSize: 512000,
  },
}

module.exports = webpackConfig
