const express = require('express');
const app = express();
const sendAuthInput = require('./sendAuthInput');
const { STREAM_TYPES } = require('./constants');

const createServer = (wss, port=3000) => {
  app.get('/funding', function (req, res) {
    sendAuthInput(wss, STREAM_TYPES.FUNDING_OFFER_NEW, {
      type: 'LIMIT',
      symbol: 'fUSD',
      amount: 50, // minimum is 50 dollar or equivalent in USD.
      rate: 0.08,
      period: 2,
      flags: 0,
    });
    res.send('requested new funding order');
  });

  app.listen(port, function () {
    console.log(`[Server] listening on port ${port}.`);
  });
};

module.exports = createServer;
