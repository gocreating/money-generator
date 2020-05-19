import React, { useState, useEffect } from 'react';
import { withRouter } from 'next/router';
import useInterval from '../hooks/useInterval';

const HomePage = ({ router }) => {
  const { BITFINEX_API_KEY, BITFINEX_API_SECRET } = router.query;
  const [status, setStatus] = useState('idle');
  const [info, setInfo] = useState({});

  useEffect(() => {
    setStatus('connecting...');
    fetch(`http://localhost:3000/api/enable?BITFINEX_API_KEY=${BITFINEX_API_KEY}&BITFINEX_API_SECRET=${BITFINEX_API_SECRET}`)
      .then(results => results.json())
      .then(data => {
        if (data.status === 'ok') {
          setStatus('ready');
        } else if (data.status === 'error') {
          setStatus('error');
        }
      });
  }, []);

  useInterval(() => {
    fetch(`http://localhost:3000/api/info`)
      .then(results => results.json())
      .then(data => {
        setInfo(data);
      });
  }, 2000);

  return (
    <div>
      <p>{`status: ${status}`}</p>
      <p>{BITFINEX_API_KEY}</p>
      <p>{BITFINEX_API_SECRET}</p>
      <hr />
      {JSON.stringify(info)}
    </div>
  )
};

export default withRouter(HomePage);
