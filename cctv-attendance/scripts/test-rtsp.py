import cv2, os, sys, time

urls = [
    ("NVR Main (subtype=0, %40)", "rtsp://admin:Paradigm%402006@192.168.51.111:554/cam/realmonitor?channel=1&subtype=0"),
    ("NVR Sub  (subtype=1, %40)", "rtsp://admin:Paradigm%402006@192.168.51.111:554/cam/realmonitor?channel=1&subtype=1"),
    ("NVR Main (subtype=0, raw@)", "rtsp://admin:Paradigm@2006@192.168.51.111:554/cam/realmonitor?channel=1&subtype=0"),
    ("NVR HIK  (ch101)",           "rtsp://admin:Paradigm%402006@192.168.51.111:554/Streaming/Channels/101"),
    ("CAM .149 (Dahua main)",      "rtsp://admin:Paradigm%402006@192.168.51.149:554/cam/realmonitor?channel=1&subtype=0"),
    ("CAM .150 (Dahua main)",      "rtsp://admin:Paradigm%402006@192.168.51.150:554/cam/realmonitor?channel=1&subtype=0"),
    ("CAM .149 (HIK ch101)",       "rtsp://admin:Paradigm%402006@192.168.51.149:554/Streaming/Channels/101"),
]

print("=" * 65)
print("  RTSP Credential & Stream Tester")
print("=" * 65)

working = None
for label, url in urls:
    os.environ['OPENCV_FFMPEG_CAPTURE_OPTIONS'] = 'rtsp_transport;tcp|fflags;nobuffer|timeout;4000000'
    try:
        cap = cv2.VideoCapture(url, cv2.CAP_FFMPEG)
        opened = cap.isOpened()
        if opened:
            ret, frame = cap.read()
            if ret and frame is not None:
                h, w = frame.shape[:2]
                print(f"  [OK]   {label}  ->  {w}x{h}")
                working = url
            else:
                print(f"  [OPEN] {label}  ->  Connected but NO frames")
            cap.release()
        else:
            print(f"  [FAIL] {label}")
    except Exception as e:
        print(f"  [ERR]  {label}  ->  {e}")

print()
if working:
    print(f"WORKING URL FOUND:")
    print(f"  {working}")
    print()
    print("Update C:\\cctv-attendance\\.env CAMERAS= line with this URL,")
    print("then run: pm2 restart paradigm-cctv")
else:
    print("NO WORKING RTSP URL FOUND.")
    print("Check NVR web panel: http://192.168.51.111")
    print("  -> System -> Network -> Advanced -> RTSP: Enabled")
    print("  -> Check port 554 not blocked by NVR firewall")
print("=" * 65)
