import React, { useState, useEffect } from 'react';
import { withRouter } from 'next/router';
import styled, { css } from 'styled-components';
import round from 'lodash/round';
import useInterval from '../hooks/useInterval';

const Table = styled.table`
  border-collapse:collapse;
`;

const Th = styled.th`
  ${props => props.alignRight && css`
    text-align: right;
  `}
`;

const Td = styled.td`
  ${props => props.alignRight && css`
    text-align: right;
  `}
  ${props => props.percentage && css`
    position: relative;

    ::after {
      content: '';
      width: ${props.percentage * 100}%;
      display: block;
      position: absolute;
      top: 0px;
      bottom: 0px;
      z-index: -1;

      ${props.percentageRed && css`
        background-color: rgb(252, 220, 222);
      `}
      ${props.percentageGreen && css`
        background-color: rgb(210, 235, 220);
      `}
      ${props.percentageRight ? css`
        right: 0px;
      ` : css`
        left: 0px;
      `}
    }
  `}
`;

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
  const totalBidAmount = orderBook.bids.reduce((sum, bid) => sum - bid[3], 0);
  const totalAskAmount = orderBook.asks.reduce((sum, ask) => sum + ask[3], 0);
  let accBidAmount = 0;
  let accAskAmount = 0;
  const totalProvidedAmount = Object.values(info.user.fundingCreditMap || []).reduce((sum, fc) => sum + fc.amount, 0);

  return (
    <div>
      <table>
        <caption>Account</caption>
        <tbody>
          <tr>
            <Th alignRight>ID</Th>
            <td>{info.user.info?.id}</td>
          </tr>
          <tr>
            <Th alignRight>Email</Th>
            <td>{info.user.info?.email}</td>
          </tr>
          <tr>
            <Th alignRight>Username</Th>
            <td>{info.user.info?.username}</td>
          </tr>
          <tr>
            <Th alignRight>Timezone</Th>
            <td>{info.user.info?.timezone}</td>
          </tr>
          <tr>
            <Th alignRight>Total Founding Balance</Th>
            <td>{`${balance} USD (${round(balance * 30, 0)} TWD)`}</td>
          </tr>
          <tr>
            <Th alignRight>Available Founding Balance</Th>
            <td>{`${balanceAvailable} USD (${round(balanceAvailable * 30, 0)} TWD)`}</td>
          </tr>
        </tbody>
      </table>
      <hr />
      <Table>
        <caption>{`Provided (${Object.keys(info.user.fundingCreditMap || []).length})`}</caption>
        <thead>
          <tr>
            <th>Offer ID</th>
            <th>Symbol</th>
            <th>Position Pair</th>
            <th>Status</th>
            <th>Type</th>
            <Th alignRight>Amount</Th>
            <Th alignRight>Rate</Th>
            <Th alignRight>Period</Th>
            <Th alignRight>Expires</Th>
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
                <Td alignRight>{round(fc.amount, 2).toFixed(2)}</Td>
                <Td
                  alignRight
                  percentage={fc.amount / totalProvidedAmount}
                  percentageRight
                  percentageRed
                >
                  {`${round(fc.rate * 100, 5).toFixed(5)}% (${round(fc.rate * 365 * 100, 1).toFixed(1)}% annualized)`}
                </Td>
                <Td alignRight>{`${fc.period} days`}</Td>
                <Td alignRight>{`in ${expStr}`}</Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      <hr />
      <table>
        <caption>{`Bids & Offers (${Object.keys(info.user.fundingOfferMap || []).length})`}</caption>
        <thead>
          <tr>
            <th>Offer ID</th>
            <th>Symbol</th>
            <Th alignRight>Amount</Th>
            <Th alignRight>Rate</Th>
            <Th alignRight>Period</Th>
            <th>Operation</th>
          </tr>
        </thead>
        <tbody>
          {Object.keys(info.user.fundingOfferMap || []).map(offerId => {
            const fo = info.user.fundingOfferMap[offerId];
            return (
              <tr key={offerId}>
                <td>{fo.id}</td>
                <td>{fo.symbol}</td>
                <Td alignRight>{round(fo.amount, 2).toFixed(2)}</Td>
                <Td alignRight>
                  {`${round(fo.rate * 100, 5).toFixed(5)}% (${round(fo.rate * 365 * 100, 1).toFixed(1)}% annualized)`}
                </Td>
                <td>{`${fo.period} days`}</td>
                <td>
                  <button
                    onClick={() => {
                      fetch(`${process.env.BOT_SERVER_HOST}/api/offer/${fo.id}/close`, { method: 'POST' })
                        .then(results => results.json())
                        .then(data => {
                          console.log('close offer:', data);
                        });
                    }}
                  >
                    Close
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <hr />
      <table>
          <caption>Infer</caption>
        <tbody>
          <tr>
            <th>Best Offer Rate</th>
            <td>
              {`${round(info.infer?.bestAskRate * 100, 5).toFixed(5)}% (${round(info.infer?.bestAskRate * 365 * 100, 1).toFixed(1)}% annualized)`}
            </td>
          </tr>
        </tbody>
      </table>
      <hr />
      <Table>
        <caption>{'Order Book'}</caption>
        <thead>
          <tr>
            <th colSpan={4}>Bid</th>
            <th colSpan={4}>Ask</th>
          </tr>
          <tr>
            <td>ID</td>
            <Td alignRight>Period</Td>
            <Td alignRight>Amount</Td>
            <Td alignRight>Rate</Td>

            <td>Rate</td>
            <td>Amount</td>
            <Td alignRight>Period</Td>
            <td>ID</td>
          </tr>
        </thead>
        <tbody>
          {orderBook.bids.map((bid, i) => {
            const ask = orderBook.asks[i];
            accBidAmount -= bid[3];
            accAskAmount += ask[3];

            return (
              <tr key={bid[0]}>
                <td>{bid[0]}</td>
                <Td alignRight>{bid[1]}</Td>
                <Td alignRight>
                  {round(-bid[3], 1).toFixed(1)}
                </Td>
                <Td
                  alignRight
                  percentage={accBidAmount / (totalBidAmount + totalAskAmount)}
                  percentageGreen
                  percentageRight
                >
                  {i === 0 && `(${round(bid[2] * 365 * 100, 1)}% annualized)`}
                  {`${round(bid[2] * 100, 5).toFixed(5)}%`}
                </Td>

                <Td
                  percentage={accAskAmount / (totalBidAmount + totalAskAmount)}
                  percentageRed
                >
                  {`${round(ask[2] * 100, 5).toFixed(5)}%`}
                  {i === 0 && `(${round(ask[2] * 365 * 100, 1)}% annualized)`}
                </Td>
                <Td alignRight>{round(ask[3], 1).toFixed(1)}</Td>
                <Td alignRight>{ask[1]}</Td>
                <td>{ask[0]}</td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      <hr />
      <table>
        <caption>Monitor Dashboard</caption>
        <tbody>
          <tr>
            <th>Bitfinex API Connection Status</th>
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
    </div>
  )
};

export default withRouter(HomePage);
