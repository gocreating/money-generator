
const BFX = require('bitfinex-api-node');
const { WSv2, RESTv2 } = require('bitfinex-api-node');
const { UserInfo, FundingOffer, FundingCredit, Wallet } = require('bfx-api-node-models');
const round = require('lodash/round');
const padStart = require('lodash/padStart');

let orderBook = {
  bids: [],
  asks: [],
};
let user = {
  config: {
    amountKeep: 126,
    amountMin: 50,
    fixedOfferRate: 0.001, // 0.1% per day
  },
  info: {},
  wallet: {
    funding: {
      USD: {
        balance: 0,
        balanceAvailable: 0,
      },
    },
  },
  fundingCreditMap: {},
  fundingOfferMap: {},
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
    const highestBidRate = highestBid && highestBid[2];
    const lowestAsk = asks[0];
    const lowestAskRate = lowestAsk && lowestAsk[2];
    console.clear();
    console.log('Funding Balance (USD):           ', `${round(user.wallet.funding.USD.balance, 2)}`);
    console.log('Funding Balance Available (USD): ', `${round(user.wallet.funding.USD.balanceAvailable, 2)}`);
    console.log('Highest Bid Rate:                ', highestBidRate, `(${round(highestBidRate * 365 * 100, 2)}% / year)`);
    console.log('Lowest Ask Rate:                 ', lowestAskRate, `(${round(lowestAskRate * 365 * 100, 2)}% / year)`);

    console.log('\n=== Offering ===');
    Object.keys(user.fundingCreditMap).map(offerId => {
      const fc = user.fundingCreditMap[offerId];
      const now = new Date();
      const expiringInHour = Math.floor((fc.mtsOpening + fc.period * 86400000 - now.getTime()) / 3600000);
      const expiringInDay = Math.floor(expiringInHour / 24);
      let expStr = '';
      if (expiringInHour < 24) {
        expStr = `${expiringInHour} hours left`;
      } else {
        expStr = `${expiringInDay} days left`;
      }
      console.log(`${fc.id}, ${fc.symbol}, ${fc.positionPair}, ${fc.status}, ${fc.type}, ${padStart(round(fc.amount, 2), 8)} (${round(fc.rate * 100, 5)}%), ${fc.period} days (${expStr})`);
    });

    console.log('\n=== Asking ===');
    Object.keys(user.fundingOfferMap).map(offerId => {
      const fo = user.fundingOfferMap[offerId];
      console.log(`${fo.id}, ${fo.symbol}, ${fo.amount}, ${fo.rate}, ${fo.period}`);
    });
  }, 1000);

  return () => {
    clearInterval(intervalId);
  };
};

const updateUserWallet = async (rawWallet, rest) => {
  const wallet = Wallet.unserialize(rawWallet);
  if (wallet.type === 'funding' && wallet.currency === 'USD') {
    user.wallet[wallet.type][wallet.currency].balance = wallet.balance;
    user.wallet[wallet.type][wallet.currency].balanceAvailable = wallet.balanceAvailable;

    const pendingOfferAmount = Object.keys(user.fundingOfferMap).reduce((sum, fo) => sum + fo.amount, 0);
    if (wallet.balanceAvailable - user.config.amountKeep > user.config.amountMin) {
      // if (pendingOfferAmount === 0) {
        // 自動掛單
        const newFo = new FundingOffer({
          type: 'LIMIT',
          symbol: 'fUSD',
          rate: user.config.fixedOfferRate,
          amount: wallet.balanceAvailable - user.config.amountKeep,
          period: 2,
        }, rest);
        try {
          const foRes = await rest.submitFundingOffer(newFo);
          const fo = FundingOffer.unserialize(foRes.notifyInfo);
        } catch (e) {
          console.log(e);
        }
      // }
    }
  }
};

const updateUserFundingCredit = (fcArray) => {
  const fc = FundingCredit.unserialize(fcArray);
  user.fundingCreditMap[fc.id] = fc;
  // 成交時移除掛單的cache
  delete user.fundingOfferMap[fc.id];
};

const updateUserFundingOffer = (foArray) => {
  const fo = FundingOffer.unserialize(foArray);
  user.fundingOfferMap[fo.id] = fo;
};

const removeUserFundingOffer = (foArray) => {
  const fo = FundingOffer.unserialize(foArray);
  delete user.fundingOfferMap[fo.id];
};

const initialize = async (ws, authWS, rest) => {
  await ws.open();
  await authWS.open();

  authWS.onWalletSnapshot({}, (wallets) => {
    wallets.forEach(wallet => updateUserWallet(wallet, rest));
  });

  authWS.onWalletUpdate({}, (wallet) => {
    updateUserWallet(wallet, rest);
  });

  // 出價
  authWS.onFundingOfferSnapshot({}, (fos) => {
    fos.forEach(foSerialized => {
      const fo = FundingOffer.unserialize(foSerialized);
      console.log(`${fo.id},${fo.symbol},${fo.status},${fo.amount},${fo.amountOrig},${fo.rate},${fo.period},${fo.renew}`);
    });
  });

  // 新的出價掛單
  authWS.onFundingOfferNew({}, (fon) => {
    updateUserFundingOffer(fon);

    // const intervalId = setInterval(() => {
    //   console.log(`${fo.id},${fo.symbol},${fo.status},${fo.amount},${fo.amountOrig},${fo.rate},${fo.period},${fo.renew}`);
    // }, 1000);

    // if (fo.amount === 50) {
    //   setTimeout(async () => {
    //     console.log('==== canceling ====');
    //     const resOffer = await rest.cancelFundingOffer(fo.id);
    //     if (resOffer.status === 'SUCCESS') {
    //       const resFo = FundingOffer.unserialize(resOffer.notifyInfo);
    //       console.log(`Offer ${resFo.id} cancelled`);
    //     }
    //     clearInterval(intervalId);
    //   }, 5000);
    // }
  });

  authWS.onFundingOfferClose({}, (foc) => {
    removeUserFundingOffer(foc);
  });

  // 已提供
  authWS.onFundingCreditSnapshot({}, (fcs) => {
    user.fundingCredits = fcs.forEach(fcArray => {
      updateUserFundingCredit(fcArray);
    });
  });

  authWS.onFundingCreditUpdate({}, (fcu) => {
    updateUserFundingCredit(fcu);
  });

  try {
    const userInfo = await rest.userInfo();
    user.info = UserInfo.unserialize(userInfo);
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
    const newFo = new FundingOffer({
      type: 'LIMIT',
      symbol: 'fUSD',
      rate: 0.002, // 0.2%
      amount: 50,
      period: 2,
    }, rest);

    try {
      const offerRes = await rest.submitFundingOffer(newFo);
      const fo = FundingOffer.unserialize(offerRes.notifyInfo);

      console.log('==== submit funding offer ====');
      console.log(`${fo.id},${fo.symbol},${fo.status},${fo.amount},${fo.amountOrig},${fo.rate},${fo.period},${fo.renew}`);

      res.json({
        msg: 'ok',
      });
    } catch (e) {
      const { response: { body } } = e;
      res.status(422).json({
        msg: body[2],
      });
    }
  });
};

module.exports = routes;
