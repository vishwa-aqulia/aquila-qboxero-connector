FROM node:20-slim AS node-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y nodejs npm && rm -rf /var/lib/apt/lists/*
COPY --from=node-builder /app/dist ./dist
COPY --from=node-builder /app/node_modules ./node_modules
COPY --from=node-builder /app/package.json ./package.json
RUN pip install fastapi==0.110.0 google-cloud-bigquery==3.25.0 google-cloud-core==2.4.1 pydantic==2.6.4 python-dotenv==1.0.1 requests==2.32.3 sqlalchemy==2.0.30 "uvicorn[standard]==0.29.0" --break-system-packages
COPY app ./app
COPY main.py ./main.py
COPY start.sh ./start.sh
EXPOSE 5000
ENV PORT=5000
ENV NODE_ENV=production
CMD ["./start.sh"]
