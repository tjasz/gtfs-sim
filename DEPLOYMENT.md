# Deployment Guide

## Environment Detection

The application automatically detects whether it's running locally or in Azure:

- **Local Development**: Reads GTFS files from the local `input/` directory
- **Azure Deployment**: Reads GTFS files from Azure Blob Storage

The environment is detected by checking for the `WEBSITE_INSTANCE_ID` environment variable (automatically set by Azure App Service) or the `USE_AZURE_STORAGE` environment variable.

## Local Development

To run the application locally:

```bash
npm start                    # Uses puget_sound by default
npm run start:puget          # Uses puget_sound
npm run start:pierce         # Uses pierce_transit
```

The application will read GTFS files from `input/<folder>/` directory.

## Azure Deployment

### Prerequisites

1. Azure Storage Account with GTFS data uploaded to a blob container
2. The container should contain the GTFS files:
   - `agency.txt`
   - `calendar.txt`
   - `calendar_dates.txt`
   - `routes.txt`
   - `shapes.txt`
   - `stops.txt`
   - `stop_times.txt`
   - `trips.txt`
   - Other optional GTFS files

### Configuration

#### Required Setup Steps

1. **Enable System-Assigned Managed Identity** on your Azure App Service
2. **Grant Storage Permissions** to the managed identity:
   - Role: `Storage Blob Data Reader`
   - Scope: Storage account or specific container

#### Optional Environment Variables

If you want to use a different storage account or container (default values shown):

- `AZURE_STORAGE_ACCOUNT`: Name of the Azure Storage account (default: `gtfspugetsound`)
- `AZURE_STORAGE_CONTAINER`: Name of the blob container (default: `puget-sound`)

#### Authentication

The application uses **Azure Managed Identity** for authentication via `DefaultAzureCredential`:

- **In Azure (Recommended)**: Uses System-Assigned Managed Identity
  - No credentials stored in the application
  - Secure and follows Azure best practices
  - Automatically authenticates using the App Service's managed identity

- **Local Development**: DefaultAzureCredential tries multiple methods in order:
  1. Environment variables (service principal credentials)
  2. Azure CLI authentication (if logged in with `az login`)
  3. Visual Studio authentication
  4. Other Azure authentication methods

**Note**: The container must grant the managed identity appropriate permissions (Storage Blob Data Reader role).

### Setting Up Managed Identity

#### Step 1: Enable System-Assigned Managed Identity

