
const BFX = require('bitfinex-api-node');
const { WSv2, RESTv2 } = require('bitfinex-api-node');
const { UserInfo, FundingOffer, Wallet } = require('bfx-api-node-models');
const round = require('lodash/round');

let orderBook = {
  bids: [],
  asks: [],
};
let user = {
  info: {},
  wallet: {
    funding: {
      USD: {},
    },
  },
  balance: {
    amount: 0,
    amountAvailable: 0,
  },
};

const createBFXPublicWS = () => {
  console.log('[BFX] Create Public Websocket');
  const ws = new WSv2({
    manageOrderBooks: true,
  });

  ws.on('open', () => {
    ws.onOrderBook({ symbol: 'fUSD', prec: 'R0', len: 25 }, () => {
      const book = ws.getOB('fUSD');
      if (!book) {
        return;
      }
      orderBook = book;
    });

    ws.subscribeOrderBook('fUSD', 'R0', 25);
  });

  return ws;
};

const createBFXAuthWS = () => {
  console.log('[BFX] Create Authenticated Websocket');
  const bfx = new BFX({
    apiKey: process.env.BITFINEX_API_KEY,
    apiSecret: process.env.BITFINEX_API_SECRET,
  });
  const ws = bfx.ws();

  ws.on('error', (err) => console.log(err));
  ws.on('open', ws.auth.bind(ws));

  return ws;
};

const createBFXRest = () => {
  console.log('[BFX] Create REST');
  const rest = new RESTv2({
    apiKey: process.env.BITFINEX_API_KEY,
    apiSecret: process.env.BITFINEX_API_SECRET,
  });
  return rest;
};

const registerReporter = () => {
  console.log('[Server] Register reporter');
  const intervalId = setInterval(() => {
    const { bids, asks } = orderBook;
    const highestBid = bids[0];
    const highestBidRate = highestBid[2];
    const lowestAsk = asks[0];
    const lowestAskRate = lowestAsk[2];
    console.clear();
    console.log('Balance: ', `${round(user.balance.amount, 2)} / ${round(user.balance.amountAvailable, 2)}`);
    console.log('Highest Bid Rate:', highestBidRate, `(${round(highestBidRate * 365 * 100, 2)}% / year)`);
    console.log('Lowest Ask Rate: ', lowestAskRate);
  }, 3000);

  return () => {
    clearInterval(intervalId);
  };
};

const initialize = async (ws, authWS, rest) => {
  ws.open();
  authWS.open();

  authWS.onBalanceInfoUpdate({}, (balanceInfo) => {
    user.balance.amount = balanceInfo[0];
  });

  try {
    const userInfo = await rest.userInfo();
    const balanceAvailable = await rest._makeAuthRequest('/auth/calc/order/avail', {
      symbol: 'fUSD',
      type: 'FUNDING',
    });
    const wallets = await rest.wallets();
    wallets.forEach(wallet => {
      const parsedWallet = Wallet.unserialize(wallet);
      if (parsedWallet.type === 'funding' && parsedWallet.currency === 'USD') {
        user.wallet[parsedWallet.type][parsedWallet.currency] = parsedWallet;
      }
    });
    user.info = UserInfo.unserialize(userInfo);
    user.balance.amountAvailable = balanceAvailable[0];
  } catch (e) {
    console.error('Fail to initialize.', e);
  }
};

const routes = async (app) => {
  const ws = createBFXPublicWS();
  const authWS = createBFXAuthWS();
  const rest = createBFXRest();
  const unregisterReporter = registerReporter();

  await initialize(ws, authWS, rest);

  app.get('/me', async (req, res) => {
    res.json(user);
  });

  app.get('/funding', async (req, res) => {
    const fo = new FundingOffer({
      type: 'LIMIT',
      symbol: 'fUSD',
      rate: 0.1,
      amount: 120,
      period: 2,
    }, rest);

    try {
      await fo.submit();
      res.send({
        msg: 'ok',
      });
    } catch (e) {
      const { response: { body } } = e;
      res.status(422).send({
        msg: body[2],
      });
    }
  });
};

module.exports = routes;
