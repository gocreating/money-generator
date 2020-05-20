const { createBFXPublicWS, createBFXAuthWS, createBFXRest, registerReporter, initialize } = require('./bfxController');
const { getState } = require('./state');

module.exports = (app) => {
  app.get('/', (req, res) => {
    res.json({ status: 0 });
  });

  app.get('/api/connect', async (req, res) => {
    const { BITFINEX_API_KEY, BITFINEX_API_SECRET } = req.query;
    const ws = createBFXPublicWS();
    const authWS = createBFXAuthWS(BITFINEX_API_KEY, BITFINEX_API_SECRET);
    const rest = createBFXRest(BITFINEX_API_KEY, BITFINEX_API_SECRET);
    // const unregisterReporter = registerReporter();

    try {
      await initialize(ws, authWS, rest);
      res.json({ status: 'ok' });
    } catch (e) {
      res.json({ status: 'error', e });
    }
  });

  app.get('/api/state', (req, res) => {
    res.json(getState());
  });
};
