const BFX = require('bitfinex-api-node');
const { WSv2, RESTv2 } = require('bitfinex-api-node');
const { FundingCredit, FundingOffer, FundingTrade, LedgerEntry, UserInfo, Wallet } = require('bfx-api-node-models');
const round = require('lodash/round');
const padStart = require('lodash/padStart');
const { getState, setState, setInState } = require('./state');

let cleanUpHandlerRegistered = false;
let ws = null
let authWS = null;
let rest = null;
let ledgerIntervalId = null;

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
  rest = new RESTv2({
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

// 自動掛單
const autoOffer = async () => {
  const state = getState();
  const { wallet, config } = state.user;

  if (!config.enableBot) {
    return;
  }
  if (wallet.funding.USD.balanceAvailable - config.amountKeep < config.amountMin) {
    return;
  }

  const offerableBalance = wallet.funding.USD.balanceAvailable - config.amountKeep;
  let offerRate;
  if (config.enableFixedOfferRate) {
    offerRate = config.fixedOfferRate;
  }
  if (typeof offerRate !== 'number' || offerRate <= 0) {
    offerRate = state.infer.bestAskRate;
  }
  let offerPeriod;
  if (config.enableFixedOfferPeriod) {
    offerPeriod = config.fixedOfferPeriod;
  }
  if (typeof offerPeriod !== 'number' || offerPeriod <= 0) {
    offerPeriod = 2;
  }
  let offerAmount = Math.min(Math.max(offerableBalance, config.amountMin), config.amountMax);

  const newFo = new FundingOffer({
    type: 'LIMIT',
    symbol: 'fUSD',
    rate: offerRate,
    amount: offerAmount,
    period: offerPeriod,
  }, rest);
  try {
    const foRes = await rest.submitFundingOffer(newFo);
    const fo = FundingOffer.unserialize(foRes.notifyInfo);
    console.log('[BFX] Auto create offer:', fo.id);
    setTimeout(async () => {
      const state = getState();
      if (state.user.fundingOfferMap[fo.id]) {
        const resOffer = await rest.cancelFundingOffer(parseInt(fo.id));
        console.log(`[BFX] Auto cancel offer: ${fo.id} (${config.refreshOfferWhenNotMatchedInSecond} seconds timeout)`);
      }
    }, config.refreshOfferWhenNotMatchedInSecond * 1000);
  } catch (e) {
    console.log(e);
  }
};

const updateUserWallet = async (rawWallet, rest) => {
  const wallet = Wallet.unserialize(rawWallet);
  if (wallet.type === 'funding' && wallet.currency === 'USD') {
    setInState(['user', 'wallet', wallet.type, wallet.currency, 'balance'], wallet.balance);
    setInState(['user', 'wallet', wallet.type, wallet.currency, 'balanceAvailable'], wallet.balanceAvailable);
    await autoOffer();
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

const removeClosedFundingCredit = (fccArray) => {
  const fc = FundingCredit.unserialize(fccArray);
  setInState(['user', 'fundingCreditMap', fc.id], undefined);
};

const updateFundingCredits = async () => {
  console.log('[BFX] updateFundingCredits');

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
    console.log('[BFX] Ledgers fetched');
  } catch (e) {
    console.log(e);
  }
};

const tryToCloseWS = async () => {
  if (ws !== null && ws.isOpened) {
    try {
      await ws.close();
      console.log('[BFX] WS closed');
    } catch (e) {
      console.log(e);
    }
  }
};

const tryToCloseAuthWS = async () => {
  if (authWS !== null && authWS.isOpened) {
    try {
      await authWS.close();
      console.log('[BFX] AuthWS closed');
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

// FIXME: 防止重複註冊WS listener
// 檢測方式: 撤單使餘額增加，觸發bot -> 檢查是否同時掛2張以上一樣的單
// 暫時已修復，需觀察一段時間
const initialize = async (apiKey, apiSecret) => {
  // clean up existing connections
  tryToCloseWS();
  tryToCloseAuthWS();

  // create new connections
  rest = createBFXRest(apiKey, apiSecret);
  ws = createBFXPublicWS();
  authWS = createBFXAuthWS(apiKey, apiSecret);

  await ws.open();
  await authWS.open();

  ws.isOpened = true;
  authWS.isOpened = true;

  /*
   * Setup handlers
   */

  try {
    const userInfo = await rest.userInfo();
    setInState(['user', 'info'], UserInfo.unserialize(userInfo));
    console.log('[BFX] User info fetched');
  } catch (e) {
    console.error('Fail to initialize.', e);
  }

  authWS.onWalletSnapshot({}, (wallets) => {
    wallets.forEach(wallet => updateUserWallet(wallet, rest));
  });

  authWS.onWalletUpdate({}, (wallet) => {
    updateUserWallet(wallet, rest);
  });

  // 出價
  authWS.onFundingOfferSnapshot({}, (fos) => {
    setInState(['user', 'fundingOfferMap'], {});
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
    const fo = FundingOffer.unserialize(foc);
    console.log('[BFX] Offer closed', fo.id);
    removeUserFundingOffer(foc);
  });

  // 已提供
  authWS.onFundingCreditSnapshot({}, (fcs) => {
    setInState(['user', 'fundingCreditMap'], {});
    fcs.forEach(fcArray => {
      updateUserFundingCredit(fcArray);
    });
  });

  authWS.onFundingCreditUpdate({}, (fcu) => {
    updateUserFundingCredit(fcu);
  });

  authWS.onFundingCreditClose({}, (fcc) => {
    console.log('[BFX] onFundingCreditClose');
    const fc = FundingCredit.unserialize(fccArray);
    console.log(fc);
    removeClosedFundingCredit(fcc);
  });

  authWS.onFundingTradeUpdate({}, (ftu) => {
    const ft = FundingTrade.unserialize(ftu);
    console.log('[BFX] onFundingTradeUpdate');
    console.log(ft);
    console.log(`infer percentage = ${getState().infer.bestAskRate * 100}%, trade rate = ${ft.rate * 100}%`);
    setTimeout(() => {
      console.log(`infer percentage = ${getState().infer.bestAskRate * 100}%, trade rate = ${ft.rate * 100}% (2 seconds later)`);
    }, 2000);
    updateFundingCredits();
  });

  // refresh ledgers every 20 minutes after initial fetch
  await updateUserLedgers(rest);
  if (ledgerIntervalId) {
    clearInterval(ledgerIntervalId);
  }
  ledgerIntervalId = setInterval(() => {
    updateUserLedgers(rest);
  }, 20 * 60 * 1000);

  registerCleanUpHandler(ws, authWS);

  setState('connected', true);

  return { rest, ws, authWS };
};

module.exports = {
  createBFXPublicWS,
  createBFXAuthWS,
  createBFXRest,
  tryToCloseWS,
  tryToCloseAuthWS,
  initialize,
  autoOffer,
};
