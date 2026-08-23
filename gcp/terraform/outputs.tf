# ==============================================================================
# Outputs for GCP Terraform Deployment
# ==============================================================================

output "web_public_ip" {
  description = "Static Public IPv4 address for Web & Application tier"
  value       = google_compute_address.web_static_ip.address
}

output "application_url" {
  description = "Public URL to access Verdad Solution InventoryApp"
  value       = "http://${google_compute_address.web_static_ip.address}/"
}

output "db_internal_ip" {
  description = "Internal Private IP address of MySQL Database server"
  value       = google_compute_instance.db_server.network_interface.0.network_ip
}

output "db_generated_password" {
  description = "Generated MySQL Database password for inventory_app user"
  value       = local.db_pass
  sensitive   = true
}

output "entra_id_redirect_uri" {
  description = "Redirect URI to configure in Microsoft Entra Admin Center (Azure AD)"
  value       = "http://${google_compute_address.web_static_ip.address}/"
}

output "ssh_command_web" {
  description = "gcloud command to SSH into the Web server"
  value       = "gcloud compute ssh ${google_compute_instance.web_server.name} --zone=${var.zone}"
}

output "ssh_command_db" {
  description = "gcloud command to SSH into the Database server"
  value       = "gcloud compute ssh ${google_compute_instance.db_server.name} --zone=${var.zone}"
}
