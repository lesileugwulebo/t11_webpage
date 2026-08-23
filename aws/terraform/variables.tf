variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-east-1"
}

variable "instance_type" {
  description = "EC2 instance size"
  type        = string
  default     = "t3.small"
}

variable "key_name" {
  description = "Name of existing AWS EC2 Key Pair to SSH into instances"
  type        = string
}

variable "allowed_ssh_cidr" {
  description = "CIDR block allowed to SSH into instances (e.g. your IP/32)"
  type        = string
  default     = "0.0.0.0/0"
}
