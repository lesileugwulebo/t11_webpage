# ==============================================================================
# Verdad Solution InventoryApp - GCP Infrastructure Teardown Script
# ==============================================================================

$PROJECT_ID = "mivafinalyearproject"
$REGION     = "europe-west1"
$ZONE       = "europe-west1-b"

Write-Host "======================================================" -ForegroundColor Yellow
Write-Host "  Tearing Down Verdad Solution InventoryApp on GCP" -ForegroundColor Yellow
Write-Host "  Project : $PROJECT_ID"
Write-Host "  Region  : $REGION"
Write-Host "  Zone    : $ZONE"
Write-Host "======================================================" -ForegroundColor Yellow

# 1. Delete VM Instances
Write-Host "Step 1/5: Deleting VM Instances (inventory-web-app, inventory-db)..." -ForegroundColor Cyan
gcloud compute instances delete inventory-web-app inventory-db --zone=$ZONE --project=$PROJECT_ID --quiet

# 2. Release Static IP
Write-Host "Step 2/5: Releasing Static External IP (inventory-web-static-ip)..." -ForegroundColor Cyan
gcloud compute addresses delete inventory-web-static-ip --region=$REGION --project=$PROJECT_ID --quiet

# 3. Delete Firewall Rules
Write-Host "Step 3/5: Deleting Firewall Rules..." -ForegroundColor Cyan
gcloud compute firewall-rules delete inventory-allow-web inventory-allow-internal-db --project=$PROJECT_ID --quiet

# 4. Delete Subnet
Write-Host "Step 4/5: Deleting Subnet (inventory-subnet)..." -ForegroundColor Cyan
gcloud compute networks subnets delete inventory-subnet --region=$REGION --project=$PROJECT_ID --quiet

# 5. Delete VPC Network
Write-Host "Step 5/5: Deleting VPC Network (inventory-vpc)..." -ForegroundColor Cyan
gcloud compute networks delete inventory-vpc --project=$PROJECT_ID --quiet

Write-Host "======================================================" -ForegroundColor Green
Write-Host "  ✅ ALL GCP INFRASTRUCTURE HAS BEEN DESTROYED!" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
