import { assessLocalAiCapability, selectedLocalModel } from '../src/lib/local-ai'
describe('local AI capability checks', () => {
  it('rejects local AI when WebGPU is unavailable', () => {
    expect(
      assessLocalAiCapability({ hardwareConcurrency: 8 } as unknown as Navigator),
    ).toMatchObject({ compatible: false, webGpu: false })
  })
  it('rejects memory-constrained WebGPU devices', () => {
    expect(
      assessLocalAiCapability({
        gpu: {},
        deviceMemory: 2,
        hardwareConcurrency: 4,
      } as unknown as Navigator),
    ).toMatchObject({ compatible: false, webGpu: true })
  })
  it('selects a safe default model for an unknown stored model', () => {
    expect(selectedLocalModel('missing-model').id).toBe('Llama-3.2-1B-Instruct-q4f32_1-MLC')
  })
})
