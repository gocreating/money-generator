const {
  createBFXPublicWS,
  createBFXAuthWS,
  createBFXRest,
  tryToCloseWS,
  tryToCloseAuthWS,
  initialize,
  autoOffer,
} = require('./bfxController');
const { getState, setInState } = require('./state');

module.exports = (app) => {
  let rest;

  app.get('/', (req, res) => {
    res.json({ status: 0 });
  });

  app.get('/api/connect', async (req, res) => {
    const { BITFINEX_API_KEY, BITFINEX_API_SECRET } = req.query;
    try {
      const bfx = await initialize(BITFINEX_API_KEY, BITFINEX_API_SECRET);
      rest = bfx.rest;
      res.json({ status: 'ok' });
    } catch (e) {
      console.log('[Routes] Connect error', e);
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

  app.patch('/api/state/user/config', (req, res) => {
    const userConfig = {
      ...req.body,
      amountKeep: parseFloat(req.body.amountKeep),
      amountMin: parseFloat(req.body.amountMin),
      amountMax: parseFloat(req.body.amountMax),
      fixedOfferRate: parseFloat(req.body.fixedOfferRate),
      fixedOfferPeriod: parseInt(req.body.fixedOfferPeriod),
    };
    setInState(['user', 'config'], userConfig);
    // trigger bot when config is updated
    autoOffer();
    res.json({ status: 'ok' });
  });
};
