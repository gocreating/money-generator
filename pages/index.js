import React, { useState, useEffect } from 'react';
import { withRouter } from 'next/router';
import round from 'lodash/round';
import useInterval from '../hooks/useInterval';

const HomePage = ({ router }) => {
  const { BITFINEX_API_KEY, BITFINEX_API_SECRET } = router.query;
  const [status, setStatus] = useState('idle');
  const [refreshSecond, setRefreshSecond] = useState(null);
  const [info, setInfo] = useState({
    connected: false,
    orderBook: {
      bids: [],
      asks: [],
    },
    user: {},
  });
  const { connected, orderBook, user } = info;

  useEffect(() => {
    if (!BITFINEX_API_KEY || !BITFINEX_API_SECRET) {
      setStatus('idle');
      return;
    }
    if (connected) {
      return;
    }
    if (status === 'error') {
      return;
    }
    setStatus('connecting...');
    fetch(`${process.env.BOT_SERVER_HOST}/api/connect?BITFINEX_API_KEY=${BITFINEX_API_KEY}&BITFINEX_API_SECRET=${BITFINEX_API_SECRET}`)
      .then(results => results.json())
      .then(data => {
        if (data.status === 'ok') {
          setStatus('ready');
          setRefreshSecond(2);
        } else if (data.status === 'error') {
          setStatus('error');
        }
      });
  }, [connected, BITFINEX_API_KEY, BITFINEX_API_SECRET]);

  useInterval(() => {
    fetch(`${process.env.BOT_SERVER_HOST}/api/state`)
      .then(results => results.json())
      .then(data => {
        setInfo(data);
      });
  }, refreshSecond ? refreshSecond * 1000 : null);

  const balance = round(info.user.wallet?.funding.USD.balance || 0, 2);
  const balanceAvailable = round(info.user.wallet?.funding.USD.balanceAvailable || 0, 2);

  return (
    <div>
      <table>
        <tbody>
          <tr>
            <th>Dashboard Status</th>
            <td>{status}</td>
          </tr>
          <tr>
            <th>Refresh Interval</th>
            <td>
              {refreshSecond ? `Every ${refreshSecond} seconds` : 'waiting...'}
            </td>
          </tr>
          <tr>
            <th>API Key</th>
            <td>{BITFINEX_API_KEY}</td>
          </tr>
          <tr>
            <th>API Secret</th>
            <td>{BITFINEX_API_SECRET}</td>
          </tr>
          <tr>
            <th>Total Founding Balance</th>
            <td>{`${balance} USD (${round(balance * 30, 0)} TWD)`}</td>
          </tr>
          <tr>
            <th>Available Founding Balance</th>
            <td>{`${balanceAvailable} USD (${round(balanceAvailable * 30, 0)} TWD)`}</td>
          </tr>
          <tr>
            <th>User</th>
            <td>
              <div>{`id: ${info.user.info?.id}`}</div>
              <div>{`email: ${info.user.info?.email}`}</div>
              <div>{`username: ${info.user.info?.username}`}</div>
              <div>{`timezone: ${info.user.info?.timezone}`}</div>
            </td>
          </tr>
        </tbody>
      </table>
      <hr />
      <table>
        <caption>Provided</caption>
        <thead>
          <tr>
            <th>Offer ID</th>
            <th>Symbol</th>
            <th>Position Pair</th>
            <th>Status</th>
            <th>Type</th>
            <th>Amount</th>
            <th>Rate</th>
            <th>Period</th>
            <th>Expires</th>
          </tr>
        </thead>
        <tbody>
          {Object.keys(info.user.fundingCreditMap || []).map(offerId => {
            const fc = info.user.fundingCreditMap[offerId];
            const now = new Date();
            const expiringInHour = Math.floor((fc.mtsOpening + fc.period * 86400000 - now.getTime()) / 3600000);
            const expiringInDay = Math.floor(expiringInHour / 24);
            let expStr = '';
            if (expiringInHour < 24) {
              expStr = `${expiringInHour} hours`;
            } else {
              expStr = `${expiringInDay} days`;
            }
            return (
              <tr key={offerId}>
                <td>{fc.id}</td>
                <td>{fc.symbol}</td>
                <td>{fc.positionPair}</td>
                <td>{fc.status}</td>
                <td>{fc.type}</td>
                <td>{round(fc.amount, 2)}</td>
                <td>{`${round(fc.rate * 100, 5)}% (${round(fc.rate * 365 * 100, 1)}% annualized)`}</td>
                <td>{`${fc.period} days`}</td>
                <td>{`in ${expStr}`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <hr />
      <table>
        <caption>{'Bids & Offers'}</caption>
        <thead>
          <tr>
            <th>Offer ID</th>
            <th>Symbol</th>
            <th>Amount</th>
            <th>Rate</th>
            <th>Period</th>
          </tr>
        </thead>
        <tbody>
          {Object.keys(info.user.fundingOfferMap || []).map(offerId => {
            const fo = info.user.fundingOfferMap[offerId];
            return (
              <tr key={offerId}>
                <td>{fo.id}</td>
                <td>{fo.symbol}</td>
                <td>{round(fo.amount, 2)}</td>
                <td>{`${round(fo.rate * 100, 5)}% (${round(fo.rate * 365 * 100, 1)}% annualized)`}</td>
                <td>{fo.period}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <hr />
      <table>
        <caption>{'Order Book'}</caption>
        <thead>
          <tr>
            <th colSpan={4}>Bid</th>
            <th colSpan={4}>Ask</th>
          </tr>
          <tr>
            <td>ID</td>
            <td>Period</td>
            <td>Amount</td>
            <td>Rate</td>

            <td>Rate</td>
            <td>Amount</td>
            <td>Period</td>
            <td>ID</td>
          </tr>
        </thead>
        <tbody>
          {orderBook.bids.map((bid, i) => {
            const ask = orderBook.asks[i];
            return (
              <tr key={bid[0]}>
                <td>{bid[0]}</td>
                <td>{bid[1]}</td>
                <td>{round(-bid[3], 1)}</td>
                <td>
                  {`${round(bid[2] * 100, 6)}%`}
                  {i === 0 && `(${round(bid[2] * 365 * 100, 1)}% annualized)`}
                </td>

                <td>
                  {`${round(ask[2] * 100, 6)}%`}
                  {i === 0 && `(${round(ask[2] * 365 * 100, 1)}% annualized)`}
                </td>
                <td>{round(ask[3], 1)}</td>
                <td>{ask[1]}</td>
                <td>{ask[0]}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  )
};

export default withRouter(HomePage);
