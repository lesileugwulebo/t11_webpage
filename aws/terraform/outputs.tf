output "web_server_public_ip" {
  description = "Public IP of Web & Nginx EC2 (Access Application here in browser)"
  value       = aws_instance.web_server.public_ip
}

output "web_server_private_ip" {
  description = "Private IP of Web & Nginx EC2"
  value       = aws_instance.web_server.private_ip
}

output "database_server_private_ip" {
  description = "Private IP of Database EC2 (Used by Web App to connect)"
  value       = aws_instance.database_server.private_ip
}

output "database_server_public_ip" {
  description = "Public IP of Database EC2 (for SSH configuration)"
  value       = aws_instance.database_server.public_ip
}

output "application_url" {
  description = "Web Application URL"
  value       = "http://${aws_instance.web_server.public_ip}"
}
