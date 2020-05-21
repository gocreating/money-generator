const BFX = require('bitfinex-api-node');
const { WSv2, RESTv2 } = require('bitfinex-api-node');
const { UserInfo, FundingOffer, FundingCredit, Wallet } = require('bfx-api-node-models');
const round = require('lodash/round');
const padStart = require('lodash/padStart');
const { getState, setState, setInState } = require('./state');

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
      setState('orderBook', book);
    });

    ws.subscribeOrderBook('fUSD', 'R0', 25);
  });

  return ws;
};

const createBFXAuthWS = (bitfinexAPIKey, bitfinexAPISecret) => {
  console.log('[BFX] Create Authenticated Websocket');
  const bfx = new BFX({
    apiKey: bitfinexAPIKey,
    apiSecret: bitfinexAPISecret,
  });
  const ws = bfx.ws();

  ws.on('error', (err) => console.log(err));
  ws.on('open', ws.auth.bind(ws));

  return ws;
};

const createBFXRest = (bitfinexAPIKey, bitfinexAPISecret) => {
  console.log('[BFX] Create REST');
  const rest = new RESTv2({
    apiKey: bitfinexAPIKey,
    apiSecret: bitfinexAPISecret,
  });
  return rest;
};

const registerReporter = () => {
  console.log('[Server] Register reporter');
  const intervalId = setInterval(() => {
    const { bids, asks } = state.orderBook;
    const highestBid = bids[0];
    const highestBidRate = highestBid && highestBid[2];
    const lowestAsk = asks[0];
    const lowestAskRate = lowestAsk && lowestAsk[2];
    console.clear();
    console.log('Funding Balance (USD):           ', `${round(state.user.wallet.funding.USD.balance, 2)}`);
    console.log('Funding Balance Available (USD): ', `${round(state.user.wallet.funding.USD.balanceAvailable, 2)}`);
    console.log('Highest Bid Rate:                ', highestBidRate, `(${round(highestBidRate * 365 * 100, 2)}% / year)`);
    console.log('Lowest Ask Rate:                 ', lowestAskRate, `(${round(lowestAskRate * 365 * 100, 2)}% / year)`);

    console.log('\n=== Offering ===');
    Object.keys(state.user.fundingCreditMap).map(offerId => {
      const fc = state.user.fundingCreditMap[offerId];
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
    Object.keys(state.user.fundingOfferMap).map(offerId => {
      const fo = state.user.fundingOfferMap[offerId];
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
    setInState(['user', 'wallet', wallet.type, wallet.currency, 'balance'], wallet.balance);
    setInState(['user', 'wallet', wallet.type, wallet.currency, 'balanceAvailable'], wallet.balanceAvailable);
    const state = getState();
    const pendingOfferAmount = Object.keys(state.user.fundingOfferMap).reduce((sum, fo) => sum + fo.amount, 0);
    if (wallet.balanceAvailable - state.user.config.amountKeep > state.user.config.amountMin) {
      // if (pendingOfferAmount === 0) {
        // 自動掛單
        const newFo = new FundingOffer({
          type: 'LIMIT',
          symbol: 'fUSD',
          rate: state.user.config.fixedOfferRate,
          amount: wallet.balanceAvailable - state.user.config.amountKeep,
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
  setInState(['user', 'fundingCreditMap', fc.id], fc);
};

const updateUserFundingOffer = (foArray) => {
  const fo = FundingOffer.unserialize(foArray);
  setInState(['user', 'fundingOfferMap', fo.id], fo);
};

const removeUserFundingOffer = (foArray) => {
  const fo = FundingOffer.unserialize(foArray);
  setInState(['user', 'fundingOfferMap', fo.id], undefined);
};

const updateFundingTrade = async (ftArray, rest) => {
  // 成交時不會有 funding snapshot，要手動更新 funding credits
  try {
    const fcs = await rest.fundingCredits('fUSD');
    fcs.forEach(fcArray => {
      updateUserFundingCredit(fcArray);
    });
  } catch (e) {
    console.log(e);
  }
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
      updateUserFundingOffer(fo);
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

  authWS.onFundingOfferUpdate({}, (fou) => {
    updateUserFundingOffer(fou);
  });

  // Offer 取消/更新/成交時觸發
  authWS.onFundingOfferClose({}, (foc) => {
    removeUserFundingOffer(foc);
  });

  // 已提供
  authWS.onFundingCreditSnapshot({}, (fcs) => {
    fcs.forEach(fcArray => {
      updateUserFundingCredit(fcArray);
    });
  });

  authWS.onFundingCreditUpdate({}, (fcu) => {
    updateUserFundingCredit(fcu);
  });

  authWS.onFundingTradeUpdate({}, (ftu) => {
    updateFundingTrade(ftu, rest);
  });

  try {
    const userInfo = await rest.userInfo();
    setInState(['user', 'info'], UserInfo.unserialize(userInfo));
  } catch (e) {
    console.error('Fail to initialize.', e);
  }

  setState('connected', true);
};

module.exports = {
  createBFXPublicWS,
  createBFXAuthWS,
  createBFXRest,
  registerReporter,
  initialize,
};
