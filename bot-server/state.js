const state = {
  connected: false,
  orderBook: {
    bids: [],
    asks: [],
  },
  user: {
    config: {
      amountKeep: 186,
      amountMin: 50,
      fixedOfferRate: 0.000979, // 0.099999% per day
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
