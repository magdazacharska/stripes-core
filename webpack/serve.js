const webpack = require('webpack');
const HardSourceWebpackPlugin = require('hard-source-webpack-plugin');
const path = require('path');
const nodeObjectHash = require('node-object-hash');
const express = require('express');
const webpackDevMiddleware = require('webpack-dev-middleware');
const webpackHotMiddleware = require('webpack-hot-middleware');
const connectHistoryApiFallback = require('connect-history-api-fallback');
const StripesConfigPlugin = require('./stripes-config-plugin');

const cwd = path.resolve();
const platformModulePath = path.join(cwd, 'node_modules');
const coreModulePath = path.join(__dirname, '..', 'node_modules');
const serverRoot = path.join(__dirname, '..');

const cachePlugin = new HardSourceWebpackPlugin({
  cacheDirectory: path.join(cwd, 'webpackcache'),
  recordsPath: path.join(cwd, 'webpackcache/records.json'),
  configHash(webpackConfig) {
    // Build a string value used by HardSource to determine which cache to
    // use if [confighash] is in cacheDirectory or if the cache should be
    // replaced if [confighash] does not appear in cacheDirectory.
    return nodeObjectHash().hash(webpackConfig);
  },
});

module.exports = function serve(stripesConfig, options) {
  const app = express();
  let config = require('../webpack.config.cli.dev'); // eslint-disable-line

  config.plugins.push(new StripesConfigPlugin(stripesConfig));

  // Look for modules in node_modules, then the platform, then stripes-core
  config.resolve.modules = ['node_modules', platformModulePath, coreModulePath];
  config.resolveLoader = { modules: ['node_modules', platformModulePath, coreModulePath] };

  if (options.cache) {
    config.plugins.push(cachePlugin);
  }
  if (options.devtool) {
    config.devtool = options.devtool;
  }
  // Give the caller a chance to apply their own webpack overrides
  if (options.webpackOverrides && typeof options.webpackOverrides === 'function') {
    config = options.webpackOverrides(config);
  }

  const compiler = webpack(config);

  const port = options.port || process.env.STRIPES_PORT || 3000;
  const host = options.host || process.env.STRIPES_HOST || 'localhost';

  app.use(express.static(`${serverRoot}/public`));

  // Process index rewrite before webpack-dev-middleware
  // to respond with webpack's dist copy of index.html
  app.use(connectHistoryApiFallback({}));

  app.use(webpackDevMiddleware(compiler, {
    noInfo: true,
    publicPath: config.output.publicPath,
  }));

  app.use(webpackHotMiddleware(compiler));

  app.get('/favicon.ico', (req, res) => {
    res.sendFile(`${serverRoot}/favicon.ico`);
  });

  app.listen(port, host, (err) => {
    if (err) {
      console.log(err);
      return;
    }
    console.log(`Listening at http://${host}:${port}`);
  });
};