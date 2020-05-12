const { STREAM_TYPES } = require('./constants');

const wallet = {
  funding: {
    USD: {
      balance: 0,
      balanceAvailable: 0,
    },
  },
};

const handleBalance = (payload) => {
  const [
    WALLET_TYPE,        // string,      Wallet name (exchange, margin, funding)
    CURRENCY,           // string,      Currency (fUSD, etc)
    BALANCE,            // float,       Wallet balance
    UNSETTLED_INTEREST, // float,       Unsettled interest
    BALANCE_AVAILABLE,  // float/null,	Amount not tied up in active orders, positions or funding (null if the value is not fresh enough).
    DESCRIPTION,        // string,      Description of the ledger entry
    META,               // json,        Provides info on the reason for the wallet update, if available.
  ] = payload;
  if (WALLET_TYPE === 'funding') {
    const availableCurrencies = Object.keys(wallet.funding);
    if (availableCurrencies.includes(CURRENCY)) {
      wallet.funding[CURRENCY].balance = BALANCE;
      wallet.funding[CURRENCY].balanceAvailable = BALANCE_AVAILABLE;
    }
  }
};

const handleBFXChannelStream = (type, payload, rawStream) => {
  console.log(`---------------------------`);
  switch (type) {
    case STREAM_TYPES.HEART_BEATING: {
      console.log(wallet);
      break;
    }
    case STREAM_TYPES.BALANCE_UPDATE: {
      console.log('Ignore type: BALANCE_UPDATE');
      const [
        AUM,     // float, Total Assets Under Management
        AUM_NET, // float, Net Assets Under Management (total assets - total liabilities)
      ] = payload;
      break;
    }
    case STREAM_TYPES.WALLET_SNAPSHOT: {
      console.log('WALLET_SNAPSHOT');
      payload.forEach(walletUpdatePayload => handleBalance(walletUpdatePayload));
      break;
    }
    case STREAM_TYPES.WALLET_UPDATE: {
      console.log('WALLET_UPDATE');
      handleBalance(payload);
      break;
    }
    case STREAM_TYPES.FUNDING_OFFER_SNAPSHOT: {
      console.log('Ignore type: FUNDING_OFFER_SNAPSHOT');
      break;
    }
    case STREAM_TYPES.FUNDING_CREDITS_SNAPSHOT: {
      console.log('Ignore type: FUNDING_CREDITS_SNAPSHOT');
      break;
    }
    case STREAM_TYPES.FUNDING_CREDITS_UPDATE: {
      console.log('Ignore type: FUNDING_CREDITS_UPDATE');
      break;
    }
    case STREAM_TYPES.FUNDING_LOANS_SNAPSHOT: {
      console.log('Ignore type: FUNDING_LOANS_SNAPSHOT');
      break;
    }
    case STREAM_TYPES.NOTIFICATION: {
      const [
        MTS,            // int,          Millisecond Time Stamp of the update
        TYPE,           // string,       Purpose of notification ('on-req', 'oc-req', 'uca', 'fon-req', 'foc-req')
        MESSAGE_ID,     // int,          unique ID of the message
        ,
        [
          ID,           // integer,      Offer ID
          SYMBOL,       // string,       The currency of the offer (fUSD, etc)
          MTS_CREATED,  // int,          Millisecond Time Stamp when the offer was created
          MTS_UPDATED,  // int,          Millisecond Time Stamp when the offer was created
          AMOUNT,       // float,        Current amount of the offer
          AMOUNT_ORIG,  // float,        Amount of the initial offer
          OFFER_TYPE,   // string,       Offer Type
          ,
          ,
          FLAGS,        // int,          Flags active on the offer; see https://docs.bitfinex.com/v2/docs/flag-values
          OFFER_STATUS, // string,       Offer Status: ACTIVE, EXECUTED, PARTIALLY FILLED, CANCELED
          ,
          ,
          ,
          RATE,         // float,        Rate of the offer
          PERIOD,       // int,          Period of the offer
          NOTIFY,       // boolean,      True / false
          HIDDEN,       // int,          0 if false, 1 if true
          ,
          RENEW,        // boolean,      True / false
          ,
        ],
        CODE,           // null/integer, Work in progress
        STATUS,         // string,       Status of the notification; it may vary over time (SUCCESS, ERROR, FAILURE, ...)
        TEXT,           // string,       Text of the notification
      ] = payload;
      if (TYPE === 'fon-req') {
        if (STATUS === 'ERROR') {
          console.log(`Fail to create new funding offer: ${TEXT}`);
        }
      }
      break;
    }
    default: {
      console.log(rawStream);
    }
  }
};

module.exports = handleBFXChannelStream;
