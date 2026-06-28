FROM node:alpine AS builder

WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
RUN npm run build

FROM node:alpine

WORKDIR /app
COPY package.json .
RUN npm install --omit=dev
COPY --from=builder /app/build ./build

CMD ["node", "build/index.js"]
