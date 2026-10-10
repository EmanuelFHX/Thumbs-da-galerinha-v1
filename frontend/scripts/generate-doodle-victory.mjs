import fs from 'node:fs'

const sampleRate = 44100
const duration = 3.45
const sampleCount = Math.floor(sampleRate * duration)
const mix = new Float64Array(sampleCount)

function addPluck(start, frequency, length, gain = 0.18, brightness = 1) {
  const firstSample = Math.floor(start * sampleRate)
  const totalSamples = Math.floor(length * sampleRate)

  for (let index = 0; index < totalSamples && firstSample + index < sampleCount; index += 1) {
    const time = index / sampleRate
    const attack = Math.min(1, time / 0.012)
    const decay = Math.exp(-time * 5.7)
    const shimmer =
      Math.sin(Math.PI * 2 * frequency * time)
      + 0.38 * brightness * Math.sin(Math.PI * 2 * frequency * 2 * time + 0.2) * Math.exp(-time * 5)
      + 0.16 * brightness * Math.sin(Math.PI * 2 * frequency * 3 * time + 0.55) * Math.exp(-time * 8)

    mix[firstSample + index] += shimmer * attack * decay * gain
  }
}

function addWarmTone(start, frequency, length, gain = 0.1) {
  const firstSample = Math.floor(start * sampleRate)
  const totalSamples = Math.floor(length * sampleRate)

  for (let index = 0; index < totalSamples && firstSample + index < sampleCount; index += 1) {
    const time = index / sampleRate
    const attack = Math.min(1, time / 0.055)
    const release = Math.min(1, (length - time) / 0.5)
    const body =
      Math.sin(Math.PI * 2 * frequency * time)
      + 0.28 * Math.sin(Math.PI * 2 * frequency * 2 * time)
      + 0.12 * Math.sin(Math.PI * 2 * frequency * 3 * time)

    mix[firstSample + index] += body * attack * Math.max(0, release) * gain
  }
}

function addKick(start, gain = 0.2) {
  const length = 0.3
  const firstSample = Math.floor(start * sampleRate)
  const totalSamples = Math.floor(length * sampleRate)
  let phase = 0

  for (let index = 0; index < totalSamples && firstSample + index < sampleCount; index += 1) {
    const time = index / sampleRate
    const frequency = 118 * Math.exp(-time * 10) + 45
    phase += Math.PI * 2 * frequency / sampleRate
    mix[firstSample + index] += Math.sin(phase) * Math.exp(-time * 13) * gain
  }
}

function addSparkle(start, gain = 0.055) {
  const frequencies = [1318.51, 1567.98, 1975.53]
  frequencies.forEach((frequency, index) => addPluck(start + index * 0.075, frequency, 0.8, gain, 1.2))
}

// Chamada curta, ascendente e brincalhona.
addKick(0.08, 0.14)
addPluck(0.08, 392.0, 0.55, 0.15)
addPluck(0.31, 493.88, 0.58, 0.16)
addPluck(0.54, 587.33, 0.65, 0.17)
addPluck(0.77, 783.99, 0.85, 0.19, 1.15)

// Resolução em Sol maior, com corpo suficiente para acompanhar a revelação.
addKick(0.92, 0.2)
addWarmTone(0.91, 196.0, 1.75, 0.075)
addWarmTone(0.91, 246.94, 1.75, 0.065)
addWarmTone(0.91, 293.66, 1.75, 0.06)
addWarmTone(0.91, 392.0, 1.75, 0.052)
addPluck(0.94, 783.99, 1.25, 0.13)

// Pequena assinatura final tipo “estrela desenhada”.
addPluck(1.42, 987.77, 0.65, 0.09)
addPluck(1.61, 1174.66, 0.68, 0.095)
addPluck(1.83, 1567.98, 1.05, 0.11, 1.2)
addSparkle(2.2)

let peak = 0
for (const sample of mix) peak = Math.max(peak, Math.abs(sample))
const normalization = peak > 0 ? 0.78 / peak : 1

const pcm = Buffer.alloc(sampleCount * 2)
for (let index = 0; index < sampleCount; index += 1) {
  const time = index / sampleRate
  const fade = time > 2.75 ? Math.max(0, (duration - time) / (duration - 2.75)) : 1
  const sample = Math.max(-1, Math.min(1, mix[index] * normalization * fade))
  pcm.writeInt16LE(Math.round(sample * 32767), index * 2)
}

const header = Buffer.alloc(44)
header.write('RIFF', 0)
header.writeUInt32LE(36 + pcm.length, 4)
header.write('WAVE', 8)
header.write('fmt ', 12)
header.writeUInt32LE(16, 16)
header.writeUInt16LE(1, 20)
header.writeUInt16LE(1, 22)
header.writeUInt32LE(sampleRate, 24)
header.writeUInt32LE(sampleRate * 2, 28)
header.writeUInt16LE(2, 32)
header.writeUInt16LE(16, 34)
header.write('data', 36)
header.writeUInt32LE(pcm.length, 40)

fs.writeFileSync(new URL('../public/audio/round-victory-doodle.wav', import.meta.url), Buffer.concat([header, pcm]))
