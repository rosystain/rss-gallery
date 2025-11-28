# ---- 前端构建 ----
FROM node:20 AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install --frozen-lockfile
COPY frontend/ ./
RUN npm run build

# ---- 后端构建 ----
FROM python:3.11-slim AS backend-build
WORKDIR /app/backend
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./

# ---- 生产镜像 ----
FROM python:3.11-slim
WORKDIR /app
COPY --from=frontend-build /app/frontend/dist ./frontend/dist
COPY --from=backend-build /app/backend ./backend
ENV PYTHONUNBUFFERED=1
EXPOSE 3001
EXPOSE 5173
CMD ["bash", "-c", "cd backend && uvicorn app.main:app --host 0.0.0.0 --port 3001 & cd ../frontend && npx serve dist --listen 5173"]
