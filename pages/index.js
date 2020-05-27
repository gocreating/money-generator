import React, { useState, useEffect } from 'react';
import { withRouter } from 'next/router';
import styled, { css } from 'styled-components';
import { useForm } from 'react-hook-form';
import format from 'date-fns/format';
import round from 'lodash/round';
import useInterval from '../hooks/useInterval';
import NoSsr from '../components/NoSsr';

const Table = styled.table`
  border-collapse:collapse;

  caption {
    text-align: left;
    font-size: 24px;
    color: #777;
  }
`;

const Th = styled.th`
  position: relative;
  padding: 0px 8px;
  ${props => props.alignRight && css`
    text-align: right;
  `}
`;

const Td = styled.td`
  position: relative;
  padding: 0px 8px;
  ${props => props.alignRight && css`
    text-align: right;
  `}
`;

const ColorBar = styled.div.attrs(props => ({
  style: {
    width: `${props.percentage * 100}%`,
  },
}))`
  display: block;
  position: absolute;
  top: 0px;
  bottom: 0px;
  z-index: -1;

  ${props => css`
    ${props.green && css`
      background-color: rgb(210, 235, 220);
    `}
    ${props.red && css`
      background-color: rgb(252, 220, 222);
    `}
    ${props.percentageRight ? css`
      right: 0px;
    ` : css`
      left: 0px;
    `}
  `}
`;

