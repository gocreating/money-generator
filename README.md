# Money Generator

## Deploy

``` bash
docker-compose -f docker-compose-prod.yaml up
```

## Develop

1. Install dependencies

    ``` bash
    yarn
    ```

2. Launch bot server

    ``` bash
    # for develop
    nodemon bot-server

    # for production
    yarn start-bot
    ```

3. Launch portal server

    ``` bash
    # for develop
    yarn dev

    # for production
    yarn build
    yarn start
    ```

4. Open portal in browser

    `http://localhost:3000/?BITFINEX_API_KEY=xxx&BITFINEX_API_SECRET=xxx`

## Description

FundingOffer -> (FundingTrade) -> FundingCredit

## Reference

- <https://docs.bitfinex.com/reference>
- <./node_modules/bitfinex-api-node/docs/index.html>
