# 1. Build Image
FROM node:22-alpine AS builder

RUN mkdir /app
WORKDIR /app

COPY tsconfig.json ./
COPY tsconfig.build.json ./
COPY package.json ./
COPY package-lock.json ./

COPY src src

RUN npm ci
RUN npm run build


FROM node:22-alpine

RUN mkdir /app
WORKDIR /app

COPY tsconfig.json ./
COPY tsconfig.build.json ./
COPY package.json ./
COPY package-lock.json ./
COPY src/database src/database
COPY src/config/sequelize.config.js src/config/sequelize.config.js
COPY .sequelizerc ./

COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/dist dist
CMD [ "node", "dist/src/main.js" ]
