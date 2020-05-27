const state = {
  imageTag: process.env.imageTag,
  connected: false,
  orderBook: {
    bids: [],
    asks: [],
  },
  infer: {
    bestAskRate: null,
  },
  user: {
    config: {
      enableBot: true,
      amountKeep: 105,
      amountMin: 50,
      amountMax: 300,
      minOfferRate: 0.000273972602739726, // 10% p.a.
      enableFixedOfferRate: false,
      fixedOfferRate: null,
      enableFixedOfferPeriod: true,
      fixedOfferPeriod: 2,
      refreshOfferWhenNotMatchedInSecond: 6 * 60,
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
    ledgers: [],
  },
};

const getState = () => state;
const setState = (key, value) => {
  state[key] = value;
};
const setInState = (paths, value) => {
  let i;
  let obj = state;
  for (i = 0; i < paths.length - 1; i++) {
    obj = obj[paths[i]];
  }
  obj[paths[i]] = value;
};

module.exports = {
  getState,
  setState,
  setInState,
};
