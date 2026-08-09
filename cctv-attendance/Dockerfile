FROM python:3.11-slim

# Install system dependencies for OpenCV, SQLite, and curl healthchecks
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose Admin API port
EXPOSE 4100

# Run the edge server pipeline + admin server
CMD ["python", "main.py"]
