FROM node:20-alpine

WORKDIR /app

# Copy root package files and lockfile
COPY package*.json ./
COPY packages ./packages
COPY server ./server

# Install all dependencies (including workspace packages)
RUN npm install

WORKDIR /app/server

EXPOSE 4000

CMD ["npm", "run", "start"]