FROM node:16-alpine

RUN mkdir /app
WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build
