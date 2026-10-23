FROM node:24-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates curl git unzip xz-utils build-essential pkg-config \
    && rm -rf /var/lib/apt/lists/*
