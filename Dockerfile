# Stage 1: Build the Node.js application
FROM node:20-slim AS builder

RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

# Stage 2: Production image with Node.js + Python 3
FROM node:20-slim

RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

# Install Python 3 and pip
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      python3 \
      python3-pip \
      python3-venv && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies from requirements.txt
COPY requirements.txt .
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

WORKDIR /app

# Copy built artifacts and production dependencies
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile --prod

# dist/ contains both the server bundle (index.js) and client assets (public/)
COPY --from=builder /app/dist ./dist

# Copy Python scripts next to the bundled JS so __dirname resolution works
COPY server/statistics_engine.py ./dist/statistics_engine.py
COPY server/advanced_statistics.py ./dist/advanced_statistics.py

# Set Python path for the statistics service
ENV PYTHON_PATH=/usr/bin/python3
ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
