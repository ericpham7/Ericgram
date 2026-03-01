FROM node:20-bookworm-slim AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend ./
RUN npm run build

FROM debian:bookworm-slim AS backend-builder

RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential cmake libssl-dev pkg-config && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY CMakeLists.txt ./
COPY main.cpp ./
COPY server.hpp ./
COPY include ./include

RUN cmake -S . -B build && cmake --build build --config Release

FROM debian:bookworm-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates libssl3 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=backend-builder /app/build/my_app /app/my_app
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

ENV HOST=0.0.0.0
ENV PORT=10000
ENV STATIC_DIR=/app/frontend/dist
ENV ERICGRAM_ENV=production
ENV COOKIE_SECURE=true

EXPOSE 10000

CMD ["/app/my_app"]
