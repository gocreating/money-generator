const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const routes = require('./routes');

const app = express();
const port = process.env.PORT || 7000;

app.use(cors());
app.use(bodyParser.json());
routes(app);
app.listen(port, function () {
  console.log(`[Server] listening on port ${port}.`);
});
