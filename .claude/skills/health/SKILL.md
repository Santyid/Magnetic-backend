# /health - Check Service Health

Check the health status of all backend services and endpoints.

## Instructions

Run the health check endpoint and present the results in a clear summary:

1. Execute: `curl -s http://localhost:3000/api/health`
2. Parse the JSON response
3. Report:
   - Overall status (ok / degraded)
   - Each service status (database, openai, encryption, jwt)
   - Each endpoint module status (auth, users, products, dashboard, ai, health)
   - Any missing endpoints
   - Uptime

If the server is not running, inform the user and suggest `npm run start:dev`.

For production health check, use:
`curl -s https://magnetic-backend-production.up.railway.app/api/health`
