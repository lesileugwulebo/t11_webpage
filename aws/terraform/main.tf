terraform {
  required_version = ">= 1.0.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# ------------------------------------------------------------------------------
# 1. VPC & Networking
# ------------------------------------------------------------------------------
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "verdad-inventory-vpc"
  }
}

resource "aws_internet_gateway" "gw" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "verdad-inventory-igw"
  }
}

# Public Subnet for Web & Nginx EC2
resource "aws_subnet" "public_web" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  map_public_ip_on_launch = true
  availability_zone       = "${var.aws_region}a"

  tags = {
    Name = "verdad-public-web-subnet"
  }
}

# Private / Database Subnet for Database EC2
resource "aws_subnet" "database" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.2.0/24"
  map_public_ip_on_launch = true # Can be private or public with strict security group
  availability_zone       = "${var.aws_region}a"

  tags = {
    Name = "verdad-database-subnet"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.gw.id
  }

  tags = {
    Name = "verdad-public-route-table"
  }
}

resource "aws_route_table_association" "public_web" {
  subnet_id      = aws_subnet.public_web.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "database" {
  subnet_id      = aws_subnet.database.id
  route_table_id = aws_route_table.public.id
}

# ------------------------------------------------------------------------------
# 2. Security Groups
# ------------------------------------------------------------------------------

# Web & Nginx Security Group (Public facing HTTP/HTTPS/SSH)
resource "aws_security_group" "web_sg" {
  name        = "verdad-web-sg"
  description = "Allow inbound HTTP, HTTPS, and SSH"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP from anywhere"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS from anywhere"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "SSH from allowed CIDR"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.allowed_ssh_cidr]
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "verdad-web-sg"
  }
}

# Database Security Group (MySQL 3306 ONLY from Web SG)
resource "aws_security_group" "db_sg" {
  name        = "verdad-db-sg"
  description = "Allow MySQL 3306 only from Web Security Group"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "MySQL from Web EC2 instance"
    from_port       = 3306
    to_port         = 3306
    protocol        = "tcp"
    security_groups = [aws_security_group.web_sg.id]
  }

  ingress {
    description = "SSH from allowed CIDR"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.allowed_ssh_cidr]
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "verdad-db-sg"
  }
}

# ------------------------------------------------------------------------------
# 3. EC2 Instances
# ------------------------------------------------------------------------------

# Latest Ubuntu 22.04 LTS AMI
data "aws_ami" "ubuntu" {
  most_recent = true

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }

  owners = ["099720109477"] # Canonical
}

# Instance 2: Dedicated MySQL Database EC2
resource "aws_instance" "database_server" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.database.id
  vpc_security_group_ids = [aws_security_group.db_sg.id]
  key_name               = var.key_name

  tags = {
    Name = "verdad-inventory-db-server"
    Tier = "Database"
  }
}

# Instance 1: Web & Nginx Application EC2
resource "aws_instance" "web_server" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public_web.id
  vpc_security_group_ids = [aws_security_group.web_sg.id]
  key_name               = var.key_name

  tags = {
    Name = "verdad-inventory-web-server"
    Tier = "Web-Nginx"
  }
}
