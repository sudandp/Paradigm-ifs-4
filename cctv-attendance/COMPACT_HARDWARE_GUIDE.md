# CCTV Attendance — Compact Hardware & Edge Deployment Guide

> **Document Purpose**: Technical reference for deploying the CCTV Attendance Edge Engine on low-cost, compact hardware (Raspberry Pi, Mini PCs, NVIDIA Jetson) instead of full-sized servers.

---

## 🎯 Architectural Overview

The `cctv-attendance` edge server is built with **platform independence** in mind:
* **Runtime**: Pure Python 3.10+
* **Inference Engine**: ONNX Runtime (CPU quantized / CUDA / TensorRT)
* **Local Storage**: Embedded SQLite (`cctv_attendance.db`)
* **Network Protocol**: HTTP/REST (Supabase + RTSP)

Because it has **zero dependency on Windows-specific APIs**, the entire edge server can run natively on Linux, ARM64 (Raspberry Pi), or containerized inside Docker.

---

## 📊 Compact Hardware Tiers & Benchmarks

| Hardware Device | Approx. Cost | Power Draw | OS | Concurrent Cameras | Frame Rate | Recommended Use Case |
|---|---|---|---|---|---|---|
| **Raspberry Pi 5 (8GB)** | ~$80 - $100 | ~5W - 8W | Raspberry Pi OS (Debian 12 ARM64) | 1 – 2 Cameras | 3 FPS | Small site, single entry gate |
| **Intel N100 Mini PC** (Beelink / Trigkey / Geekom) | ~$130 - $160 | ~6W - 12W | Ubuntu Server 22.04 LTS (x86_64) | 3 – 5 Cameras | 5 FPS | Standard site, multi-gate entry/exit |
| **NVIDIA Jetson Orin Nano (8GB)** | ~$250 - $300 | ~7W - 15W | JetPack Linux (Ubuntu 22.04 ARM64) | 6 – 10 Cameras | 15+ FPS | High throughput site, busy main gates |
| **Existing Windows Server** | N/A | Variable | Windows 10/11 / Windows Server | 5 – 10 Cameras | 5-10 FPS | Testing & centralized site server |

---

## 🐳 Option 1: Docker Deployment (1-Click Container)

The cleanest way to deploy to any compact Linux hardware (Raspberry Pi, Mini PC) is via Docker.

### 1. `Dockerfile`
Location: `cctv-attendance/Dockerfile`

```dockerfile
FROM python:3.11-slim

# Install system dependencies for OpenCV & SQLite
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

# Copy application files
COPY . .

# Expose Admin API port
EXPOSE 4100

# Run the edge server
CMD ["python", "main.py"]
```

### 2. `docker-compose.yml`
Location: `cctv-attendance/docker-compose.yml`

```yaml
version: '3.8'

services:
  cctv-attendance:
    build: .
    container_name: cctv-attendance-edge
    restart: always
    network_mode: host
    env_file:
      - .env
    volumes:
      - ./data:/app/data
      - ./snapshots:/app/snapshots
      - ./models:/app/models
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4100/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Deploy Commands on Raspberry Pi / Linux Mini PC:
```bash
cd /opt/cctv-attendance
docker compose up -d --build
```

---

## 🐧 Option 2: Native Linux Systemd Service (Non-Docker)

For direct Linux installations without Docker:

### Create Service File `/etc/systemd/system/cctv-attendance.service`:

```ini
[Unit]
Description=Paradigm CCTV Attendance Edge Server
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/opt/cctv-attendance
ExecStart=/opt/cctv-attendance/venv/bin/python main.py
Restart=always
RestartSec=5
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
```

### Enable & Start Commands:
```bash
sudo systemctl daemon-reload
sudo systemctl enable cctv-attendance
sudo systemctl start cctv-attendance
sudo systemctl status cctv-attendance
```

---

## ⚙️ Hardware Tuning & Optimization Guidelines

When running on resource-constrained devices like Raspberry Pi:

1. **Adjust `PROCESSING_FPS` in `.env`**:
   * For Raspberry Pi 5: Set `PROCESSING_FPS=2` or `PROCESSING_FPS=3`
   * For Intel N100: Set `PROCESSING_FPS=5`

2. **RTSP Stream Sub-Stream Selection**:
   * Most CCTV cameras (Hikvision, Dahua, CP Plus) offer two streams:
     * **Main Stream**: 1080p / 4K (high bandwidth)
     * **Sub Stream**: 640x360 / 720x480 (low bandwidth)
   * **Always use the Sub-Stream URL for face recognition** on compact hardware. 640x360 is ideal for face detection and uses 70% less CPU!

3. **Snapshot Retention**:
   * Set `SAVE_SNAPSHOTS=true` and `SNAPSHOT_RETENTION_DAYS=3` on devices with limited storage (SD cards / eMMC).

---

## 🛡️ Enclosure & Field Power Considerations

* **Power over Ethernet (PoE)**: Use a PoE Splitter (5V/4A USB-C) so the Raspberry Pi or Mini PC is powered directly from the network switch — no wall adapter required!
* **Weatherproof Enclosure**: Mount the device inside an IP66 outdoor junction box at the entry gate.
* **Passive Cooling**: Use fanless metal-case Mini PCs (e.g. Intel N100 fanless) to prevent dust buildup in harsh field environments.
