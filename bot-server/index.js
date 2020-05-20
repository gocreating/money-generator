const express = require('express');
const cors = require('cors');
const routes = require('./routes');

const app = express();
const port = process.env.PORT || 7000;

app.use(cors());
routes(app);
app.listen(port, function () {
  console.log(`[Server] listening on port ${port}.`);
});
