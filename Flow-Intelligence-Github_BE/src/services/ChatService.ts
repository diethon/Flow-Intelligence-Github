import { GoogleGenAI } from '@google/genai';
import env from '../config/env.js';
import { MetricSnapshot, MetricKey } from '../models/MetricSnapshot.js';
import { RiskEvent } from '../models/RiskEvent.js';
import { EvidenceCard } from '../models/EvidenceCard.js';
import { PullRequest } from '../models/PullRequest.js';
import { Contributor } from '../models/Contributor.js';
import mongoose from 'mongoose';

// Initialize the Google Gen AI SDK using the dedicated chat API key
const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY_CHAT });

export class ChatService {
  private static async getContextForRepository(repositoryId: string) {
    const repoObjectId = new mongoose.Types.ObjectId(repositoryId);

    // 1. Latest MetricSnapshot
    // Fetch recent snapshots for all metrics
    const snapshots = await MetricSnapshot.find({ 
      repositoryId: repoObjectId
    }).sort({ computedAt: -1 }).limit(100); 

    // Keep only the latest for each key
    const latestSnapshotsMap = new Map();
    for (const snap of snapshots) {
      if (!latestSnapshotsMap.has(snap.metricKey)) {
        latestSnapshotsMap.set(snap.metricKey, snap);
      }
    }
    const latestSnapshots = Array.from(latestSnapshotsMap.values());

    // 2. Top 10 RiskAlerts active
    const activeAlerts = await RiskEvent.find({
      repositoryId: repoObjectId,
      status: 'active'
    }).sort({ createdAt: -1 }).limit(10); 

    // 3. EvidenceCards for those alerts
    const alertIds = activeAlerts.map(a => a._id);
    const evidenceCards = await EvidenceCard.find({
      repositoryId: repoObjectId,
      riskEventId: { $in: alertIds }
    });

    // 4. Open PRs (up to 30) for review load and stale analysis
    const openPRs = await PullRequest.find({
      repositoryId: repoObjectId,
      state: 'open'
    }).sort({ updatedAt: -1 }).limit(30); 

    // 5. Contributors
    const contributors = await Contributor.find({
      repositoryId: repoObjectId
    }).limit(30);

    return {
      metrics: latestSnapshots,
      alerts: activeAlerts,
      evidence: evidenceCards,
      openPRs,
      contributors
    };
  }

