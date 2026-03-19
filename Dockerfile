# Build Stage
FROM node:20-slim AS build

WORKDIR /app
# Note: we assume the build command is run from the root of 'practise'
# and we only copy the 'chinese-flashcards' folder contents
COPY chinese-flashcards/package*.json ./
RUN npm install
COPY chinese-flashcards/ .
RUN npm run build

# Production Stage
FROM node:20-slim

ENV NODE_ENV=production
WORKDIR /app

# Copy everything from build stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/server.js ./
COPY --from=build /app/package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Standard Cloud Run port
EXPOSE 8080
ENV PORT=8080

CMD ["node", "server.js"]
