const BFX = require('bitfinex-api-node');
const { WSv2, RESTv2 } = require('bitfinex-api-node');
const { FundingCredit, FundingOffer, LedgerEntry, UserInfo, Wallet } = require('bfx-api-node-models');
const round = require('lodash/round');
const padStart = require('lodash/padStart');
const { getState, setState, setInState } = require('./state');

let cleanUpHandlerRegistered = false;
let ws = null
let authWS = null;

const createBFXPublicWS = () => {
  console.log('[BFX] Create Public Websocket');
  ws = new WSv2({
    manageOrderBooks: true,
  });

  ws.on('open', () => {
    ws.onOrderBook({ symbol: 'fUSD', prec: 'R0', len: 100 }, () => {
      const book = ws.getOB('fUSD');
      if (!book) {
        return;
      }
      cuttedBook = cutBook(book, 25);
      setState('orderBook', cuttedBook);
      setInState(['infer', 'bestAskRate'], getBestAskRate(book));
    });

    ws.subscribeOrderBook('fUSD', 'R0', 100);
  });

  return ws;
};

const createBFXAuthWS = (bitfinexAPIKey, bitfinexAPISecret) => {
  console.log('[BFX] Create Authenticated Websocket');
  const bfx = new BFX({
    apiKey: bitfinexAPIKey,
    apiSecret: bitfinexAPISecret,
  });
  authWS = bfx.ws();

  authWS.on('error', (err) => console.log(err));
  authWS.on('open', authWS.auth.bind(authWS));

  return authWS;
};

const createBFXRest = (bitfinexAPIKey, bitfinexAPISecret) => {
  console.log('[BFX] Create REST');
  const rest = new RESTv2({
    apiKey: bitfinexAPIKey,
    apiSecret: bitfinexAPISecret,
  });
  return rest;
};

const getBestAskRate = (book) => {
  let maxAskAmount = 0;
  let maxAskAmountIndex = -1;
  for (let i = 1; i < book.asks.length; i++) {
    const askAmount = book.asks[i][3];
    if (askAmount > maxAskAmount) {
      maxAskAmount = askAmount;
      maxAskAmountIndex = i;
    }
  }
  const bestAskIndex = Math.max(0, maxAskAmountIndex - 1);
  const bestAsk = book.asks[bestAskIndex];
  return bestAsk[2];
};

const cutBook = (book, length) => ({
  bids: book.bids.slice(0, length),
  asks: book.asks.slice(0, length),
});

const updateUserWallet = async (rawWallet, rest) => {
  const wallet = Wallet.unserialize(rawWallet);
  if (wallet.type === 'funding' && wallet.currency === 'USD') {
    setInState(['user', 'wallet', wallet.type, wallet.currency, 'balance'], wallet.balance);
    setInState(['user', 'wallet', wallet.type, wallet.currency, 'balanceAvailable'], wallet.balanceAvailable);
    const state = getState();
    if (wallet.balanceAvailable - state.user.config.amountKeep > state.user.config.amountMin) {
      // 自動掛單
      const offerableBalance = wallet.balanceAvailable - state.user.config.amountKeep;
      const newFo = new FundingOffer({
        type: 'LIMIT',
        symbol: 'fUSD',
        rate: state.infer.bestAskRate,
        amount: Math.min(Math.max(offerableBalance, state.user.config.amountMin), state.user.config.amountMax),
        period: 2,
      }, rest);
      try {
        const foRes = await rest.submitFundingOffer(newFo);
        const fo = FundingOffer.unserialize(foRes.notifyInfo);
      } catch (e) {
        console.log(e);
      }
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

const updateUserLedgers = async (rest) => {
  const START = Date.now() - (30 * 24 * 60 * 60 * 1000);
  const END = Date.now();
  const LIMIT = 25;

  try {
    const ledgersIn30Days = await rest.ledgers({
      ccy: 'USD',
      category: 28, // margin / swap / interest payment, see https://docs.bitfinex.com/reference#rest-auth-ledgers
    }, START, END, LIMIT);
    const userLedgers = ledgersIn30Days.map(leArray => LedgerEntry.unserialize(leArray));
    setInState(['user', 'ledgers'], userLedgers);
    console.log('[BFX] ledgers fetched');
  } catch (e) {
    console.log(e);
  }
};

const tryToCloseWS = async () => {
  if (ws !== null) {
    try {
      await ws.close();
      ws = null;
    } catch (e) {
      console.log(e);
    }
  }
};

const tryToCloseAuthWS = async () => {
  if (authWS !== null) {
    try {
      await authWS.close();
      authWS = null;
    } catch (e) {
      console.log(e);
    }
  }
};

// https://stackoverflow.com/a/14032965/2443984
const registerCleanUpHandler = () => {
  if (cleanUpHandlerRegistered) {
    return;
  }
  process.stdin.resume();

  function exitHandler(options, exitCode) {
    if (options.cleanup) {
      tryToCloseWS();
      tryToCloseAuthWS();
      console.log('[BFX] Clean');
    };
    if (exitCode || exitCode === 0) {
      tryToCloseWS();
      tryToCloseAuthWS();
      console.log(`[BFX] Exit with code: ${exitCode}`)
    };
    if (options.exit) {
      process.exit();
    }
  }

  //do something when app is closing
  process.on('exit', exitHandler.bind(null,{cleanup:true}));

  //catches ctrl+c event
  process.on('SIGINT', exitHandler.bind(null, {exit:true}));

  // catches "kill pid" (for example: nodemon restart)
  process.on('SIGUSR1', exitHandler.bind(null, {exit:true}));
  process.on('SIGUSR2', exitHandler.bind(null, {exit:true}));

  //catches uncaught exceptions
  process.on('uncaughtException', exitHandler.bind(null, {exit:true}));

  cleanUpHandlerRegistered = true;
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

  // refresh ledgers every 10 minutes after initial fetch
  await updateUserLedgers(rest);
  setInterval(() => {
    updateUserLedgers(rest);
  }, 10 * 3600 * 1000);

  try {
    const userInfo = await rest.userInfo();
    setInState(['user', 'info'], UserInfo.unserialize(userInfo));
    console.log('[BFX] user info fetched');
  } catch (e) {
    console.error('Fail to initialize.', e);
  }

  registerCleanUpHandler(ws, authWS);

  setState('connected', true);
};

module.exports = {
  createBFXPublicWS,
  createBFXAuthWS,
  createBFXRest,
  initialize,
};
