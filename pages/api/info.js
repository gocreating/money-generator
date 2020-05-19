import { initialized, orderBook, user } from './enable';

export default (req, res) => {
  res.json({
    initialized,
    orderBook,
    user,
  });
};
