import Meyda from "meyda";

// Eenvoudige, dependency-lichte stem-"vingerafdruk": we middelen MFCC-
// coëfficiënten (klankkleur-kenmerken) over alle niet-stille frames van een
// audiofragment. Dit is geen state-of-the-art speaker-embedding zoals grote
// deep-learning modellen die gebruiken, maar werkt zonder Python/GPU en geeft
// in de praktijk bruikbare resultaten om dezelfde stem terug te herkennen.

const FRAME_SIZE = 1024; // moet een macht van 2 zijn voor Meyda
const HOP_SIZE = 512;
const SAMPLE_RATE = 16000;
const SILENCE_RMS = 0.012;

Meyda.sampleRate = SAMPLE_RATE;
Meyda.bufferSize = FRAME_SIZE;

function rms(frame) {
  let sum = 0;
  for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
  return Math.sqrt(sum / frame.length);
}

/**
 * Berekent een gemiddelde MFCC-vector (de "stem-vingerafdruk") uit ruwe
 * PCM-samples (Float32, 16kHz mono). Stille stukken worden overgeslagen.
 */
export function embeddingFromSamples(samples) {
  const vectors = [];
  for (let i = 0; i + FRAME_SIZE <= samples.length; i += HOP_SIZE) {
    const frame = samples.subarray(i, i + FRAME_SIZE);
    if (rms(frame) < SILENCE_RMS) continue;
    const mfcc = Meyda.extract("mfcc", frame);
    if (mfcc) vectors.push(mfcc);
  }
  if (vectors.length < 4) {
    throw new Error(
      "Te weinig bruikbare spraak in dit fragment (te stil of te kort) om een stemprofiel van te maken."
    );
  }
  const dims = vectors[0].length;
  const avg = new Array(dims).fill(0);
  for (const v of vectors) {
    for (let d = 0; d < dims; d++) avg[d] += v[d];
  }
  for (let d = 0; d < dims; d++) avg[d] /= vectors.length;
  return avg;
}

export function cosineSimilarity(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
