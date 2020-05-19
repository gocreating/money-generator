import React, { useState, useEffect } from 'react';
import { withRouter } from 'next/router';

const HomePage = ({ router, status }) => {
  const { BITFINEX_API_KEY, BITFINEX_API_SECRET } = router.query;
  const [info, setInfo] = useState({});
  const [intervalId, setIntervalId] = useState();

  useEffect(() => {
    if (!intervalId) {
      setIntervalId(setInterval(async () => {
        const res = await fetch(`http://localhost:3000/api/info`);
        const info = await res.json();
        setInfo(info);
      }, 2000));
    }
    return () => {
      clearInterval(intervalId);
    }
  }, [intervalId]);

  return (
    <div>
      <p>{status}</p>
      <p>{BITFINEX_API_KEY}</p>
      <p>{BITFINEX_API_SECRET}</p>
      <hr />
      {JSON.stringify(info)}
    </div>
  )
};

HomePage.getInitialProps = async (ctx) => {
  const { BITFINEX_API_KEY, BITFINEX_API_SECRET } = ctx.query;
  const res = await fetch(`http://localhost:3000/api/enable?BITFINEX_API_KEY=${BITFINEX_API_KEY}&BITFINEX_API_SECRET=${BITFINEX_API_SECRET}`);
  const { status } = await res.json();
  return { status };
};

export default withRouter(HomePage);
