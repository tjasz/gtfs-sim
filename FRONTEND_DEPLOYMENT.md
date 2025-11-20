# Frontend Deployment Guide

This guide covers deploying the GTFS Simulation frontend to GitHub Pages and configuring it to connect to your production backend.

## Quick Start

### 1. Configure Backend URL

Edit `client/.env.production` and set your backend API URL:

```env
VITE_API_BASE_URL=https://your-app-name.azurewebsites.net
VITE_BASE_PATH=/gtfs-sim/
```

**Important**: Replace `your-app-name.azurewebsites.net` with your actual Azure App Service URL.

### 2. Enable GitHub Pages

1. Go to your GitHub repository
2. Navigate to **Settings** > **Pages**
3. Under **Source**, select **GitHub Actions**

### 3. Configure GitHub Actions Secret (Optional)

To avoid hardcoding the backend URL in the workflow file:

1. Go to **Settings** > **Secrets and variables** > **Actions**
2. Click **New repository secret**
3. Name: `VITE_API_BASE_URL`
4. Value: `https://your-app-name.azurewebsites.net`
5. Click **Add secret**

### 4. Deploy

Push your changes to the `main` branch:

```bash
git add .
git commit -m "Configure frontend for production deployment"
git push origin main
```

GitHub Actions will automatically build and deploy your frontend to GitHub Pages.

## Deployment Methods

### Method 1: Automatic Deployment with GitHub Actions (Recommended)

The repository includes a GitHub Actions workflow (`.github/workflows/deploy-pages.yml`) that automatically builds and deploys on every push to `main`.

**Workflow Features:**
- Automatic builds on push to main
- Manual trigger option via Actions tab
- Uses Node.js 20
- Caches npm dependencies for faster builds
- Configurable via environment variables or secrets

**To trigger a manual deployment:**
1. Go to **Actions** tab in GitHub
2. Select **Deploy to GitHub Pages** workflow
3. Click **Run workflow**

### Method 2: Manual Deployment with gh-pages

For quick manual deployments:

```bash
cd client
npm run deploy
```

This builds the production version and pushes to the `gh-pages` branch.

## Configuration

### Environment Variables

The frontend uses Vite's environment variable system. Variables must be prefixed with `VITE_`.

#### Development (`.env.development`)

```env
VITE_API_BASE_URL=/api
VITE_BASE_PATH=/
```

In development, the API base URL is `/api` which Vite proxies to `localhost:3000`.

#### Production (`.env.production`)

```env
VITE_API_BASE_URL=https://your-backend-url.azurewebsites.net
VITE_BASE_PATH=/gtfs-sim/
```

In production, requests go directly to your backend API.

### Base Path Configuration

The `VITE_BASE_PATH` depends on your GitHub Pages setup:

- **User/Organization site** (`username.github.io`): Use `/`
- **Project site** (`username.github.io/repo-name`): Use `/repo-name/`

Example for repository named `gtfs-sim`:
```env
VITE_BASE_PATH=/gtfs-sim/
```

## Backend CORS Configuration

Your backend must allow requests from your GitHub Pages domain. Update `server.js`:

```javascript
app.use((req, res, next) => {
  // Allow requests from GitHub Pages
  const allowedOrigins = [
    'http://localhost:5173',  // Development
    'https://username.github.io'  // Production
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});
```

Replace `username` with your GitHub username or organization name.

## Build Commands

### Development Build
```bash
cd client
npm run dev
```

Starts development server at `http://localhost:5173` with hot reload.

### Production Build
```bash
cd client
npm run build:production
```

Creates optimized production build in `client/dist/` directory.

### Preview Production Build
```bash
cd client
npm run build:production
npm run preview
```

Builds and previews the production version locally.

## Troubleshooting

### Issue: API Requests Fail in Production

**Symptoms**: Frontend loads but shows 0 vehicles, network errors in console.

**Solutions**:

1. **Check CORS**: Ensure backend allows requests from GitHub Pages domain
2. **Verify API URL**: Confirm `VITE_API_BASE_URL` in `.env.production` is correct
3. **Test Backend**: Visit `https://your-backend.azurewebsites.net/health` in browser
4. **Check HTTPS**: GitHub Pages uses HTTPS, ensure backend API is also HTTPS

