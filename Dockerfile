# DANIELS AI Research Preview API
# Deploy on Hugging Face Spaces (Docker SDK) or any container host.
#
# Build:  docker build -t danielsai-api .
# Run:    docker run -p 7860:7860 \
#           -e OPENROUTER_API_KEY=sk-or-... \
#           -e DANIELSAI_API_KEY=your-secret-key \
#           danielsai-api
#
# OPENROUTER_API_KEY: Your OpenRouter key (powers all model calls)
# DANIELSAI_API_KEY:    Auth key callers must send as Bearer token
# HF_TOKEN:           HuggingFace write token for auto-publishing data
# HF_DATASET_REPO:    Target HF dataset repo (e.g. LYS10S/danielsai-research)

FROM node:20-slim

# Install curl (untuk healthcheck)
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files dan install dependencies
COPY package*.json ./
RUN npm ci

# Copy SELURUH kode sumber
COPY . .

# --- BAGIAN INI YANG KAMU LUPAKAN ---
# Jalankan build agar folder .next tercipta
RUN npm run build
# ------------------------------------

# Setting user untuk keamanan
RUN addgroup --system app && adduser --system --ingroup app --home /home/app app
RUN chown -R app:app /app /home/app /app/.next

# Install concurrently agar bisa jalanin 2 proses sekaligus
RUN npm install -g concurrently
RUN npm install http-proxy-middleware

# Switch to non-root user
USER app

# Set HOME environment variable
ENV HOME=/home/app

# HF Spaces expects port 7860
ENV PORT=7860
EXPOSE 7860

CMD ["npx", "concurrently", "next start", "npx tsx api/server.ts"]
