#!/bin/bash
# ==============================================================================
# Verdad Solution InventoryApp - GCP Infrastructure Teardown Script
# ==============================================================================

set -e

PROJECT_ID="mivafinalyearproject"
REGION="europe-west1"
ZONE="europe-west1-b"

echo "======================================================"
echo "  Tearing Down Verdad Solution InventoryApp on GCP"
echo "  Project : $PROJECT_ID"
echo "  Region  : $REGION"
echo "  Zone    : $ZONE"
echo "======================================================"

echo "Step 1/5: Deleting VM Instances (inventory-web-app, inventory-db)..."
gcloud compute instances delete inventory-web-app inventory-db --zone=$ZONE --project=$PROJECT_ID --quiet || true

echo "Step 2/5: Releasing Static External IP (inventory-web-static-ip)..."
gcloud compute addresses delete inventory-web-static-ip --region=$REGION --project=$PROJECT_ID --quiet || true

echo "Step 3/5: Deleting Firewall Rules..."
gcloud compute firewall-rules delete inventory-allow-web inventory-allow-internal-db --project=$PROJECT_ID --quiet || true

echo "Step 4/5: Deleting Subnet (inventory-subnet)..."
gcloud compute networks subnets delete inventory-subnet --region=$REGION --project=$PROJECT_ID --quiet || true

echo "Step 5/5: Deleting VPC Network (inventory-vpc)..."
gcloud compute networks delete inventory-vpc --project=$PROJECT_ID --quiet || true

echo "======================================================"
echo "  ✅ ALL GCP INFRASTRUCTURE HAS BEEN DESTROYED!"
echo "======================================================"
