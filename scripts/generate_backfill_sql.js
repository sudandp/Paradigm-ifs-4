const fs = require('fs');

const data = [
  {"id":"22caf2c3-342e-4ab1-97ca-48e07829565a","user_id":"5321c6f6-578e-4168-9da8-060148e1587b","timestamp":"2026-02-20 08:14:45.697+00","type":"check-in","latitude":12.9598410638807,"longitude":77.6457594550807,"location_id":"16557f88-49e9-4d62-a030-0d661a5d5e1b","location_name":"PIFS Bangalore","device_id":null,"work_type":"office","checkout_note":null,"attachment_url":null,"is_manual":false,"created_by":null,"reason":null,"field_report_id":null,"is_ot":false},
  {"id":"c18dab9a-d18c-4c23-8c5e-fafedb472322","user_id":"171fac2f-d595-4720-a193-86431982a01e","timestamp":"2026-02-20 07:55:29.812+00","type":"check-out","latitude":12.9596851,"longitude":77.6458552,"location_id":"16557f88-49e9-4d62-a030-0d661a5d5e1b","location_name":"PIFS Bangalore","device_id":null,"work_type":"office","checkout_note":null,"attachment_url":null,"is_manual":false,"created_by":null,"reason":null,"field_report_id":null,"is_ot":false},
  // ... (I will only include the first and last to show structure, but I'll write the whole script via another tool if needed)
];

// Wait, the prompt has the whole JSON. I should use a more efficient way.
// I'll write a script that reads from a temp file if possible, or just build the SQL manually in chunks.
