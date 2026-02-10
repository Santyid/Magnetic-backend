# /deploy - Deploy to Railway

Run pre-deployment checks and push to Railway.

## Instructions

1. **Build check**: Run `npm run build` to verify TypeScript compiles without errors
2. **File check**: Verify `package-lock.json` exists (required for `npm ci` in Docker)
3. **Git status**: Check for uncommitted changes. If there are changes, warn the user
4. **Push**: If all checks pass, push to the deployment branch with `git push origin main`
5. **Verify**: After push, check the production health endpoint:
   `curl -s https://magnetic-backend-production.up.railway.app/api/health`

### Production URLs:
- Backend: https://magnetic-backend-production.up.railway.app/api
- Frontend: https://magnetic-frontend-production.up.railway.app
- Health: https://magnetic-backend-production.up.railway.app/api/health

### Common issues:
- CORS: `CORS_ORIGIN` must use `https://` in Railway
- DB: Use TCP Proxy values, not internal hostname
- Seeds run automatically via `start.sh`
