type StructuredResponseOptions = {
  apiKey: string
  model: string
  safetyIdentifier: string
  schemaName: string
  schema: Record<string, unknown>
  instructions: string
  input: string
  maxOutputTokens?: number
  timeoutMs?: number
}

type StructuredResponseResult = {
  ok: boolean
  status: number
  parsed: unknown | null
  usage: { input_tokens: number; output_tokens: number }
  errorCode?: string
  responseStatus?: string
}

function responseText(payload: any): string {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) return payload.output_text
  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    for (const part of Array.isArray(item?.content) ? item.content : []) {
      if (typeof part?.text === 'string' && part.text.trim()) return part.text
    }
  }
  return ''
}

export async function callStructuredOpenAI(options: StructuredResponseOptions): Promise<StructuredResponseResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 25_000)
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: options.model,
        store: false,
        safety_identifier: options.safetyIdentifier,
        max_output_tokens: options.maxOutputTokens ?? 1400,
        reasoning: { effort: 'none' },
        text: {
          verbosity: 'medium',
          format: {
            type: 'json_schema',
            name: options.schemaName,
            strict: true,
            schema: options.schema,
          },
        },
        instructions: options.instructions,
        input: options.input,
      }),
    })

    const payload: any = await response.json().catch(() => ({}))
    const usage = {
      input_tokens: Number(payload?.usage?.input_tokens || 0),
      output_tokens: Number(payload?.usage?.output_tokens || 0),
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        parsed: null,
        usage,
        errorCode: String(payload?.error?.code || `openai_${response.status}`).slice(0, 80),
      }
    }

    if (payload?.status && payload.status !== 'completed') {
      return {
        ok: false,
        status: 502,
        parsed: null,
        usage,
        errorCode: `response_${String(payload.status).slice(0, 40)}`,
        responseStatus: String(payload.status),
      }
    }

    const output = responseText(payload)
    let parsed: unknown = null
    try { parsed = JSON.parse(output) } catch {
      return { ok: false, status: 502, parsed: null, usage, errorCode: 'invalid_json_output' }
    }

    return { ok: true, status: 200, parsed, usage }
  } catch (error: any) {
    return {
      ok: false,
      status: error?.name === 'AbortError' ? 504 : 502,
      parsed: null,
      usage: { input_tokens: 0, output_tokens: 0 },
      errorCode: error?.name === 'AbortError' ? 'timeout' : 'network_error',
    }
  } finally {
    clearTimeout(timeout)
  }
}
