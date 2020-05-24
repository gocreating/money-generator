FROM node:10-alpine

WORKDIR /srv/money-generator

COPY package*.json ./

RUN apk update && \
    yarn && \
    rm -rf /var/cache/apk/*

COPY . /srv/money-generator

RUN rm next.config.js && \
    mv next.config.prod.js next.config.js

RUN yarn build

EXPOSE 3000
EXPOSE 7000

ARG IMAGE_TAG

ENV NODE_ENV=production \
    imageTag=${IMAGE_TAG}

ENTRYPOINT ["sh", "/srv/money-generator/docker-entrypoint.sh"]
