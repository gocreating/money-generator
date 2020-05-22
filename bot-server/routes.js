const { createBFXPublicWS, createBFXAuthWS, createBFXRest, initialize } = require('./bfxController');
const { getState } = require('./state');

module.exports = (app) => {
  let rest;

  app.get('/', (req, res) => {
    res.json({ status: 0 });
  });

  app.get('/api/connect', async (req, res) => {
    const { BITFINEX_API_KEY, BITFINEX_API_SECRET } = req.query;
    const ws = createBFXPublicWS();
    const authWS = createBFXAuthWS(BITFINEX_API_KEY, BITFINEX_API_SECRET);
    rest = createBFXRest(BITFINEX_API_KEY, BITFINEX_API_SECRET);

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

  app.post('/api/offer/:offerId/close', async (req, res) => {
    try {
      const resOffer = await rest.cancelFundingOffer(parseInt(req.params.offerId));
      res.json({ status: 'ok', resOffer });
    } catch (error) {
      console.log(error);
      res.json({ status: 'error', error });
    }
  });
};
