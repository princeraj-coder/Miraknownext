// ─────────────────────────────────────────────────────────────────────────────
//  server/dev-middleware.js — Vite Local Dev Server Middleware for /api/ai/*
// ─────────────────────────────────────────────────────────────────────────────
import modelsHandler from '../api/ai/models.js';
import chatHandler from '../api/ai/chat.js';
import filesHandler from '../api/ai/files.js';
import configHandler from '../api/ai/config.js';

export function createAiDevMiddleware() {
  return async (req, res, next) => {
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname;

    if (!pathname.startsWith('/api/ai')) {
      return next();
    }

    // Helper to send json
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (data) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
      return res;
    };

    // Parse body if POST/PATCH and not already parsed
    if (!req.body && (req.method === 'POST' || req.method === 'PATCH' || req.method === 'PUT')) {
      if (typeof req[Symbol.asyncIterator] === 'function') {
        try {
          const buffers = [];
          for await (const chunk of req) {
            buffers.push(chunk);
          }
          const raw = Buffer.concat(buffers).toString('utf-8');
          if (raw) {
            try {
              req.body = JSON.parse(raw);
            } catch (e) {
              req.body = {};
            }
          } else {
            req.body = {};
          }
        } catch (err) {
          console.warn('[Dev Middleware Body Parser Error]', err);
          req.body = {};
        }
      } else {
        req.body = {};
      }
    }

    try {
      if (pathname === '/api/ai/models') {
        return await modelsHandler(req, res);
      }
      if (pathname === '/api/ai/chat' || pathname === '/api/ai/chat/stream') {
        return await chatHandler(req, res);
      }
      if (pathname === '/api/ai/files') {
        return await filesHandler(req, res);
      }
      if (pathname === '/api/ai/config') {
        return await configHandler(req, res);
      }
      return next();
    } catch (err) {
      console.error('[Dev API Middleware Error]', err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
      }
    }
  };
}
