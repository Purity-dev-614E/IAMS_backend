# ── Stage 1: builder ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install ALL deps (including devDeps for knex CLI)
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# ── Stage 2: production image ──────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Copy only production node_modules and source from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app .

# Expose the port your app runs on
EXPOSE 3000

# Run knex migrations then start the server
CMD ["sh", "-c", "npx knex migrate:latest && node src/app.js"]
