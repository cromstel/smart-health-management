# API Reference Documentation - Smart Health Manager

## 1. Overview & General Conventions
The Smart Health Manager backend exposes RESTful HTTP API endpoints under the `/api` namespace.

- **Base URL**: `http://localhost:3000/api` (or environment server URL)
- **Content Type**: `application/json`
- **Authentication**: Bearer Token or HttpOnly Session Cookie (`smart_health_session`)
- **CSRF Token**: Required on `POST`, `PUT`, `DELETE` operations via `X-CSRF-Token` header.

---

## 2. Authentication Endpoints

### 2.1 Login (`POST /api/auth/login`)
Authenticates user credentials and initiates session.
- **Request Body**:
  ```json
  {
    "email": "doctor@hospital.org",
    "password": "SecurePassword123!"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "user": {
      "id": "usr-101",
      "name": "Dr. Sarah Jenkins",
      "email": "doctor@hospital.org",
      "role": "Clinician",
      "department": "Cardiology"
    },
    "requires2FA": false
  }
  ```

### 2.2 Verify Two-Factor Code (`POST /api/auth/2fa/verify`)
- **Request Body**:
  ```json
  {
    "tempToken": "tmp_sess_89234789",
    "code": "582910"
  }
  ```

---

## 3. Patient Vitals Endpoints

### 3.1 Fetch Patient Vitals History (`GET /api/vitals/patient/:patientId`)
Retrieves longitudinal vitals records for a specified patient.
- **Query Parameters**:
  - `range`: `7d` | `30d` | `90d` | `all` (default: `30d`)
- **Response (200 OK)**:
  ```json
  {
    "patientId": "PAT-8821",
    "records": [
      {
        "id": "vtl-901",
        "recordedAt": "2026-09-08T10:30:00Z",
        "recordedBy": "Dr. Sarah Jenkins",
        "systolicBp": 142,
        "diastolicBp": 88,
        "heartRate": 84,
        "temperature": 37.2,
        "oxygenSaturation": 97,
        "status": "high"
      }
    ],
    "summary": {
      "latestBp": "142/88 mmHg",
      "trend": "Concerning",
      "stabilityIndex": 72
    }
  }
  ```

### 3.2 Log New Vital Record (`POST /api/vitals`)
Logs a new biometric reading.
- **Request Body**:
  ```json
  {
    "patientId": "PAT-8821",
    "systolicBp": 145,
    "diastolicBp": 92,
    "heartRate": 102,
    "temperature": 38.4,
    "oxygenSaturation": 94,
    "notes": "Patient reporting headache and mild fever."
  }
  ```

---

## 4. Patient Management & Public Portal Endpoints

### 4.1 Generate Shared Patient Summary Link (`POST /api/shared/patient-summary/generate`)
Creates a temporary 15-minute encrypted URL for external consultation.
- **Request Body**:
  ```json
  {
    "patientId": "PAT-8821",
    "patientName": "Eleanor Vance"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "token": "a8f9d023b1c",
    "shareUrl": "https://hospital.org/shared/patient-summary/a8f9d023b1c",
    "expiresAt": "2026-09-08T13:15:00Z"
  }
  ```

---

## 5. Staff Capacity & Load Balancer Endpoints

### 5.1 Fetch Staff Capacity Metrics (`GET /api/staff/capacity`)
- **Query Parameters**:
  - `shift`: `Morning` | `Afternoon` | `Night` | `All`
- **Response (200 OK)**:
  ```json
  {
    "staff": [
      {
        "id": "stf-01",
        "name": "Dr. Sarah Jenkins",
        "department": "Cardiology",
        "shift": "Morning",
        "currentLoad": 14,
        "maxCapacity": 12,
        "thresholdExceeded": true,
        "weeklyQuota": 50,
        "weeklyCompleted": 48,
        "dailyTrend": [10, 11, 12, 14, 13, 14, 15]
      }
    ]
  }
  ```

---

## 6. Standard Error Responses

```json
{
  "error": {
    "code": "UNAUTHORIZED_ACCESS",
    "message": "Session token expired or missing CSRF validation.",
    "timestamp": "2026-09-08T12:39:46Z"
  }
}
```
