# Mimikara Oboeru – JLPT study app on AWS (CDK & GitHub Actions OIDC)

A **React** study app for JLPT vocabulary, hosted on **S3 + CloudFront (OAC)** with a small serverless API (**API Gateway + Lambda + DynamoDB**) that keeps the progress of every learner, all provisioned with **AWS CDK (Python)**. Every push to `main` is tested and deployed by **GitHub Actions** through passwordless **OIDC authentication**.

[![Deploy](https://github.com/cbien0504/todo-api-cdk/actions/workflows/deploy.yml/badge.svg)](https://github.com/cbien0504/todo-api-cdk/actions/workflows/deploy.yml)

---

## 📖 Overview

The app is organized by JLPT level (N5 · N4 · N3 · N2), each level with its own sections:

- **📖 Từ vựng** (every level) – the N5, N4 and N2 lists of jtest.net and Mimikara Oboeru N3, practiced as a multiple-choice quiz or as spaced-repetition flashcards. Every answer also teaches its companion words (自動詞/他動詞 pair, synonyms, antonyms) and Hán Việt.
- **📝 Luyện đề** (N3) – JLPT N3 文字・語彙 exam papers generated from `JLPT_N3_tu_vung_Minchan.docx`.

Learners **register** (a username not taken yet and a password) or **log in** (the password is checked). Each account has its own progress in every level: words to review (chưa nhớ), remembered words (đã nhớ) and flashcards. The progress is cached in the browser, so studying works offline, and saved in DynamoDB, so it follows the learner to any device. Display settings stay per device in `localStorage`. See [frontend/README.md](frontend/README.md) for features, structure and how the data is built.

### 👥 Level of each learner

The DynamoDB table (stack output `ProgressTableName`) has one `profile` item per learner. In the AWS Console, open **DynamoDB → Explore items**, pick the table, then **Scan** with the filter `record` = `profile`: every row is a learner with `lastSeenAt` and, per level, `n5Known` / `n5Unremembered` … `n2Known` / `n2Unremembered` (remembered words and words to review; the levels have 1047, 894, 880 and 1546 words). The items `n5` … `n2` of a learner hold the details of each level (`words`, `cards` as JSON).

### 🔐 Passwords and sessions

* Passwords are hashed with **scrypt** (16 MiB, random salt; `backend/auth.py`), never stored or logged in clear. 6–128 characters.
* Logging in opens a session: a random token in a cookie `HttpOnly; Secure; SameSite=Strict; Path=/api` (JavaScript cannot read it, other sites cannot use it). The table only keeps its SHA-256; sessions last 180 days and DynamoDB deletes them once expired (TTL). Logging out closes the session on the server.
* 5 wrong passwords in a row lock the account for 5 minutes.
* **Forgotten password**: with AWS credentials of the account, `pip install boto3 && python3 backend/reset_password.py <username>` asks for a new password and closes the learner's sessions; the progress is kept.

---

## 📐 Architecture

```text
┌──────────────────────┐      HTTPS      ┌──────────────────────┐   Origin Access   ┌──────────────────────┐
│    Client Browser    │ ──────────────▶ │  Amazon CloudFront   │ ────────────────▶ │      Amazon S3       │
└──────────────────────┘                 │  (SPA, edge cache)   │      Control      │ (frontend/dist, private)
                                         └──────────┬───────────┘                   └──────────────────────┘
                                                    │ /api/*
                                                    ▼
                                         ┌──────────────────────┐                   ┌──────────────────────┐
                                         │ API Gateway HTTP API │ ────▶  Lambda ──▶ │    Amazon DynamoDB   │
                                         │     (throttled)      │     (backend/)    │ (progress, retained) │
                                         └──────────────────────┘                   └──────────────────────┘
```

* **Amazon S3**: private bucket holding the built frontend (`frontend/dist`), uploaded by a CDK `BucketDeployment` that also invalidates the CloudFront cache. `auto_delete_objects=True` and `RemovalPolicy.DESTROY` allow a clean teardown.
* **Amazon CloudFront**: serves the app over HTTPS from edge locations. **Origin Access Control** blocks direct access to the bucket; 403/404 responses fall back to `index.html` for the single-page app (the API never answers 403/404 for that reason). `/api/*` goes to the API without caching, on the same domain as the app (no CORS).
* **API Gateway HTTP API + AWS Lambda** (`backend/`, Python 3.12, standard library and the runtime's boto3 only): `POST /api/register`, `POST /api/login` and `POST /api/logout` manage the session; with it, `GET /api/users/{username}/progress` returns the progress of the learner and `PATCH /api/users/{username}/progress/{deck}` merges the changes of a device. Throttled to 100 requests/s (burst 200) for all learners together.
* **Amazon DynamoDB** (on-demand, point-in-time recovery, TTL on `expiresAt`): a `profile` per learner (password hash, counts), one item per level of progress and one per session. `RemovalPolicy.RETAIN`: the accounts and progress stay if the stack is deleted.

---

## 📁 Repository layout

```text
.
├── app.py                         # CDK app entry point
├── infra/study_app_stack.py       # S3 bucket + CloudFront distribution + deployment
├── infra/progress_api.py          # DynamoDB table + Lambda + HTTP API of the learners' progress
├── backend/                       # the Lambda: handler.py (routes), auth.py (passwords, sessions), progress.py (validation, merge), store.py (DynamoDB)
│   ├── dev_server.py              # the same API in memory, for local development
│   ├── reset_password.py          # new password for a learner who forgot theirs
│   └── tests/
├── frontend/                      # React + TypeScript + Vite app (see frontend/README.md)
├── scripts/                       # data builders: exam papers, jtest.net crawler, companions, Hán Việt
│   └── data/                      # raw jtest.net crawls used by scripts/build_vocab_data.py
├── JLPT_N3_tu_vung_Minchan.docx   # source of the N3 exam papers
└── .github/workflows/deploy.yml   # lint, test, build and deploy on push to main
```

---

## 🛠️ Tech Stack

* **Frontend**: React 19, TypeScript, Vite, Vitest, Oxlint
* **Backend**: Python 3.12 on AWS Lambda, Amazon API Gateway (HTTP API), Amazon DynamoDB; tests with unittest and moto
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

2. **Run the app locally**, with the API kept in memory by `backend/dev_server.py` (the Vite dev server proxies `/api` to it; `API_PROXY=https://<CloudFront domain>` uses a deployed API instead):
   ```bash
   npm ci --prefix frontend
   python3 backend/dev_server.py &            # http://127.0.0.1:8787
   npm run dev --prefix frontend
   ```
   Backend tests: `pip install -r backend/requirements-dev.txt && python3 -m unittest discover -s backend/tests -t backend`.

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

On every push to `main`, the workflow lints, tests and builds the frontend, tests the backend, then runs `cdk deploy`. It does not store static AWS Access Keys in GitHub Secrets: it uses **OpenID Connect (OIDC)** to acquire temporary security credentials.

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
