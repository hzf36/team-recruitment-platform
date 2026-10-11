FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM node:20-alpine AS backend-build
WORKDIR /app/backend
COPY backend/package.json ./
RUN npm install
COPY backend/ ./
RUN npm run build && mkdir -p dist/migrations && cp -r src/migrations/*.sql dist/migrations/

FROM node:20-alpine
ENV NODE_ENV=production
ENV PORT=8080
WORKDIR /app
COPY backend/package.json ./backend/
WORKDIR /app/backend
RUN npm install --omit=dev
COPY --from=backend-build /app/backend/dist ./dist
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist
ENV STATIC_DIR=/app/frontend/dist
EXPOSE 8080
CMD ["node", "dist/index.js"]
