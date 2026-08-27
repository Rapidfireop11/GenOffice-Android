export interface LocalModel {
  id: string
  label: string
  minimumMemoryGb: number
  description: string
}

export const LOCAL_MODELS: readonly LocalModel[] = [
  {
    id: 'Llama-3.2-1B-Instruct-q4f32_1-MLC',
    label: 'Llama 3.2 1B · compact',
    minimumMemoryGb: 4,
    description: 'Fastest option for short rewrites and document summaries.',
  },
  {
    id: 'Phi-3.5-mini-instruct-q4f16_1-MLC',
    label: 'Phi 3.5 Mini · balanced',
    minimumMemoryGb: 6,
    description: 'Better instruction following for editing assistance.',
  },
  {
    id: 'Qwen2.5-3B-Instruct-q4f16_1-MLC',
    label: 'Qwen 2.5 3B · capable',
    minimumMemoryGb: 8,
    description: 'Highest-quality option; use on recent devices with ample memory.',
  },
]

export interface LocalAiCapability {
  webGpu: boolean
  deviceMemoryGb?: number
  hardwareConcurrency?: number
  compatible: boolean
  explanation: string
}
interface BrowserNavigator extends Navigator {
  deviceMemory?: number
  gpu?: unknown
}

export function assessLocalAiCapability(source: BrowserNavigator = navigator): LocalAiCapability {
  const webGpu = Boolean(source.gpu)
  const deviceMemoryGb = source.deviceMemory
  const hardwareConcurrency = source.hardwareConcurrency
  if (!webGpu)
    return {
      webGpu,
      deviceMemoryGb,
      hardwareConcurrency,
      compatible: false,
      explanation:
        'WebGPU is unavailable. Use a current Chromium-based browser or select remote BYOK assistance.',
    }
  if (deviceMemoryGb !== undefined && deviceMemoryGb < 4)
    return {
      webGpu,
      deviceMemoryGb,
      hardwareConcurrency,
      compatible: false,
      explanation:
        'This device reports less than 4 GB of memory, which is below the smallest local model recommendation.',
    }
  return {
    webGpu,
    deviceMemoryGb,
    hardwareConcurrency,
    compatible: true,
    explanation:
      'This browser can attempt local model execution. The first load downloads model files into browser storage.',
  }
}

export function selectedLocalModel(id: string): LocalModel {
  return LOCAL_MODELS.find((model) => model.id === id) ?? LOCAL_MODELS[0]
}
export interface LocalGenerationRequest {
  model: string
  system: string
  prompt: string
  onProgress?: (message: string) => void
}
type Engine = {
  chat: {
    completions: {
      create: (request: unknown) => Promise<{ choices?: Array<{ message?: { content?: string } }> }>
    }
  }
  unload?: () => Promise<void>
}
let enginePromise: Promise<Engine> | null = null
let activeModel: string | null = null

export async function generateLocalText(request: LocalGenerationRequest): Promise<string> {
  const capability = assessLocalAiCapability()
  if (!capability.compatible) throw new Error(capability.explanation)
  if (!enginePromise || activeModel !== request.model) {
    const { CreateMLCEngine } = await import('@mlc-ai/web-llm')
    activeModel = request.model
    enginePromise = CreateMLCEngine(request.model, {
      initProgressCallback: (progress: { text?: string }) =>
        request.onProgress?.(progress.text ?? 'Loading local model…'),
    }) as Promise<Engine>
  }
  const engine = await enginePromise
  const result = await engine.chat.completions.create({
    messages: [
      { role: 'system', content: request.system },
      { role: 'user', content: request.prompt },
    ],
    temperature: 0.35,
  })
  return result.choices?.[0]?.message?.content?.trim() ?? 'The local model returned no text.'
}

export async function releaseLocalModel(): Promise<void> {
  const engine = await enginePromise
  await engine?.unload?.()
  enginePromise = null
  activeModel = null
}
