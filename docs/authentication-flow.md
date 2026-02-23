# Authentication Flow Documentation

This document provides a detailed, step-by-step guide to the authentication module in the Shubha Vivah Matrimony project.

---

## 1. User Registration Flow

The registration is a two-step process: account creation followed by email verification via OTP.

### Step 1: Account Creation

**Endpoint:** `POST /auth/register`
**Public Access:** Yes

**Request Example:**

```json
{
  "fullName": "John Doe",
  "email": "john@example.com",
  "phone": "9876543210",
  "password": "SecurePassword123!",
  "gender": "Male",
  "dob": "1995-01-01",
  "maritalStatus": "Never Married",
  "religion": "Hindu",
  "brand": "ShubhaVivah",
  "profileFor": "Self"
}
```

**Internal Logic:**

1. Checks if email or phone is already registered.
2. Validates role (defaults to `USER`).
3. Creates a new `User` document.
4. Creates a `UserDetails` document linked to the user.
5. Generates and sends a 4-digit OTP to the user's email via `OtpService`.

**Response:**

```json
{
  "message": "OTP sent successfully to jo***n@example.com",
  "data": {
    "expiresIn": 600,
    "otp": "1234" // Only for dev/test environments
  }
}
```

### Step 2: Email Verification

**Endpoint:** `POST /auth/verify-otp`

**Request Example:**

```json
{
  "identifier": "john@example.com",
  "otp": "1234",
  "purpose": "REGISTRATION"
}
```

**Internal Logic:**

1. Validates OTP from Redis.
2. Marks `isEmailVerified: true` in the User document.
3. Returns a short-lived `verificationToken` (JWT) for subsequent steps if needed.

---

## 2. Login Flow

Users can login via **Email/Password** or **Phone/OTP**.

### Option A: Email & Password

**Endpoint:** `POST /auth/login`

**Request Example:**

```json
{
  "email": "john@example.com",
  "password": "SecurePassword123!",
  "rememberMe": true,
  "fcmToken": "firebase-token-xyz"
}
```

**Internal Logic:**

1. Validates credentials.
2. Records failed attempts and locks account if brute-force is detected.
3. On успеха:
   - Generates Access Token (JWT) and Refresh Token.
   - Creates/Updates a `DeviceSession`.
   - Returns user profile data and tokens.

### Option B: Phone & OTP (Passwordless)

**Step 1: Request OTP**
**Endpoint:** `POST /auth/login` (requesting OTP)

```json
{
  "phone": "9876543210"
}
```

_Logic: Sends OTP to phone and returns `expiresIn`._

**Step 2: Verify & Finalize**
**Endpoint:** `POST /auth/verify-otp` (purpose: `LOGIN_VERIFICATION`)
_Logic: User receives a `verificationToken` after OTP verification._

**Step 3: Complete Login**
**Endpoint:** `POST /auth/login` (with token)

```json
{
  "phone": "9876543210",
  "verificationToken": "eyJhbG..."
}
```

---

## 3. Session & Token Management

### Token Refresh

**Endpoint:** `POST /auth/refresh`
**Guard:** `JwtRefreshGuard` (Requires Refresh Token in Bearer header)

**Response:**

```json
{
  "accessToken": "new-access-token",
  "refreshToken": "new-refresh-token",
  "tokenType": "Bearer",
  "expiresIn": "15m"
}
```

### Logout Options

- `POST /auth/logout`: Revokes the current device session.
- `POST /auth/logout-all`: Revokes all active sessions for the user.
- `POST /auth/logout-other-devices`: Revokes all sessions except the current one.

### Multi-Device Support

- Users can have a maximum number of concurrent sessions (default: 5).
- If the limit is reached, the oldest session is automatically revoked upon a new login.
- Device information (Browser, OS, IP, Location) is tracked for security.

---

## 4. Password Recovery

### Step 1: Request Reset

**Endpoint:** `POST /auth/forgot-password`

```json
{ "phone": "9876543210" }
```

_Logic: Sends OTP to the registered phone number._

### Step 2: Verify OTP

**Endpoint:** `POST /auth/verify-otp` (purpose: `PASSWORD_RESET`)
_Logic: Returns a `verificationToken`._

### Step 3: Reset Password

**Endpoint:** `POST /auth/reset-password`

```json
{
  "verificationToken": "eyJhbG...",
  "password": "NewSecurePassword123!"
}
```

_Logic: Updates password and revokes all active sessions._

---

## 5. Security Features

1. **Throttling:** Strict rate limiting on OTP requests and login attempts.
2. **Account Locking:** Temporary lockout after multiple failed login attempts.
3. **Password Hashing:** Uses `argon2` for secure password storage.
4. **Device Fingerprinting:** Unique `deviceId` generated per user-agent to track sessions.
5. **Suspicious Activity Logging:** Tracks brute-force attempts and new device logins.