const Divider = styled.div`
  width: 100%;
  height: 32px;
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
  const { register, reset, handleSubmit } = useForm();
  const { imageTag, connected, orderBook, user } = info;

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

  const handleConfigSubmit = (data) => {
    // convert annualized percentage to daily rate
    data.fixedOfferRate = (data.fixedOfferRate / 365) / 100;
    fetch(`${process.env.BOT_SERVER_HOST}/api/state/user/config`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
      .then(results => results.json())
      .then(res => {
        console.log('update config:', res);
      });
  };

  const balance = round(info.user.wallet?.funding.USD.balance || 0, 2);
  const balanceAvailable = round(info.user.wallet?.funding.USD.balanceAvailable || 0, 2);
  const totalBidAmount = orderBook.bids.reduce((sum, bid) => sum - bid[3], 0);
  const totalAskAmount = orderBook.asks.reduce((sum, ask) => sum + ask[3], 0);
  let accBidAmount = 0;
  let accAskAmount = 0;
  const totalProvidedAmount = Object.values(info.user.fundingCreditMap || []).reduce((sum, fc) => sum + fc.amount, 0);
  const dailyEarning = Object.keys(info.user.fundingCreditMap || []).reduce((sum, offerId) => {
    const fc = info.user.fundingCreditMap[offerId];
    return sum + fc.amount * fc.rate;
  }, 0);
  const fundingEarnings = (info.user.ledgers || []).reduce((sum, ledger) => sum + ledger.amount, 0);

  return (
    <NoSsr>
      <Table>
        <caption>Account</caption>
        <tbody>
          <tr>
            <Th alignRight>ID</Th>
            <Td>{info.user.info?.id}</Td>
          </tr>
          <tr>
            <Th alignRight>Email</Th>
            <Td>{info.user.info?.email}</Td>
          </tr>
          <tr>
            <Th alignRight>Username</Th>
            <Td>{info.user.info?.username}</Td>
          </tr>
          <tr>
            <Th alignRight>Timezone</Th>
            <Td>{info.user.info?.timezone}</Td>
          </tr>
          <tr>
            <Th alignRight>Total Founding Balance</Th>
            <Td>{`${balance} USD (${round(balance * 30, 0)} TWD)`}</Td>
          </tr>
          <tr>
            <Th alignRight>Available Founding Balance</Th>
            <Td>{`${balanceAvailable} USD (${round(balanceAvailable * 30, 0)} TWD)`}</Td>
          </tr>
        </tbody>
      </Table>
      <Divider />
      <Table>
        <caption>Bot Configuration</caption>
        <tbody>
          <tr>
            <Th></Th>
            <Th alignRight>Current</Th>
            <Th>
              <button
                onClick={() => {
                  const dailyRate = user.config.fixedOfferRate;
                  reset({
                    ...user.config,
                    fixedOfferRate: dailyRate ? dailyRate * 365 * 100 : undefined,
                  });
                }}
              >
                Edit from current value
              </button>
            </Th>
            <Th>Description</Th>
          </tr>
          <tr>
            <Th alignRight>Enable Bot</Th>
            <Td>{user.config?.enableBot ? 'Enabled' : 'Disabled'}</Td>
            <Td>
              <input id="enableBot" name="enableBot" type="checkbox" ref={register} />
              <label htmlFor="enableBot">Enable</label>
            </Td>
            <Td>Enable the automatic offering bot</Td>
          </tr>
          <tr>
            <Th alignRight>At least keep amount (USD)</Th>
            <Td>{user.config?.amountKeep}</Td>
            <Td><input name="amountKeep" type="number" ref={register} min={0} step={50} /></Td>
            <Td>The minimum amount you want to keep in your USD funding wallet</Td>
          </tr>
          <tr>
            <Th alignRight>Min amount per order (USD)</Th>
            <Td>{user.config?.amountMin}</Td>
            <Td><input name="amountMin" type="number" ref={register} min={50} step={50} /></Td>
            <Td>The minimum amount in an offer</Td>
          </tr>
          <tr>
            <Th alignRight>Max amount per order (USD)</Th>
            <Td>{user.config?.amountMax}</Td>
            <Td><input name="amountMax" type="number" ref={register} min={50} step={50} /></Td>
            <Td>The maximum amount in an offer</Td>
          </tr>
          <tr>
            <Th alignRight>
              Fix offer rate p.a. (%)
            </Th>
            <Td>
              {
                user.config?.enableFixedOfferRate
                ? `${user.config?.fixedOfferRate * 365 * 100}% p.a.`
                : 'Disabled'
              }
            </Td>
            <Td>
              <input id="enableFixedOfferRate" name="enableFixedOfferRate" type="checkbox" ref={register} />
              <label htmlFor="enableFixedOfferRate">Enable</label>
              <input name="fixedOfferRate" type="number" ref={register} min={0.0} max={2555} step={0.2} />%
            </Td>
            <Td>max: 7% per day</Td>
          </tr>
          <tr>
            <Th alignRight>
              Fix offer period (days)
            </Th>
            <Td>
              {
                user.config?.enableFixedOfferPeriod
                ? `${user.config?.fixedOfferPeriod}`
                : 'Disabled'
              }
            </Td>
            <Td>
              <input id="enableFixedOfferPeriod" name="enableFixedOfferPeriod" type="checkbox" ref={register} />
              <label htmlFor="enableFixedOfferPeriod">Enable</label>
              <input name="fixedOfferPeriod" type="number" ref={register} min={2} max={30} />days
            </Td>
            <Td>min: 2 days, max: 30 days</Td>
          </tr>
          <tr>
            <Th alignRight>
              Refresh offer when not matched (seconds)
            </Th>
            <Td>{`Every ${user.config?.refreshOfferWhenNotMatchedInSecond} seconds`}</Td>
            <Td>
              <input name="refreshOfferWhenNotMatchedInSecond" type="number" ref={register} min={30} />
            </Td>
            <Td>min: 30 seconds</Td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <Td alignRight colSpan={3}>
              <button onClick={handleSubmit(handleConfigSubmit)}>Apply</button>
            </Td>
            <Td />
          </tr>
        </tfoot>
      </Table>
      <Divider />
      <Table>
        <caption>Infer</caption>
        <tbody>
          <tr>
            <Th>Best Offer Rate</Th>
            <Td>
              {`${round(info.infer?.bestAskRate * 100, 5).toFixed(5)}% (${round(info.infer?.bestAskRate * 365 * 100, 1).toFixed(1)}% p.a.)`}
            </Td>
          </tr>
        </tbody>
      </Table>
      <Divider />
      <Table>
        <caption>{`Bids & Offers (${Object.keys(info.user.fundingOfferMap || []).length})`}</caption>
        <thead>
          <tr>
            <Th>Offer ID</Th>
            <Th>Symbol</Th>
            <Th alignRight>Amount</Th>
            <Th alignRight>Rate</Th>
            <Th alignRight>Period</Th>
            <Th>Operation</Th>
          </tr>
        </thead>
        <tbody>
          {Object.keys(info.user.fundingOfferMap || []).map(offerId => {
            const fo = info.user.fundingOfferMap[offerId];
            return (
              <tr key={offerId}>
                <Td>{fo.id}</Td>
                <Td>{fo.symbol}</Td>
                <Td alignRight>{round(fo.amount, 2).toFixed(2)}</Td>
                <Td alignRight>
                  {`${round(fo.rate * 100, 5).toFixed(5)}% (${round(fo.rate * 365 * 100, 1).toFixed(1)}% p.a.)`}
                </Td>
                <Td>{`${fo.period} days`}</Td>
                <Td>
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
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      <Divider />
      <Table>
        <caption>{'Order Book'}</caption>
        <thead>
          <tr>
            <Th colSpan={4}>Bid</Th>
            <Th colSpan={4}>Ask</Th>
          </tr>
          <tr>
            <Td>ID</Td>
            <Td alignRight>Period</Td>
            <Td alignRight>Amount</Td>
            <Td alignRight>Rate</Td>

            <Td>Rate</Td>
            <Td>Amount</Td>
            <Td alignRight>Period</Td>
            <Td>ID</Td>
          </tr>
        </thead>
        <tbody>
          {orderBook.bids.map((bid, i) => {
            const ask = orderBook.asks[i];
            accBidAmount -= bid[3];
            accAskAmount += ask[3];

            return (
              <tr key={bid[0]}>
                <Td>{bid[0]}</Td>
                <Td alignRight>{bid[1]}</Td>
                <Td alignRight>
                  {round(-bid[3], 1).toFixed(1)}
                </Td>
                <Td alignRight>
                  {i === 0 && `(${round(bid[2] * 365 * 100, 1)}% p.a.)`}
                  {`${round(bid[2] * 100, 5).toFixed(5)}%`}
                  <ColorBar
                    percentage={accBidAmount / (totalBidAmount + totalAskAmount)}
                    percentageRight
                    green
                  />
                </Td>

                <Td>
                  {`${round(ask[2] * 100, 5).toFixed(5)}%`}
                  {i === 0 && `(${round(ask[2] * 365 * 100, 1)}% p.a.)`}
                  <ColorBar
                    percentage={accAskAmount / (totalBidAmount + totalAskAmount)}
                    red
                  />
                </Td>
                <Td alignRight>{round(ask[3], 1).toFixed(1)}</Td>
                <Td alignRight>{ask[1]}</Td>
                <Td>{ask[0]}</Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      <Divider />
      <Table>
        <caption>{`Provided (${Object.keys(info.user.fundingCreditMap || []).length})`}</caption>
        <thead>
          <tr>
            <Th>Offer ID</Th>
            <Th>Symbol</Th>
            <Th>Position Pair</Th>
            <Th>Status</Th>
            <Th>Type</Th>
            <Th alignRight>Amount</Th>
            <Th alignRight>Rate</Th>
            <Th alignRight>Rate p.a.</Th>
            <Th alignRight>Period</Th>
            <Th alignRight>Expires in</Th>
          </tr>
        </thead>
        <tbody>
          {Object.keys(info.user.fundingCreditMap || []).map(offerId => {
            const fc = info.user.fundingCreditMap[offerId];
            const now = new Date();
            const expiringInSecond = (fc.mtsOpening + fc.period * 86400000 - now.getTime()) / 1000;
            const expiringInMinute = expiringInSecond / 60;
            const expiringInHour = expiringInMinute / 60;
            const expiringInDay = expiringInHour / 24;
            let expStr = '';
            if (expiringInSecond < 0) {
              expStr = `expired (under settlement)`;
            } else if (expiringInSecond < 60) {
              expStr = `${Math.floor(expiringInSecond)} hours`;
            } else if (expiringInMinute < 60) {
              expStr = `${Math.floor(expiringInMinute)} minutes`;
            } else if (expiringInHour < 48) {
              expStr = `${Math.floor(expiringInHour)} hours`;
            } else {
              expStr = `${Math.floor(expiringInDay)} days`;
            }
            return (
              <tr key={offerId}>
                <Td>{fc.id}</Td>
                <Td>{fc.symbol}</Td>
                <Td>{fc.positionPair}</Td>
                <Td>{fc.status}</Td>
                <Td>{fc.type}</Td>
                <Td alignRight>{round(fc.amount, 2).toFixed(2)}</Td>
                <Td alignRight>
                  {`${round(fc.rate * 100, 5).toFixed(5)}%`}
                  <ColorBar
                    percentage={fc.amount / totalProvidedAmount}
                    percentageRight
                    red
                  />
                </Td>
                <Td alignRight>
                  {`${round(fc.rate * 365 * 100, 1).toFixed(1)}%`}
                </Td>
                <Td alignRight>{`${fc.period} days`}</Td>
                <Td alignRight>{expStr}</Td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <Th>Daily Earning (After 15% fee)</Th>
            <Td colSpan={8}>
              {`${round(dailyEarning * 0.85, 2).toFixed(2)} USD (${round(dailyEarning * 0.85 * 30, 0)} TWD)`}
            </Td>
          </tr>
        </tfoot>
      </Table>
      <Divider />
      <Table>
        <caption>Funding Earnings in recent 30 Days</caption>
        <thead>
          <tr>
            <Th>ID</Th>
            <Th>Description</Th>
            <Th>Currency</Th>
            <Th>Amount</Th>
            <Th>Balance</Th>
            <Th>Date</Th>
          </tr>
        </thead>
        <tbody>
          {(info.user.ledgers || []).map(ledger => (
            <tr key={ledger.id}>
              <Td>{ledger.id}</Td>
              <Td>{ledger.description}</Td>
              <Td>{ledger.currency}</Td>
              <Td>{ledger.amount}</Td>
              <Td>{ledger.balance}</Td>
              <Td>{format(ledger.mts, 'yyyy/MM/dd HH:mm:ss')}</Td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <Th>Total</Th>
            <Td colSpan={5}>
              {`${round(fundingEarnings, 2).toFixed(2)} USD (${round(fundingEarnings * 30, 0)} TWD)`}
            </Td>
          </tr>
        </tfoot>
      </Table>
      <Divider />
      <Table>
        <caption>Monitor Dashboard</caption>
        <tbody>
          <tr>
            <Th alignRight>Money Generator Image Tag</Th>
            <Td>
              {imageTag
                ? <a href={`https://hub.docker.com/layers/gocreating/money-generator/${imageTag}`} target="_blank">{imageTag}</a>
                : '(dev)'}
            </Td>
          </tr>
          <tr>
            <Th alignRight>Bitfinex API Connection Status</Th>
            <Td>{status}</Td>
          </tr>
          <tr>
            <Th alignRight>Refresh Interval</Th>
            <Td>
              {refreshSecond ? `Every ${refreshSecond} seconds` : 'waiting...'}
            </Td>
          </tr>
          <tr>
            <Th alignRight>Funding Earnings Refresh Interval</Th>
            <Td>
              {'Every 20 minutes'}
            </Td>
          </tr>
          <tr>
            <Th alignRight>API Key</Th>
            <Td>{BITFINEX_API_KEY}</Td>
          </tr>
          <tr>
            <Th alignRight>API Secret</Th>
            <Td>{BITFINEX_API_SECRET}</Td>
          </tr>
        </tbody>
      </Table>
    </NoSsr>
  );
};

export default withRouter(HomePage);
