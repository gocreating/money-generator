import { orderBook, user } from './enable';

export default (req, res) => {
  res.json({
    orderBook,
    user,
  });
};
