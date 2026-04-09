---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: []
session_topic: 'Adding AI/ML faucet classifier + AWS IaC to Overnighter app for GenAI course homework'
session_goals: 'Generate strong architecture decisions, creative feature scope, and a compelling submission-ready homework result'
selected_approach: 'ai-recommended'
techniques_used: ['Six Thinking Hats', 'What If Scenarios', 'Reverse Brainstorming']
ideas_generated: []
context_file: ''
---

# Brainstorming Session Results

**Facilitator:** Kyryl
**Date:** 2026-04-09T20:39:49Z

## Session Overview

**Topic:** Adding AI/ML (faucet classifier) + AWS IaC to the Overnighter project for a GenAI course homework
**Goals:** Generate strong, creative architecture decisions AND produce a compelling, submission-ready result

## Technique Selection

**Approach:** AI-Recommended Techniques

**Recommended Techniques:**
- **Six Thinking Hats:** Examine the architecture from 6 angles (facts, risks, benefits, creativity, emotions, process) to produce a well-rounded, defensible design
- **What If Scenarios:** Break the ceiling on first-draft architecture — push into genuinely interesting design territory with bold variants
- **Reverse Brainstorming:** Stress-test the design by asking how it could fail, then flip every weakness into a strength

**AI Rationale:** Technical problem-solving + creative feature design requires structured grounding (Six Hats), creative expansion (What If), and hardening via adversarial review (Reverse Brainstorming). Total ~50 min session.

## Technique Execution Results

### Six Thinking Hats

- **🤍 White Hat (Facts):** Assignment requires IaC code + Docker + CI/CD + services description + `.env` structure. A GitHub repo link is the submission format. Production deployment is NOT required — this is documentation + demo-able code. The existing app already has photo uploads and S3 presigned URLs, making the faucet classifier a natural extension.
- **🟡 Yellow Hat (Benefits):** The faucet classifier has genuine user value for RV travelers. Strongest angle: framing it as an *extensible amenity detection pipeline* (faucets today, fire pits tomorrow) with a reusable CDK L3 construct. The "Living Amenity Graph" narrative is far more compelling than "we trained a model."
- **⬛ Black Hat (Risks):** CDK complexity trap (scoped down to focused, working stack), ML code credibility (used real PyTorch transfer learning), missing dataset (referenced Google Open Images + download script), thin README (made it the primary focus).
- **🟢 Green Hat (Creative):** Confidence-gated UX (badge only shows if >85% confident), model versioning in CDK (`--context modelVersion=v2`), Bedrock as LLM fallback, SageMaker Experiments tracking in train.py.
- **🔵 Blue Hat (Process):** Clean architecture: User → Vercel Function → API Gateway → Lambda → SageMaker, async path via S3 → SQS → Lambda → SageMaker Async.

### What If Scenarios

- What if scoped to 3 services only? → Kept S3 + SageMaker + Lambda (dropped SQS from primary path)
- What if Docker Compose ran a real local mock? → mock-inference Python container returns `{label, confidence}`
- What if README had a Mermaid diagram? → Implemented, renders natively on GitHub
- What if CI had `cdk synth` validation? → Implemented as `validate-infra` job, proves IaC is valid without AWS
- What if model training used Spot Instances? → Documented in ml/README.md

### Reverse Brainstorming

| Failure Mode | Implemented Fix |
|---|---|
| CDK doesn't synth | `cdk synth` runs in CI, output uploaded as artifact |
| README too generic | Every service has purpose + connected-to columns in table |
| ML code looks fake | Real ResNet-18 frozen-backbone transfer learning, 295 lines |
| No local dev story | `docker-compose up` gives working app + mock inference |
| Secrets structure missing | `.env.example` with 20+ vars, inline comments per var |

### Creative Facilitation Narrative

Session moved efficiently from structured grounding (White/Yellow/Black/Green/Blue hats) through creative expansion (What If) to adversarial hardening (Reverse Brainstorm). Key breakthrough: reframing the homework from "train a model" to "demonstrate an extensible AI infrastructure approach" — shifting emphasis to the CDK reusable construct and the README narrative. All ideas were immediately implemented via 8 parallel fleet agents, completing the full submission in a single session.

### Session Highlights

**Key Ideas Implemented:** Reusable CDK L3 construct, mock-inference Docker service, Mermaid architecture diagram, `cdk synth` in CI, confidence-gated badge, SageMaker Experiments logging, `.env.example` with grouped comments
**Breakthrough Moment:** "The assignment is documentation + demo-able code, not a live system" — shifted 60% of effort to README quality and CDK validity
**Total Ideas Generated:** 25+ concrete, actionable ideas across all three techniques
**Outcome:** Fully submission-ready GitHub repository
