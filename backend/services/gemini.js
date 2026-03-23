const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

function heuristicInsight(payload) {
  const score = Number(payload?.borrower?.current_score || 0);
  const riskScore = Number(payload?.risk?.risk_score || 0);
  const repaymentRate = payload?.borrower?.repayment_rate;
  const kyc = String(payload?.borrower?.kyc_status || "pending");

  let action = "caution";
  let confidence = 62;
  const reasons = [];

  if (score < 60 || riskScore >= 70 || kyc === "rejected") {
    action = "reject";
    confidence = 78;
  } else if (score >= 120 && riskScore <= 39 && (repaymentRate === null || repaymentRate >= 70) && kyc === "approved") {
    action = "approve";
    confidence = 81;
  }

  reasons.push(`Impact score is ${score}.`);
  reasons.push(`Computed risk score is ${riskScore} (${payload?.risk?.risk_level || "unknown"}).`);
  if (repaymentRate === null) reasons.push("Limited repayment history available.");
  else reasons.push(`Repayment rate is ${repaymentRate}%.`);
  reasons.push(`KYC status is ${kyc}.`);

  return {
    provider: "heuristic",
    model: "fallback-rule-engine",
    recommendedAction: action,
    confidence,
    reasoning: reasons,
    termsSuggestion: {
      maxApprovedAmount: Math.round(Number(payload?.loan?.amount || 0) * (action === "approve" ? 1 : action === "caution" ? 0.75 : 0.5)),
      interestRateRange: action === "approve" ? "10-16%" : action === "caution" ? "14-20%" : "18-26%",
      durationNote: action === "approve" ? "Standard tenure acceptable." : "Prefer shorter tenure until stronger repayment track record.",
    },
  };
}

function extractJsonBlock(text) {
  if (!text) return null;
  const trimmed = String(text).trim();
  try {
    return JSON.parse(trimmed);
  } catch (_) {
    // continue to code-fence extraction
  }

  const fenceMatch = trimmed.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenceMatch?.[1]) {
    try {
      return JSON.parse(fenceMatch[1]);
    } catch (_) {
      return null;
    }
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const maybe = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(maybe);
    } catch (_) {
      return null;
    }
  }

  return null;
}

async function generateLoanDecisionInsight(payload) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const fallback = heuristicInsight(payload);
    return {
      ...fallback,
      fallback: true,
      sourceNote: "GEMINI_API_KEY not configured; using deterministic local scoring assistant.",
    };
  }

  const model = DEFAULT_MODEL;
  const url = `${GEMINI_API_URL}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const prompt = [
    "You are a micro-finance risk analyst assistant for lenders.",
    "Return only strict JSON with no markdown and no extra text.",
    "Assess whether lender should approve, caution, or reject a loan request.",
    "Use factors: impact score, risk score, kyc status, repayment performance, activity quality, pending obligations, loan amount, tenure.",
    "JSON schema:",
    "{",
    '  "recommendedAction": "approve|caution|reject",',
    '  "confidence": 0-100,',
    '  "reasoning": ["short reason 1", "short reason 2", "short reason 3"],',
    '  "termsSuggestion": {',
    '    "maxApprovedAmount": number,',
    '    "interestRateRange": "string",',
    '    "durationNote": "string"',
    "  }",
    "}",
    "Data:",
    JSON.stringify(payload),
  ].join("\n");

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 600,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      const fallback = heuristicInsight(payload);
      return {
        ...fallback,
        fallback: true,
        sourceNote: `Gemini API request failed with status ${response.status}.`,
      };
    }

    const body = await response.json();
    const text = body?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const parsed = extractJsonBlock(text);

    if (!parsed || !parsed.recommendedAction || !Array.isArray(parsed.reasoning)) {
      const fallback = heuristicInsight(payload);
      return {
        ...fallback,
        fallback: true,
        sourceNote: "Gemini response was not parseable JSON; using fallback scoring assistant.",
      };
    }

    return {
      provider: "gemini",
      model,
      fallback: false,
      recommendedAction: parsed.recommendedAction,
      confidence: Math.max(0, Math.min(100, Number(parsed.confidence || 0))),
      reasoning: parsed.reasoning.slice(0, 5).map((item) => String(item)),
      termsSuggestion: {
        maxApprovedAmount: Number(parsed?.termsSuggestion?.maxApprovedAmount || payload?.loan?.amount || 0),
        interestRateRange: String(parsed?.termsSuggestion?.interestRateRange || "Based on policy"),
        durationNote: String(parsed?.termsSuggestion?.durationNote || "Use current duration policy"),
      },
    };
  } catch (err) {
    const fallback = heuristicInsight(payload);
    return {
      ...fallback,
      fallback: true,
      sourceNote: `Gemini unavailable: ${err.message}`,
    };
  }
}

module.exports = {
  generateLoanDecisionInsight,
};
