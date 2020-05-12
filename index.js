require('dotenv').config();
const crypto = require('crypto-js');
const WebSocket = require('ws');
const handleBFXChannelStream = require('./handleBFXChannelStream');
const createServer = require('./createServer');
const { WS_HOST } = require('./config');

const authNonce = Date.now() * 1000; // Generate an ever increasing, single use value. (a timestamp satisfies this criteria)
const authPayload = 'AUTH' + authNonce // Compile the authentication payload, this is simply the string 'AUTH' prepended to the nonce value
const authSig = crypto.HmacSHA384(authPayload, process.env.BITFINEX_API_SECRET).toString(crypto.enc.Hex) // The authentication payload is hashed using the private key, the resulting hash is output as a hexadecimal string

const payload = {
  event: 'auth',          // The connection event, will always equal 'auth'
  apiKey: process.env.BITFINEX_API_KEY,
  authSig,
  authNonce,
  authPayload,
  filter: [
    'funding',            // offers, credits, loans, funding trades
    'funding-fUSD',       // fBTC offers, credits, loans, funding trades
    'wallet',             // wallet
    'wallet-funding-USD', // Exchange BTC wallet changes
    'algo',               // algorithmic orders
    'balance',            // balance (tradable balance, ...)
    'notify',             // notifications
  ],
};

const wss = new WebSocket(WS_HOST);

const handleBFXMessage = (msg) => {
  switch (msg.event) {
    case 'info': {
      console.log(`serverId:\t`, msg.serverId);
      break;
    }
    case 'auth': {
      console.log(`status:\t`, msg.status);
      console.log(`chanId:\t`, msg.chanId);
      console.log(`userId:\t`, msg.userId);
      console.log(`auth_id:\t`, msg.auth_id);
      console.log(`caps:\t`);
      console.log(`  ${'read'.padStart(20)}  write`);
      Object.keys(msg.caps).forEach(capName => {
        console.log(`  ${capName.padEnd(19)}${msg.caps[capName].read}      ${msg.caps[capName].write}`);
      });
      createServer(wss);
      break;
    }
    default: {
      const [channelId, type, payload] = msg;
      if (channelId === 0) {
        handleBFXChannelStream(type, payload, msg);
      } else {
        console.log('receive data with unknow channel ID:');
        console.log(msg);
      }
    }
  }
};

wss.onopen = () => {
  wss.send(JSON.stringify(payload));
};

wss.onmessage = (msg) => {
  const res = JSON.parse(msg.data);
  handleBFXMessage(res);
};
