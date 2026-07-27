import mongoose from "mongoose";
import { BriefService } from "../../../src/services/brief.service";
import { AiBrief } from "../../../src/models/AiBrief";
import { AiPromptLog } from "../../../src/models/AiPromptLog";
import { GeminiClientService } from "../../../src/services/geminiClient.service";

jest.mock("../../../src/models/AiBrief", () => ({
  AiBrief: {
    create: jest.fn(),
  },
}));

jest.mock("../../../src/models/AiPromptLog", () => ({
  AiPromptLog: {
    create: jest.fn(),
  },
}));

describe("BriefService prompt logging", () => {
  const payload = {
    metrics: { bottlenecksIdentified: 0 },
    predictions: { delayedPrs: 0 },
    previousMetrics: {},
    previousPredictions: { delayedPrs: 0 },
    evidenceCards: [],
    limitations: [],
  };
  const payloadBuilder = {
    buildWeeklyBriefPayload: jest.fn().mockResolvedValue(payload),
  };

  beforeEach(() => {
    payloadBuilder.buildWeeklyBriefPayload.mockResolvedValue(payload);
    jest.spyOn(console, "info").mockImplementation();
    jest.spyOn(console, "warn").mockImplementation();
    jest.spyOn(console, "error").mockImplementation();
  });

  it("persists the sanitized prompt and parsed Gemini response", async () => {
    const briefId = new mongoose.Types.ObjectId();
    (AiBrief.create as jest.Mock).mockResolvedValue({ _id: briefId });
    (AiPromptLog.create as jest.Mock).mockResolvedValue({});
    jest.spyOn(GeminiClientService, "getInstance").mockReturnValue({
      hasKeys: () => true,
      generateContent: jest.fn().mockResolvedValue({
        text: JSON.stringify({
          summary: "Healthy flow",
          confidence: "high",
          limitations: [],
          items: [],
        }),
      }),
    } as unknown as GeminiClientService);

    const service = new BriefService(payloadBuilder as any);
    await service.generateBrief(
      new mongoose.Types.ObjectId().toString(),
      new Date("2026-07-20T00:00:00.000Z"),
      new Date("2026-07-27T00:00:00.000Z")
    );

    expect(AiPromptLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        briefId,
        promptPayload: payload,
        responsePayload: expect.objectContaining({ summary: "Healthy flow" }),
        provider: "gemini",
        wasRedacted: true,
        durationMs: expect.any(Number),
      })
    );
  });

  it("records the error details when deterministic fallback is used", async () => {
    const briefId = new mongoose.Types.ObjectId();
    (AiBrief.create as jest.Mock).mockResolvedValue({ _id: briefId });
    (AiPromptLog.create as jest.Mock).mockResolvedValue({});
    jest.spyOn(GeminiClientService, "getInstance").mockReturnValue({
      hasKeys: () => false,
    } as unknown as GeminiClientService);

    const service = new BriefService(payloadBuilder as any);
    await service.generateBrief(
      new mongoose.Types.ObjectId().toString(),
      new Date("2026-07-20T00:00:00.000Z"),
      new Date("2026-07-27T00:00:00.000Z")
    );

    expect(AiPromptLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        briefId,
        promptPayload: payload,
        responsePayload: expect.objectContaining({
          fallback: true,
          error: expect.stringContaining("No Gemini API keys"),
        }),
        provider: "gemini",
      })
    );
  });
});
