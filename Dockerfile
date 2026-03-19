# Build Stage
FROM node:20-slim AS build

WORKDIR /app
COPY chinese-flashcards/package*.json ./
RUN npm install
COPY chinese-flashcards/ .
RUN npm run build

# Production Stage
FROM node:20-slim

WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/server.js ./
COPY --from=build /app/package*.json ./
RUN npm install --omit=dev

EXPOSE 3001
CMD ["node", "server.js"]
