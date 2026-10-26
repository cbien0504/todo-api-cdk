# Mimikara Oboeru – JLPT study app on AWS (CDK & GitHub Actions OIDC)

A static **React** study app for JLPT vocabulary, hosted on **S3 + CloudFront (OAC)** and provisioned with **AWS CDK (Python)**. Every push to `main` is tested and deployed by **GitHub Actions** through passwordless **OIDC authentication**.

[![Deploy](https://github.com/cbien0504/todo-api-cdk/actions/workflows/deploy.yml/badge.svg)](https://github.com/cbien0504/todo-api-cdk/actions/workflows/deploy.yml)

---

## 📖 Overview

- **📖 Từ vựng N3 / 📗 Từ vựng N2** – Mimikara Oboeru N3 and the JLPT N2 list of jtest.net, practiced as a multiple-choice quiz or as spaced-repetition flashcards. Every answer also teaches its companion words (自動詞/他動詞 pair, synonyms, antonyms) and Hán Việt.
- **📝 Luyện đề N3** – JLPT N3 文字・語彙 exam papers generated from `JLPT_N3_tu_vung_Minchan.docx`.

The app runs entirely in the browser: progress (unremembered words, flashcards, settings) is kept in `localStorage`. See [frontend/README.md](frontend/README.md) for features, structure and how the data is built.

---

## 📐 Architecture

```text
┌──────────────────────┐      HTTPS      ┌──────────────────────┐   Origin Access   ┌──────────────────────┐
│    Client Browser    │ ──────────────▶ │  Amazon CloudFront   │ ────────────────▶ │      Amazon S3       │
└──────────────────────┘                 │  (SPA, edge cache)   │      Control      │ (frontend/dist, private)
                                         └──────────────────────┘                   └──────────────────────┘
```

* **Amazon S3**: private bucket holding the built frontend (`frontend/dist`), uploaded by a CDK `BucketDeployment` that also invalidates the CloudFront cache. `auto_delete_objects=True` and `RemovalPolicy.DESTROY` allow a clean teardown.
* **Amazon CloudFront**: serves the app over HTTPS from edge locations. **Origin Access Control** blocks direct access to the bucket; 403/404 responses fall back to `index.html` for the single-page app.

---

## 📁 Repository layout

```text
.
├── app.py                         # CDK app entry point
├── infra/frontend_stack.py        # S3 bucket + CloudFront distribution + deployment
├── frontend/                      # React + TypeScript + Vite app (see frontend/README.md)
├── scripts/                       # data builders: exam papers, jtest.net crawler, companions, Hán Việt
│   └── data/                      # raw jtest.net crawls used by scripts/build_vocab_data.py
├── JLPT_N3_tu_vung_Minchan.docx   # source of the N3 exam papers
└── .github/workflows/deploy.yml   # lint, test, build and deploy on push to main
```

---

## 🛠️ Tech Stack

* **Frontend**: React 19, TypeScript, Vite, Vitest, Oxlint
* **Infrastructure as Code**: AWS CDK (Python)
* **Hosting**: Amazon S3 & Amazon CloudFront (Origin Access Control)
* **CI/CD**: GitHub Actions (OpenID Connect federation)

---

## 📋 Prerequisites

1. **AWS Account** and the **AWS CLI** configured locally via `aws configure`.
2. **Node.js (>= 20)**: for the frontend and the AWS CDK CLI.
   > [!WARNING]
   > Running the CDK CLI on deprecated Node.js versions (e.g. Node 12, 14, or 18) will cause compatibility warnings and execution failures. Ensure Node is on an active LTS release (v20 or v22).
3. **Python (>= 3.10)**: for the CDK app and the data scripts.
4. **AWS CDK CLI**, installed globally:
   ```bash
   npm install -g aws-cdk
   ```

---

## 🚀 Local development & deployment

1. **Clone the repository**:
   ```bash
   git clone https://github.com/cbien0504/todo-api-cdk.git
   cd todo-api-cdk
   ```

2. **Run the app locally**:
   ```bash
   npm ci --prefix frontend
   npm run dev --prefix frontend
   ```

3. **Deploy manually** (the stack uploads `frontend/dist`, so build first):
   ```bash
   python3 -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   npm run build --prefix frontend
   cdk deploy TodoApiStack --require-approval never
   ```

   The CloudFormation stack keeps its original name `TodoApiStack` so that deployments update it in place and the CloudFront URL does not change.

---

## 🤖 CI/CD with GitHub Actions (OIDC Setup)

On every push to `main`, the workflow lints, tests and builds the frontend, then runs `cdk deploy`. It does not store static AWS Access Keys in GitHub Secrets: it uses **OpenID Connect (OIDC)** to acquire temporary security credentials.

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
