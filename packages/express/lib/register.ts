import path from 'path';
import http from 'http';
import express from 'express';
import render from '@react-ssr/core/express/render';
import Config from '@react-ssr/core/express/config';
import {
  getBabelrc,
  getEngine,
} from '@react-ssr/core/helpers';
import optimize from './optimize';

const escaperegexp = require('lodash.escaperegexp');

const register = async (app: express.Application, overrideConfig?: Config): Promise<void> => {
  const config: Config = Object.assign(new Config, overrideConfig || {});

  let babelRegistered = false;
  let moduleDetectRegEx: RegExp;

  const renderFile = async (file: string, options: any, cb: (err: any, html?: any) => void) => {
    if (!moduleDetectRegEx) {
      const pattern = [].concat(options.settings.views).map(viewPath => '^' + escaperegexp(viewPath)).join('|');
      moduleDetectRegEx = new RegExp(pattern);
    }

    if (!babelRegistered) {
      require('@babel/register')({
        extends: getBabelrc(),
      });
      babelRegistered = true;
    }

    const { settings, cache, _locals, ...props } = options;

    try {
      return cb(undefined, await render(file, props, config));
    } catch (e) {
      return cb(e);
    } finally {
      Object.keys(require.cache).forEach((filename) => {
        if (moduleDetectRegEx.test(filename)) {
          delete require.cache[filename];
        }
      });
    }
  };

  const engine: 'jsx' | 'tsx' = getEngine();

  app.engine(engine, renderFile);
  app.set('views', path.join(process.cwd(), config.viewsDir));
  app.set('view engine', engine);

  app.listen = function() {
    const args: any = arguments;
    const server = http.createServer(app);
    optimize(app, server, config).then((server) => {
      server.listen.apply(server, args);
    });
    return server;
  };
};

export default register;
