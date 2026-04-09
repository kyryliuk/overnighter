# ============================================================
# Stage 1: Builder — installs deps and compiles the Vite SPA
# ============================================================
FROM node:24-alpine AS builder

WORKDIR /app

# Install dependencies first (layer-cached unless lockfile changes)
COPY package*.json ./
RUN npm ci

# Build-time env vars injected via docker build --build-arg or compose build.args
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_STRIPE_PUBLISHABLE_KEY
ARG VITE_SENTRY_DSN

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_STRIPE_PUBLISHABLE_KEY=$VITE_STRIPE_PUBLISHABLE_KEY
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN

# Copy source after deps so source changes don't bust the npm ci cache
COPY . .

RUN npm run build

# ============================================================
# Stage 2: Production — minimal nginx image serving the dist/
# ============================================================
FROM nginx:alpine AS production

# Replace default nginx config with our SPA-aware config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
