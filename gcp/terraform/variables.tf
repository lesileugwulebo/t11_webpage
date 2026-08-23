# ==============================================================================
# Variables Definition for GCP Terraform Deployment
# ==============================================================================

variable "project_id" {
  type        = string
  description = "The Google Cloud Platform (GCP) Project ID"
}

variable "region" {
  type        = string
  description = "GCP Region for resource deployment"
  default     = "europe-west1"
}

variable "zone" {
  type        = string
  description = "GCP Zone for Compute Engine instances"
  default     = "europe-west1-b"
}

variable "machine_type" {
  type        = string
  description = "Compute Engine machine type for Web and DB VMs"
  default     = "e2-micro"
}

variable "db_password" {
  type        = string
  description = "Password for MySQL database application user (optional, auto-generated if blank)"
  default     = ""
  sensitive   = true
}

variable "jwt_secret" {
  type        = string
  description = "Secret key used for signing application JWT tokens"
  default     = "production_gcp_terraform_jwt_secret_key_2026"
  sensitive   = true
}

variable "azure_client_id" {
  type        = string
  description = "Microsoft Entra ID (Azure AD) Application (Client) ID"
  default     = ""
}

variable "azure_tenant_id" {
  type        = string
  description = "Microsoft Entra ID (Azure AD) Directory (Tenant) ID"
  default     = ""
}
