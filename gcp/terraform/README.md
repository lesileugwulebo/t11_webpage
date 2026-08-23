# 🚀 GCP 2-Tier Architecture Terraform Deployment

Automated Infrastructure as Code (IaC) to deploy **Verdad Solution InventoryApp** with **Node.js/Python backend**, **MySQL 8.0 Database**, **Nginx Reverse Proxy**, and **Microsoft Entra ID (Azure AD) SSO** on **Google Cloud Platform (GCP)**.

---

## 🏗️ Resources Provisioned

- **VPC & Subnet**: Dedicated `inventory-vpc` and subnet `10.10.0.0/24`.
- **Firewall Rules**:
  - `inventory-allow-web`: Allows inbound HTTP (80), HTTPS (443), and SSH (22) from `0.0.0.0/0`.
  - `inventory-allow-internal-db`: Restricts MySQL port 3306 strictly to instances tagged `inventory-web`.
- **Static External IP**: Dedicated regional static IP attached to Web & App server.
- **Database Server (`inventory-db`)**:
  - Ubuntu 22.04 LTS instance.
  - Automated startup script installing MySQL 8.0, securing root, provisioning `inventory_db` database, creating `inventory_app` user, and importing `schema.sql`.
- **Web & Application Server (`inventory-web-app`)**:
  - Ubuntu 22.04 LTS instance with static public IP.
  - Automated startup script installing Node.js 20, Python 3, Nginx, cloning repo, running `npm install`, injecting `.env`, creating systemd daemon `inventory-app.service`, and configuring Nginx reverse proxy.

---

## 📋 Prerequisites

1. **Google Cloud SDK (`gcloud`)** installed and authenticated:
   ```bash
   gcloud auth login
   gcloud auth application-default login
   gcloud config set project YOUR_PROJECT_ID
   ```
2. **Terraform** (version `>= 1.5.0`) installed.
3. Enabled GCP APIs on your project:
   ```bash
   gcloud services enable compute.googleapis.com
   ```

---

## ⚡ Quickstart Deployment

### 1. Clone & Navigate to Terraform Directory
```bash
git clone https://github.com/lesileugwulebo/t11_webpage.git
cd t11_webpage/gcp/terraform
```

### 2. Configure Variables
Copy the example variables file:
```bash
cp terraform.tfvars.example terraform.tfvars
```
Edit `terraform.tfvars` and set your `project_id`:
```hcl
project_id = "my-gcp-project-123"
region     = "europe-west1"
zone       = "europe-west1-b"
```

### 3. Initialize & Deploy
```bash
# Initialize Terraform Google provider
terraform init

# Review execution plan
terraform plan

# Apply infrastructure deployment
terraform apply -auto-approve
```

---

## 📊 Outputs & Verification

Once `terraform apply` finishes, you will receive:
```
Outputs:
application_url        = "http://34.78.112.55/"
web_public_ip          = "34.78.112.55"
db_internal_ip         = "10.10.0.2"
entra_id_redirect_uri  = "http://34.78.112.55/"
ssh_command_web        = "gcloud compute ssh inventory-web-app --zone=europe-west1-b"
ssh_command_db         = "gcloud compute ssh inventory-db --zone=europe-west1-b"
```

### 🔑 Microsoft Entra ID (Azure AD) Setup
1. Copy the output `entra_id_redirect_uri` (e.g. `http://34.78.112.55/`).
2. Add it to your **Microsoft Entra Admin Center** > **App registrations** > **Authentication** > **Redirect URIs (SPA)**.
3. Open `http://34.78.112.55/` in your browser and log in!

---

## 🧹 Teardown & Cleanup

To destroy all provisioned GCP resources when no longer needed:
```bash
terraform destroy -auto-approve
```
