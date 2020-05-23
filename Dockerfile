FROM node:10-alpine

WORKDIR /srv/money-generator

COPY package*.json ./

RUN apk update && \
    yarn && \
    rm -rf /var/cache/apk/*

COPY . /srv/money-generator

RUN yarn build

EXPOSE 3000
