# 🚀 Edge Server & PM2 Operations Guide

This guide documents the commands to restart, monitor, and manage the CCTV Edge Server and PM2 background services.

---

## ⚡ Quick Restart Commands

Run these commands in the **Administrator Command Prompt (CMD)** on your Windows Server (`WIN-0T8N581GN63`):

### 1. Restart All Services (Recommended)
Restarts the Attendance API, Ngrok Tunnel, and CCTV AI Face Recognition pipeline in one command:
```cmd
pm2 restart all
```

---

### 2. Restart Individual Services by Name or ID

| ID | Service Name | Purpose | Restart Command |
|---|---|---|---|
| **0** | `paradigm-attendance-api` | Node.js Backend & Stream Proxy (Port 4000) | `pm2 restart 0` or `pm2 restart paradigm-attendance-api` |
| **2** | `paradigm-ngrok-tunnel` | Public Cloud Ngrok Tunnel | `pm2 restart 2` or `pm2 restart paradigm-ngrok-tunnel` |
| **3** | `paradigm-cctv` | Python FastAPI Core & InsightFace AI (Port 4100) | `pm2 restart 3` or `pm2 restart paradigm-cctv` |

---

## 📊 Status & Health Check

### Check Process Status
```cmd
pm2 status
```
or
```cmd
pm2 list
```

### View Live Real-time Logs
To view logs of all services:
```cmd
pm2 logs
```

To view logs for a specific service:
```cmd
pm2 logs paradigm-cctv
pm2 logs paradigm-attendance-api
```

---

## 🛑 Stop & Start Commands

### Stop All Services
```cmd
pm2 stop all
```

### Start All Services
```cmd
pm2 start all
```

---

## 💾 Save Configuration (Persist on Windows Reboot)
If you add or update PM2 services and want them to auto-start after Windows boots:
```cmd
pm2 save
```

---

## 📁 Directory Paths Reference

- **CCTV Project Directory:** `C:\cctv-attendance`
- **Main Backend API Port:** `4000` (Node Express)
- **CCTV Engine Port:** `4100` (Python FastAPI)
- **Public Tunnel URL:** `https://tassel-estranged-prism.ngrok-free.dev`
