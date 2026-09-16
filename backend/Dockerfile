FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY packages ./packages

RUN npm install

COPY . .

ENV PORT=8000
EXPOSE 8000

CMD ["npm", "run", "start"]
