FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

RUN npm prune --production

FROM node:20-alpine

WORKDIR /app

RUN npm install -g serve

COPY --from=builder /app .

EXPOSE 3000

CMD ["serve", "-s", ".", "-l", "3000"]
