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
        </tbody>
      </table>
      <hr />
      <table>
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
                <td>{round(bid[2] * 100, 6)}%</td>

                <td>{round(ask[2] * 100, 6)}%</td>
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
