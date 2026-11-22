# Backend Dockerfile for ApexAgent (when building from /backend context)
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

# Install system dependencies (including bubblewrap for sandbox isolation)
RUN apt-get update && apt-get install -y --no-install-recommends \
    bubblewrap \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r apexuser && useradd -r -g apexuser -m -d /home/apexuser apexuser

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY . /app/

# Set ownership to non-root user
RUN chown -R apexuser:apexuser /app

USER apexuser

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
