#!/usr/bin/env node

import { Command } from 'commander';
import axios from 'axios';

const program = new Command();
const BACKEND_URL = process.env.DEPLOYMATE_API_URL || 'http://localhost:5000';
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

program
  .name('dmate')
  .description('DEPLOYMATE Enterprise Developer CLI — Cloud Operations & DevSecOps Console Tool')
  .version('1.0.0');

// Command 1: dmate status
program
  .command('status')
  .description('Check health and connectivity of DEPLOYMATE Control Plane, DB, and AI Microservice')
  .action(async () => {
    console.log('\n=============================================================');
    console.log('           DEPLOYMATE PLATFORM HEALTH REPORT                 ');
    console.log('=============================================================\n');

    try {
      const backendHealth = await axios.get(`${BACKEND_URL}/health`);
      console.log(`[BACKEND API] Status: ${backendHealth.data.status} | Service: ${backendHealth.data.service}`);
    } catch (err: any) {
      console.log(`[BACKEND API] Status: UNREACHABLE (${err.message})`);
    }

    try {
      const dbReadiness = await axios.get(`${BACKEND_URL}/ready`);
      console.log(`[DATABASE]    Status: ${dbReadiness.data.status} | DB State: ${dbReadiness.data.database}`);
    } catch (err: any) {
      console.log(`[DATABASE]    Status: DISCONNECTED (${err.message})`);
    }

    try {
      const aiHealth = await axios.get(`${AI_SERVICE_URL}/health`);
      console.log(`[AI ENGINE]   Status: ${aiHealth.data.status} | Engine: ${aiHealth.data.ai_engine}`);
    } catch (err: any) {
      console.log(`[AI ENGINE]   Status: UNREACHABLE (${err.message})`);
    }

    console.log('\n=============================================================\n');
  });

// Command 2: dmate pipeline list
const pipelineCmd = program.command('pipeline').description('Manage CI/CD Pipelines');

pipelineCmd
  .command('list')
  .description('List available CI/CD pipelines in DEPLOYMATE')
  .action(async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/v1/pipelines`);
      console.log('\n=============================================================');
      console.log('               DEPLOYMATE CI/CD PIPELINES                    ');
      console.log('=============================================================\n');
      console.table(res.data);
    } catch (err: any) {
      console.error(`Failed to fetch pipelines: ${err.message}`);
    }
  });

// Command 3: dmate pipeline run <id>
pipelineCmd
  .command('run <id>')
  .description('Trigger execution for a specific pipeline ID')
  .action(async (id: string) => {
    try {
      console.log(`Triggering execution for pipeline ID: ${id}...`);
      const res = await axios.post(`${BACKEND_URL}/api/v1/pipelines/${id}/execute`);
      console.log(`✅ Pipeline Run triggered successfully! Run ID: ${res.data.run_id || id}`);
    } catch (err: any) {
      console.error(`Failed to trigger pipeline execution: ${err.message}`);
    }
  });

// Command 4: dmate ai diagnose
program
  .command('ai-diagnose')
  .description('Invoke Gemini AIOps Engine to diagnose pipeline or app logs')
  .requiredOption('-l, --logs <string>', 'Log string or trace to diagnose')
  .action(async (options) => {
    try {
      console.log('\nInvoking Gemini AIOps Engine for log diagnosis...\n');
      const res = await axios.post(`${AI_SERVICE_URL}/api/v1/ai/pipeline-failure-analysis`, {
        logs: options.logs
      });

      console.log('=============================================================');
      console.log('             GEMINI AI DIAGNOSTIC REPORT                     ');
      console.log('=============================================================');
      console.log(`Root Cause  : ${res.data.root_cause}`);
      console.log(`Confidence  : ${(res.data.confidence * 100).toFixed(1)}%`);
      console.log(`Risk Level  : ${res.data.risk}`);
      console.log(`Evidence    :`);
      (res.data.evidence || []).forEach((e: string) => console.log(`  - ${e}`));
      console.log(`Fix Suggestion:\n${res.data.suggested_fixes || res.data.recommendations?.join('\n')}`);
      console.log('=============================================================\n');
    } catch (err: any) {
      console.error(`AI Diagnosis failed: ${err.message}`);
    }
  });

program.parse(process.argv);
