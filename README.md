# Serverless Todo API on AWS (CDK & GitHub Actions OIDC)

A robust, modern serverless CRUD Todo Application managed via **AWS CDK (Python)**, featuring a secure static frontend hosted on **S3 + CloudFront (OAC)**, and automated CI/CD using **GitHub Actions** via passwordless **OIDC authentication**.

[![Deploy](https://github.com/cbien0504/todo-api-cdk/actions/workflows/deploy.yml/badge.svg)](https://github.com/cbien0504/todo-api-cdk/actions/workflows/deploy.yml)

---

## 📖 Overview

This repository acts as a real-world demonstration and learning laboratory for provisioning enterprise-grade serverless architectures using the AWS Cloud Development Kit (CDK). 

By using a serverless model, the application achieves:
* **Zero Infrastructure Management**: No OS updates or server configurations.
* **Auto-Scaling**: Seamless scaling from zero requests to millions.
* **Cost Efficiency**: Pay-as-you-go billing model with no idle runtime costs.
* **High Availability**: Multi-Availability Zone deployment out of the box through AWS serverless primitives.

---

## 📐 Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                     Client Browser                          │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
         Retrieves Web Assets            Makes API Calls
               │                               │
               ▼                               ▼
┌──────────────────────────────┐┌─────────────────────────────┐
│      Amazon CloudFront       ││     Amazon API Gateway      │
└──────────────┬───────────────┘└──────────────┬──────────────┘
               │                               │
          Fetches from                         │ Triggers Handler
               │                               │
               ▼                               ▼
┌──────────────────────────────┐┌─────────────────────────────┐
│          Amazon S3           ││        AWS Lambda          │
│      (Frontend Assets)       ││     (Python Handler)        │
└──────────────────────────────┘└──────────────┬──────────────┘
                                               │
                                          Reads/Writes
                                               │
                                               ▼
                                ┌─────────────────────────────┐
                                │       Amazon DynamoDB       │
                                │        (Todo Table)         │
                                └─────────────────────────────┘
```

### Infrastructure Components & Design Decisions

* **Amazon CloudFront**: Serves the static single-page client application globally with local caching at edge locations to minimize latency. Enabled with **Origin Access Control (OAC)** to block direct public requests to the S3 bucket, enforcing traffic through the CDN.
* **Amazon S3**: Hosts frontend static files (`index.html`). Configured with `auto_delete_objects=True` and `RemovalPolicy.DESTROY` to enable clean resources teardown upon CDK stack deletion.
* **Amazon API Gateway**: Serverless REST API endpoint configured with CORS enabled. Serves as the Entrypoint routing HTTP methods to the backend Lambda function.
* **AWS Lambda**: Leverages `Python 3.12` runtime to process requests, formulate JSON response payloads, and manage database operations.
* **Amazon DynamoDB**: Key-value NoSQL database storing todos. Provisioned with **Pay-Per-Request (On-Demand)** billing mode, which scales down to zero dollars when the API experiences zero traffic.

---

## 🛠️ Tech Stack

* **Infrastructure as Code (IaC)**: AWS CDK (Python)
* **API Layer**: Amazon API Gateway (REST API proxy)
* **Compute Layer**: AWS Lambda (Python 3.12)
* **Database Layer**: Amazon DynamoDB
* **Web Hosting**: Amazon S3 & Amazon CloudFront (Origin Access Control)
* **CI/CD Orchestration**: GitHub Actions (OpenID Connect federation)

---

## 📋 Prerequisites

Before deploying the stack, ensure you have set up:
1. **AWS Account**: Active account with configured billing/payment methods.
2. **AWS CLI**: Installed and configured locally via `aws configure`.
3. **Node.js (>= 20)**: Required for the AWS CDK CLI tool.
   > [!WARNING]
   > Running the CDK CLI on deprecated Node.js versions (e.g. Node 12, 14, or 18) will cause compatibility warnings and execution failures. Ensure Node is on an active LTS release (v20 or v22).
4. **Python (>= 3.10)**: Needed for CDK Python runtime.
5. **AWS CDK CLI**: Installed globally via npm:
   ```bash
   npm install -g aws-cdk
   ```

---

## 🚀 Quick Start & Local Deployment

Follow these steps to deploy the application manually from your local workstation:

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/cbien0504/todo-api-cdk.git
   cd todo-api-cdk
   ```

2. **Configure Virtual Environment**:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Synthesize & Deploy**:
   ```bash
   cdk synth TodoApiStack
   cdk deploy TodoApiStack --require-approval never
   ```

---

## 🧱 API Endpoints Reference

Once deployed, the API Gateway exposes the following endpoints (replace `<api-id>` with your deployment's REST API ID):

| Method | Endpoint | Description | Sample Request Body |
| :--- | :--- | :--- | :--- |
| **GET** | `/todos` | List all todo tasks | *None* |
| **POST** | `/todos` | Create a new todo task | `{"title": "Learn AWS CDK", "done": false}` |
| **GET** | `/todos/{id}` | Query a specific todo task | *None* |
| **PUT** | `/todos/{id}` | Update title or progress status | `{"title": "Learn AWS CDK", "done": true}` |
| **DELETE** | `/todos/{id}`| Delete a specific todo task | *None* |

---

## 🤖 CI/CD with GitHub Actions (OIDC Setup)

This project does not store static AWS Access Keys in GitHub Secrets. Instead, it utilizes **OpenID Connect (OIDC)** to securely acquire temporary security credentials.

### Initial AWS IAM Roles Configuration (Done Once)

1. **Create Identity Provider**:
   Verify or create the OIDC Provider for GitHub in AWS IAM:
   ```bash
   aws iam create-open-id-connect-provider \
     --url https://token.actions.githubusercontent.com \
     --client-id-list sts.amazonaws.com \
     --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
   ```

2. **Configure Trust Relationship**:
   Create a trust policy file limiting assumptions to your particular repo and branch:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Principal": {
           "Federated": "arn:aws:iam::<YOUR_ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
         },
         "Action": "sts:AssumeRoleWithWebIdentity",
         "Condition": {
           "StringEquals": {
             "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
           },
           "StringLike": {
             "token.actions.githubusercontent.com:sub": "repo:cbien0504/todo-api-cdk:ref:refs/heads/main"
           }
         }
       }
     ]
   }
   ```
   Deploy the IAM deployment role:
   ```bash
   aws iam create-role \
     --role-name github-actions-deploy-todo-api \
     --assume-role-policy-document file://trust-policy.json
   ```

3. **Deploy Pipeline Trigger**:
   Commit and push changes to the `main` branch. GitHub Actions will assume the configured role and automatically execute stack synth and deployment.