In the Azure Portal:
1. Navigate to your App Service
2. Go to **Identity** > **System assigned**
3. Set **Status** to **On**
4. Click **Save**
5. Copy the **Object (principal) ID** (you'll need this for permissions)

Or using Azure CLI:

```bash
az webapp identity assign \
  --resource-group <resource-group> \
  --name <app-name>
```

#### Step 2: Grant Storage Permissions

In the Azure Portal:
1. Navigate to your Storage Account
2. Go to **Access Control (IAM)**
3. Click **Add** > **Add role assignment**
4. Select role: **Storage Blob Data Reader**
5. Assign access to: **Managed Identity**
6. Select your App Service's managed identity
7. Click **Save**

Or using Azure CLI:

```bash
# Get the App Service's managed identity principal ID
PRINCIPAL_ID=$(az webapp identity show \
  --resource-group <resource-group> \
  --name <app-name> \
  --query principalId \
  --output tsv)

# Get the Storage Account's resource ID
STORAGE_ID=$(az storage account show \
  --name gtfspugetsound \
  --resource-group <storage-resource-group> \
  --query id \
  --output tsv)

# Assign the Storage Blob Data Reader role
az role assignment create \
  --assignee $PRINCIPAL_ID \
  --role "Storage Blob Data Reader" \
  --scope $STORAGE_ID
```

#### Step 3: Configure Optional Settings (if needed)

In the Azure Portal:
1. Navigate to your App Service
2. Go to **Configuration** > **Application settings**
3. Add settings only if different from defaults:

```
AZURE_STORAGE_ACCOUNT=gtfspugetsound
AZURE_STORAGE_CONTAINER=puget-sound
```

Or using Azure CLI:

```bash
az webapp config appsettings set \
  --resource-group <resource-group> \
  --name <app-name> \
  --settings \
    AZURE_STORAGE_ACCOUNT=gtfspugetsound \
    AZURE_STORAGE_CONTAINER=puget-sound
```

### Testing Azure Storage Locally

To test Azure Storage integration locally without deploying:

#### Option 1: Using Azure CLI Authentication (Easiest)

```bash
# Login with Azure CLI
az login

# Set environment variable to force Azure mode
export USE_AZURE_STORAGE=true  # Linux/Mac
$env:USE_AZURE_STORAGE="true"  # Windows PowerShell

# Optionally set storage account/container if different from defaults
export AZURE_STORAGE_ACCOUNT=gtfspugetsound
export AZURE_STORAGE_CONTAINER=puget-sound

# Run the application
npm start
```

The application will authenticate using your Azure CLI credentials automatically.

#### Option 2: Using Service Principal (for CI/CD testing)

```bash
# Set service principal credentials
export AZURE_TENANT_ID=<tenant-id>
export AZURE_CLIENT_ID=<client-id>
export AZURE_CLIENT_SECRET=<client-secret>

# Set environment variable to force Azure mode
export USE_AZURE_STORAGE=true

# Optionally set storage account/container
export AZURE_STORAGE_ACCOUNT=gtfspugetsound
export AZURE_STORAGE_CONTAINER=puget-sound

# Run the application
npm start
```

**Note**: The service principal must have the `Storage Blob Data Reader` role on the storage account.

## Storage Structure

### Local File System
```
input/
├── puget_sound/
│   ├── agency.txt
│   ├── calendar.txt
│   ├── calendar_dates.txt
│   ├── routes.txt
│   ├── shapes.txt
│   ├── stops.txt
│   ├── stop_times.txt
│   └── trips.txt
└── pierce_transit/
    ├── agency.txt
    ├── ...
```

### Azure Blob Storage
```
Container: puget-sound
├── agency.txt
├── calendar.txt
├── calendar_dates.txt
├── routes.txt
├── shapes.txt
├── stops.txt
├── stop_times.txt
└── trips.txt
```

Files should be uploaded to the root of the container (not in subdirectories).

## Troubleshooting

### Error: "Blob not found" or "shapes.txt not found"

1. Verify the container name is correct
2. Ensure files are in the root of the container
3. Check container access permissions (must be public or provide connection string)
4. Verify the storage account name

### Error: "Authentication failed" or "Unauthorized"

**In Azure:**
1. Verify the App Service has System-Assigned Managed Identity enabled
2. Check that the managed identity has been granted `Storage Blob Data Reader` role
3. Verify the role assignment is on the correct storage account/container
4. Wait a few minutes for Azure role assignments to propagate

**Local Development:**
1. Ensure you're logged in with Azure CLI: `az login`
2. Verify your account has access to the storage account
3. Check that you have the correct subscription selected: `az account show`
4. If using service principal, verify environment variables are set correctly

### Testing Connection

You can test Azure Storage connectivity using Azure Storage Explorer or Azure CLI:

```bash
# List blobs in container using your current Azure CLI credentials
az storage blob list \
  --account-name gtfspugetsound \
  --container-name puget-sound \
  --auth-mode login \
  --output table

# Check if managed identity has access (from Azure Cloud Shell or VM with managed identity)
az storage blob list \
  --account-name gtfspugetsound \
  --container-name puget-sound \
  --auth-mode login \
  --output table
```

### Security Best Practices

1. **Use Managed Identity**: Never store connection strings or access keys in your application code or configuration
2. **Least Privilege**: Grant only the `Storage Blob Data Reader` role (read-only access)
3. **Scope Permissions**: Consider granting permissions at the container level instead of the entire storage account
4. **Rotate Credentials**: If using service principals for testing, rotate secrets regularly
5. **Monitor Access**: Enable Azure Storage diagnostic logging to monitor access patterns
