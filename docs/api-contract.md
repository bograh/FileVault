# FileVault API Contract — Frontend Integration

This document describes the API contract between the frontend and backend.
The frontend previously used mock data; this backend implements the real APIs matching those shapes.

## Authentication

The frontend authenticates via session cookies or Bearer tokens.

### Login Flow
1. `POST /v1/auth/login` with `{ email, password, totp_code? }`
2. If 2FA required: returns `{ requires_2fa: true, challenge_id: "..." }`
3. Otherwise: returns `{ user: User, expires_at: "..." }` + sets `session_token` cookie

### Session
- Cookie: `session_token` (HttpOnly, Secure, SameSite=Lax)
- Can also use `Authorization: Bearer <token>` header

## Data Shapes

All shapes match the TypeScript types in `frontend/src/types/api.ts`.

### Key Differences from Mock → Real Backend

1. **Upload creation** now returns both the upload record AND a presigned URL:
   ```json
   {
     "data": {
       "upload": { ... },
       "presigned_url": "https://..."
     }
   }
   ```
   The frontend should PUT the file to the presigned URL after receiving this response.

2. **Pagination** uses the `Page<T>` shape unchanged:
   ```json
   { "items": [...], "total": 50, "page": 1, "page_size": 20, "has_more": true, "next_cursor": "2" }
   ```

3. **Batch delete** endpoint is `POST /v1/projects/:id/uploads/batch-delete`
   with body `{ "upload_ids": ["upl_...", ...] }`

4. **Billing change plan** uses `POST /v1/billing/change-plan`
   with body `{ "plan_id": "starter" }`

## Response Envelope

Every response (success or error) is wrapped:

```json
{
  "data": <payload>,
  "meta": { "request_id": "req_...", "timestamp": "..." }
}
```

## Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `INVALID_CREDENTIALS` | 401 | Wrong email/password |
| `INVALID_2FA_CODE` | 401 | Bad TOTP code |
| `USER_EXISTS` | 409 | Email already registered |
| `UNAUTHORIZED` | 401 | Missing/invalid auth |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `BAD_REQUEST` | 400 | Invalid input |
| `QUOTA_EXCEEDED` | 429 | Plan limit hit |
| `INTERNAL_ERROR` | 500 | Server error |

## Frontend Migration Checklist

To swap from mocks to real backend:

1. Replace `frontend/src/services/index.ts` to use `fetch`-based HTTP client
2. Set `VITE_API_URL=http://localhost:8080/v1` in frontend env
3. Handle the response envelope (unwrap `.data` from responses)
4. Handle the presigned URL in upload creation response
5. Store session token from cookie (already handled by browser)
