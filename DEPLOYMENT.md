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

Set the following environment variables in your Azure App Service:

#### Required Environment Variables

None! The application uses default values:
- Default Storage Account: `gtfspugetsound`
- Default Container: `puget-sound`

#### Optional Environment Variables

If you want to use a different storage account or container:

- `AZURE_STORAGE_ACCOUNT`: Name of the Azure Storage account (default: `gtfspugetsound`)
- `AZURE_STORAGE_CONTAINER`: Name of the blob container (default: `puget-sound`)
- `AZURE_STORAGE_CONNECTION_STRING`: Connection string for authentication (optional, uses anonymous/public access if not provided)

#### Authentication Options

The application supports multiple authentication methods:

1. **Public/Anonymous Access** (Default)
   - Container must be configured for public blob access
   - No credentials required
   - Simplest option for public GTFS data

2. **Connection String**
   - Set `AZURE_STORAGE_CONNECTION_STRING` environment variable
   - Most explicit authentication method
   - Good for private containers

3. **Managed Identity** (Future Enhancement)
   - Can be implemented using `@azure/identity` package
   - Best practice for production deployments
   - No credentials stored in application

### Example Azure App Service Configuration

In the Azure Portal:

1. Navigate to your App Service
2. Go to **Configuration** > **Application settings**
3. Add the following settings (if different from defaults):

```
AZURE_STORAGE_ACCOUNT=gtfspugetsound
AZURE_STORAGE_CONTAINER=puget-sound
AZURE_STORAGE_CONNECTION_STRING=<your-connection-string>  # Optional
```

Or using Azure CLI:

```bash
az webapp config appsettings set \
  --resource-group <resource-group> \
  --name <app-name> \
  --settings \
    AZURE_STORAGE_ACCOUNT=gtfspugetsound \
    AZURE_STORAGE_CONTAINER=puget-sound \
    AZURE_STORAGE_CONNECTION_STRING="<connection-string>"
```

### Testing Azure Storage Locally

To test Azure Storage integration locally without deploying:

```bash
# Set environment variable to force Azure mode
export USE_AZURE_STORAGE=true  # Linux/Mac
$env:USE_AZURE_STORAGE="true"  # Windows PowerShell

# Optionally set other Azure variables
export AZURE_STORAGE_ACCOUNT=gtfspugetsound
export AZURE_STORAGE_CONTAINER=puget-sound
export AZURE_STORAGE_CONNECTION_STRING="<connection-string>"

# Run the application
npm start
```

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

### Error: "Authentication failed"

1. Check if container has public access enabled, or
2. Provide a valid `AZURE_STORAGE_CONNECTION_STRING`
3. Verify the connection string has the correct permissions (Read access required)

### Testing Connection

You can test Azure Storage connectivity using Azure Storage Explorer or Azure CLI:

```bash
# List blobs in container (requires authentication)
az storage blob list \
  --account-name gtfspugetsound \
  --container-name puget-sound \
  --output table
```
