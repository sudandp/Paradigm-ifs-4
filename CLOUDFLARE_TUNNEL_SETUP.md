# 🌐 Cloudflare Permanent Named Tunnel Setup Guide

> **Domain:** `cctv.rest`  
> **Tunnel Name:** `paradigm-edge`  
> **Server Machine:** `WIN-0T8N581GN63`  
> **Date Configured:** August 20, 2026  

---

## 📌 Architecture Overview

Instead of temporary random quick-tunnels (`trycloudflare.com` / free Ngrok) which expire and change URLs, the server uses a **Permanent Cloudflare Named Tunnel** installed directly as a **native 24/7 Windows Background Service**.

```
                           ┌──────────────────────────────────────────────┐
                           │          Dedicated Domain: cctv.rest         │
                           └──────────────────────┬───────────────────────┘
                                                  │
                       ┌──────────────────────────┴──────────────────────────┐
                       │   Cloudflare Zero Trust Permanent Named Tunnel      │
                       │           (Tunnel: paradigm-edge)                   │
                       └──────────────┬──────────────────────┬───────────────┘
                                      │                      │
                                      ▼                      ▼
                    ┌──────────────────────────┐   ┌──────────────────────────┐
                    │ attendance.cctv.rest     │   │ cctv.cctv.rest           │
                    │ (Port 4000)              │   │ (Port 4100)              │
                    └─────────────┬────────────┘   └─────────────┬────────────┘
                                  │                              │
                                  ▼                              ▼
                    ┌──────────────────────────┐   ┌──────────────────────────┐
                    │ Node.js Attendance API   │   │ Python CCTV AI Engine    │
                    │ MS SQL (etimetracklite1) │   │ RTSP Camera Streams      │
                    └──────────────────────────┘   └──────────────────────────┘
```

---

## 🛠️ Step-by-Step Configuration Log

### 1. Domain Registration & DNS Delegation
* **Domain:** `cctv.rest` (Registered on GoDaddy).
* **Cloudflare Nameservers (Configured in GoDaddy DNS):**
  1. `steven.ns.cloudflare.com`
  2. `zainab.ns.cloudflare.com`

---

### 2. Cloudflare Zero Trust Tunnel Creation
* **Dashboard:** Cloudflare Zero Trust (`Networks` ➔ `Tunnels`)
* **Tunnel Type:** Cloudflared (Connector)
* **Tunnel Name:** `paradigm-edge`
* **Operating System:** Windows (64-bit)

#### Windows Service Installation Command (Run on Server):
```cmd
cd C:\cctv-attendance
cloudflared.exe service install eyJhIjoiNDFjNjc3NTBmMTUyNjQ3ZDViZjI4ODRkMzJmNGMxZjMiLCJ0IjoiYjdiZmI2OTUtOTFkMi00MzhkLWE5OGQtMDJmNjg4NTJhMGZkIiwicyI6Ik4yRXdZVE5qT1RjdFpUazVZeTAwWkRWaExXSTFOekl0WlRWa05qZGhZelppTUdNNSJ9
```

> **Note:** The `cloudflared` agent runs natively as a Windows Service (`windowsServiceName=Cloudflared`). It starts automatically on Windows boot and handles automatic exponential backoff and reconnections if internet drops.

---

### 3. Public Hostnames & Port Routing

Under the `paradigm-edge` tunnel configuration in Cloudflare Zero Trust, two published application routes are configured:

| Public URL | Service Type | Local Origin URL | Purpose |
| :--- | :---: | :--- | :--- |
| **`https://attendance.cctv.rest`** | `HTTP` | `http://127.0.0.1:4000` | MS SQL Biometric Attendance API (`attendance-api`) |
| **`https://cctv.cctv.rest`** | `HTTP` | `http://127.0.0.1:4100` | CCTV Live Camera Stream & AI Engine (`paradigm-cctv`) |

---

## 🚀 Server Process Management (PM2)

The server runs only the two essential core applications under PM2:

| ID | Name | Port | Command / Entry Point | Role |
|:---|:---|:---:|:---|:---|
| **`0`** | `attendance-api` | `4000` | `node server.js` | Express MS SQL backend |
| **`1`** | `paradigm-cctv` | `4100` | `node cctv-runner.js` | Python FastAPI + InsightFace AI |

### Useful PM2 Commands:

```cmd
# Check status
pm2 status

# View live logs
pm2 logs attendance-api
pm2 logs paradigm-cctv

# Restart all services
pm2 restart all

# Save running processes (persists on reboot)
pm2 save
```

---

## 🔍 Verification & Health Checks

You can verify both endpoints in any browser or terminal:

### 1. Attendance API Healthcheck
* **URL:** `https://attendance.cctv.rest/health`
* **Expected Response:**
```json
{
  "service": "Paradigm Attendance API",
  "status": "running",
  "database": "etimetracklite1",
  "time": "2026-08-20T11:39:21.611Z"
}
```

### 2. CCTV Stream Engine Healthcheck
* **URL:** `https://cctv.cctv.rest/health`
* **Expected Response:**
```json
{
  "status": "running",
  "service": "Paradigm CCTV Attendance Edge Server",
  "device_id": "server-win-0t8n581gn63",
  "time": "2026-08-20T11:39:46Z",
  "enrolled_count": 1,
  "cloud_enabled": true,
  "object_detector_ready": false
}
```

---

## 🔄 Reinstall / Disaster Recovery

If you ever move to a new server machine or reinstall Windows:

1. Copy `C:\attendance-api\` and `C:\cctv-attendance\` to the server.
2. In `C:\attendance-api\`, run `npm install` and start via PM2:
   ```cmd
   pm2 start server.js --name "attendance-api"
   ```
3. In `C:\cctv-attendance\`, run `setup.bat` and start via PM2:
   ```cmd
   pm2 start cctv-runner.js --name "paradigm-cctv"
   ```
4. Install the Cloudflare Windows Service:
   ```cmd
   cloudflared.exe service install eyJhIjoiNDFjNjc3NTBmMTUyNjQ3ZDViZjI4ODRkMzJmNGMxZjMiLCJ0IjoiYjdiZmI2OTUtOTFkMi00MzhkLWE5OGQtMDJmNjg4NTJhMGZkIiwicyI6Ik4yRXdZVE5qT1RjdFpUazVZeTAwWkRWaExXSTFOekl0WlRWa05qZGhZelppTUdNNSJ9
   ```
5. Save PM2: `pm2 save`.
