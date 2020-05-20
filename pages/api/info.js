import { connected, orderBook, user } from './connection';

export default (req, res) => {
  res.json({
    connected,
    orderBook,
    user,
  });
};