### Issue: 404 Errors for Assets

**Symptoms**: CSS and JavaScript files return 404.

**Solutions**:

1. **Check Base Path**: Ensure `VITE_BASE_PATH` matches your repository name
2. For repo `gtfs-sim`: Use `/gtfs-sim/`
3. For user site: Use `/`

### Issue: Blank Page After Deployment

**Symptoms**: Page loads but shows nothing.

**Solutions**:

1. **Check Browser Console**: Look for JavaScript errors
2. **Verify Build**: Run `npm run build:production` locally and check `dist/` folder
3. **Test Locally**: Run `npm run preview` after building
4. **Check Base Path**: Incorrect base path can break routing

### Issue: GitHub Actions Build Fails

**Symptoms**: Workflow shows red X, build fails.

**Solutions**:

1. **Check Logs**: View detailed logs in Actions tab
2. **Verify package.json**: Ensure all dependencies are listed
3. **Test Locally**: Run `npm ci && npm run build` to replicate CI environment
4. **Check Secrets**: If using secrets, verify they're set correctly

## Updating the Backend URL

### After Initial Deployment

To change the backend URL without redeploying manually:

1. Update GitHub Actions secret `VITE_API_BASE_URL`
2. Re-run the workflow or push a new commit

### For Manual Deployments

1. Edit `client/.env.production`
2. Run `npm run deploy`

## Production Checklist

Before deploying to production:

- [ ] Backend deployed to Azure App Service
- [ ] Backend has managed identity configured
- [ ] Backend can access Azure Blob Storage
- [ ] Backend `/health` endpoint returns 200 OK
- [ ] Backend CORS configured for GitHub Pages domain
- [ ] Frontend `.env.production` has correct backend URL
- [ ] GitHub Pages enabled in repository settings
- [ ] GitHub Actions workflow permissions set correctly
- [ ] Test build locally with `npm run build:production`
- [ ] Test API connectivity from production URL

## URLs

After successful deployment:

- **Frontend**: `https://username.github.io/gtfs-sim/`
- **Backend**: `https://your-app-name.azurewebsites.net`
- **Backend Health**: `https://your-app-name.azurewebsites.net/health`

## Custom Domain (Optional)

To use a custom domain:

1. Go to repository **Settings** > **Pages**
2. Under **Custom domain**, enter your domain
3. Follow DNS configuration instructions
4. Update `VITE_BASE_PATH` to `/` in `.env.production`

## Monitoring

### View Deployment Status

- **GitHub Actions**: Repository > Actions tab
- **GitHub Pages**: Repository > Settings > Pages

### Check Build Logs

1. Go to Actions tab
2. Click on the workflow run
3. Expand build steps to see detailed logs

### View Production Site

Visit `https://username.github.io/gtfs-sim/` (replace with your values)

## Architecture

```
┌─────────────────────┐
│   GitHub Pages      │
│   (Static Frontend) │
│   React + Leaflet   │
└──────────┬──────────┘
           │ HTTPS
           │ API Requests
           ▼
┌─────────────────────┐
│  Azure App Service  │
│  (Backend API)      │
│  Express + Node.js  │
└──────────┬──────────┘
           │ Managed Identity
           │ Blob Storage Access
           ▼
┌─────────────────────┐
│  Azure Blob Storage │
│  (GTFS Data)        │
└─────────────────────┘
```

## Security Considerations

1. **HTTPS Only**: GitHub Pages enforces HTTPS automatically
2. **No Credentials in Frontend**: API key/credentials should never be in frontend code
3. **CORS**: Backend only allows specific origins
4. **Environment Variables**: Sensitive values in GitHub Secrets, not in code
5. **Managed Identity**: Backend uses managed identity, no connection strings

## Performance Optimization

The production build includes:

- Code minification
- Tree shaking
- Asset optimization
- Source maps (for debugging)
- Gzip compression (GitHub Pages)

## Rollback

To rollback a deployment:

1. Go to Actions tab
2. Find a previous successful workflow run
3. Click **Re-run all jobs**

Or revert the commit and push.
