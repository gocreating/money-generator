module.exports = {
  STREAM_TYPES: {
    /**
     * See [Abbreviation Glossary](https://docs.bitfinex.com/docs/abbreviations-glossary)
     */
    HEART_BEATING: 'hb',

    BALANCE_UPDATE: 'bu',

    WALLET_SNAPSHOT: 'ws',
    WALLET_UPDATE: 'wu',

    FUNDING_OFFER_SNAPSHOT: 'fos',
    FUNDING_OFFER_NEW: 'fon',
    FUNDING_OFFER_UPDATE: 'fou',
    FUNDING_OFFER_CANCEL: 'foc',

    FUNDING_CREDITS_SNAPSHOT: 'fcs',
    FUNDING_CREDITS_NEW: 'fcn',
    FUNDING_CREDITS_UPDATE: 'fcu',
    FUNDING_CREDITS_CLOSE: 'fcc',

    FUNDING_LOANS_SNAPSHOT: 'fls',
    FUNDING_LOANS_NEW: 'fln',
    FUNDING_LOANS_UPDATE: 'flu',
    FUNDING_LOANS_CLOSE: 'flc',

    NOTIFICATION: 'n',
  },
};