  static async generateChatResponse(repositoryId: string, message: string, history: Array<{role: string, content: string}>, userRole: string = 'viewer') {
    const contextData = await this.getContextForRepository(repositoryId);
    
    // Create a map for Evidence IDs to hide raw IDs from LLM
    const evidenceList = contextData.evidence.map((e, idx) => ({ index: idx + 1, data: e }));

    let systemPrompt = `You are a helpful AI assistant for a software engineering team. Your job is to analyze the GitHub repository data provided below and answer the user's questions based strictly on this data. Do not make up any information. If the answer is not in the data, say "I don't have enough data to answer that."

Context Data for this Repository:

Metrics:
${contextData.metrics.map(m => {
  let str = "- " + m.metricKey + ": " + m.value + " " + m.unit;
  const meta = m.metadata as any;
  if (meta?.reviewerBreakdown?.length) {
    str += "\\n  - Reviewer Breakdown: " + meta.reviewerBreakdown.map((r: any) => r.login + " (" + r.count + " reviews, " + r.pct + "%)").join(', ');
  }
  if (meta?.checkBreakdown?.length) {
    str += "\\n  - Check Breakdown: " + meta.checkBreakdown.map((c: any) => c.name + " (" + c.failed + "/" + c.total + " failed, " + c.failRate + "%)").join(', ');
  }
  return str;
}).join('\\n')}

Active Risk Alerts:
${contextData.alerts.length > 0 ? contextData.alerts.map(a => `- Severity: ${a.severity}, Rule: ${a.ruleCode}, Metric Value: ${a.metricValue}, Threshold: ${a.thresholdValue}`).join('\n') : "None"}

Evidence Cards (Details for Alerts):
${evidenceList.length > 0 ? evidenceList.map(e => `- [Evidence ${e.index}] Title: ${e.data.title}, Summary: ${e.data.summary}, Action: ${e.data.suggestedAction}`).join('\n') : "None"}

Open Pull Requests (including reviewers and stale status):
${contextData.openPRs.length > 0 ? contextData.openPRs.map(pr => `- PR #${pr.number}: ${pr.title}, Author: ${pr.authorLogin || 'unknown'}, Requested Reviewers: ${(pr.requestedReviewers && pr.requestedReviewers.length > 0) ? pr.requestedReviewers.join(', ') : 'None'}, Created At: ${pr.createdAt.toISOString()}, State: ${pr.state}`).join('\n') : "None"}

Team Members (Contributors):
${contextData.contributors.length > 0 ? contextData.contributors.map(c => `- ${c.login} (${c.displayName || 'unknown'})`).join('\n') : "None"}

CRITICAL INSTRUCTION:
When you refer to a specific alert or evidence in your response, clearly explain its Title, Summary, and Suggested Action naturally in the text.
NEVER mention the Evidence index in your natural language text (e.g. do not say "Evidence 1"). 
Instead, put the Evidence indices you used into the "sourceIndices" JSON array.

Format your final response as a JSON object with two fields:
{
  "reply": "Your natural language response here formatted as markdown. NO EVIDENCE REFERENCES IN THIS TEXT.",
  "sourceIndices": [array of integers representing the Evidence indices you used to formulate your answer, if any]
}
Respond strictly with valid JSON.
`;

    if (userRole === 'viewer') {
      systemPrompt += `\n\nAUTHORIZATION RULE: The current user is a 'viewer'. They are FORBIDDEN from asking about specific individuals. If the user asks about individual people or personal stats (e.g., "what did user X do?", "how many PRs does Y have?"), you MUST politely reply exactly with: "You do not have permission to view personal information of members." Do not answer the question.`;
    }


    // Convert history to genai format
    const contents: Array<{ role: 'user' | 'model', parts: Array<{ text: string }> }> = [];
    contents.push({ role: 'user', parts: [{ text: systemPrompt }] });
    contents.push({ role: 'model', parts: [{ text: '{"reply": "Understood. I will answer based strictly on the provided context and return a JSON object.", "sourceIndices": []}' }] });

    // Format history
    for (const msg of history) {
      if (msg.role === 'user') {
        contents.push({ role: 'user', parts: [{ text: msg.content }] });
      } else {
        contents.push({ role: 'model', parts: [{ text: JSON.stringify({ reply: msg.content, sourceIndices: [] }) }] });
      }
    }

    contents.push({ role: 'user', parts: [{ text: message }] });

    let response;
    try {
      response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: contents,
        config: {
          responseMimeType: 'application/json',
        }
      });
    } catch (apiError) {
      console.error("Gemini API Error:", apiError);
      return {
        reply: "Sorry, I am currently experiencing high traffic or an API error. Please wait a moment and try again.",
        sourceIds: []
      };
    }

    const text = response.text || "{}";
    try {
      const parsed = JSON.parse(text);
      
      // Map indices back to real MongoDB IDs
      const mappedSourceIds: string[] = [];
      if (Array.isArray(parsed.sourceIndices)) {
        parsed.sourceIndices.forEach((idx: number) => {
          const evidence = evidenceList.find(e => e.index === idx);
          if (evidence) {
            mappedSourceIds.push(evidence.data._id.toString());
          }
        });
      }

      return {
        reply: parsed.reply || "No reply generated.",
        sourceIds: mappedSourceIds
      };
    } catch (e) {
      return {
        reply: text,
        sourceIds: []
      };
    }
  }
}
