# Quick Configuration Guide

## Before Deployment

### 1. Backend Configuration

Update `client/.env.production` with your Azure App Service URL:

```env
VITE_API_BASE_URL=https://your-app-name.azurewebsites.net
VITE_BASE_PATH=/gtfs-sim/
```

Update `src/server.js` CORS configuration with your GitHub Pages URL:

```javascript
const allowedOrigins = [
  'http://localhost:5173',
  'https://username.github.io'  // Add your GitHub Pages URL
];
```

### 2. GitHub Repository Settings

1. Go to **Settings** > **Pages**
2. Set Source to **GitHub Actions**
3. (Optional) Add secret `VITE_API_BASE_URL` in **Settings** > **Secrets and variables** > **Actions**

### 3. Azure Backend Settings

Enable System-Assigned Managed Identity:
```bash
az webapp identity assign \
  --resource-group <resource-group> \
  --name <app-name>
```

Grant Storage Blob Data Reader role:
```bash
az role assignment create \
  --assignee <managed-identity-principal-id> \
  --role "Storage Blob Data Reader" \
  --scope <storage-account-resource-id>
```

## Deployment Commands

### Deploy Backend to Azure

```bash
# Using Azure CLI
az webapp up \
  --resource-group <resource-group> \
  --name <app-name> \
  --runtime "NODE:20-lts"

# Or using VS Code Azure extension
# Right-click on src/server.js > Deploy to Web App
```

### Deploy Frontend to GitHub Pages

**Automatic (Recommended):**
```bash
git add .
git commit -m "Configure for production"
git push origin main
```

**Manual:**
```bash
cd client
npm run deploy
```

## Verify Deployment

### Backend Health Check
```bash
curl https://your-app-name.azurewebsites.net/health
```

Should return:
```json
{
  "status": "ok",
  "shapesLoaded": 1206,
  "stopsLoaded": 13172,
  ...
}
```

### Frontend Access
Visit: `https://username.github.io/gtfs-sim/`

### Test API Connection
Open browser console on frontend site and check for:
- No CORS errors
- Vehicles loading successfully
- Vehicle count > 0

## Common Issues

### Issue: Backend returns 500 on /health

**Problem**: Azure Blob Storage authentication failed

**Solution**:
1. Verify managed identity is enabled
2. Check Storage Blob Data Reader role is assigned
3. Wait 5-10 minutes for permissions to propagate

### Issue: Frontend shows 0 vehicles

**Problem**: API connection not working

**Solutions**:
1. Check `VITE_API_BASE_URL` in `.env.production`
2. Verify backend CORS allows GitHub Pages origin
3. Test backend directly: `curl https://backend/health`
4. Check browser console for errors

### Issue: GitHub Actions build fails

**Problem**: Build error or configuration issue

**Solutions**:
1. Check Actions logs in GitHub
2. Verify `client/package.json` scripts are correct
3. Test build locally: `cd client && npm run build:production`

## File Checklist

- [ ] `client/.env.production` - Backend URL configured
- [ ] `src/server.js` - CORS origins include GitHub Pages
- [ ] `.github/workflows/deploy-pages.yml` - Workflow file exists
- [ ] Backend deployed to Azure App Service
- [ ] Managed identity enabled and role assigned
- [ ] GitHub Pages enabled in repository settings
- [ ] Changes committed and pushed to `main`

## URLs to Update

Replace these placeholders throughout the configuration:

| Placeholder | Replace With | Where Used |
|-------------|-------------|------------|
| `your-app-name` | Your Azure App Service name | `.env.production`, `server.js` |
| `username` | Your GitHub username | `server.js`, documentation |
| `gtfs-sim` | Your repository name | `.env.production`, workflow file |
| `gtfspugetsound` | Your storage account name | Server environment variables |

## Next Steps

1. ✅ Configure all files with your actual values
2. ✅ Deploy backend to Azure
3. ✅ Configure managed identity and permissions
4. ✅ Push to GitHub to trigger frontend deployment
5. ✅ Test the live application
6. ✅ Monitor GitHub Actions for deployment status

## Support

- Backend Issues: See [DEPLOYMENT.md](DEPLOYMENT.md)
- Frontend Issues: See [FRONTEND_DEPLOYMENT.md](FRONTEND_DEPLOYMENT.md)
- API Reference: See [README.md](README.md)
