export interface ParsedVitalsResult {
  systolic?: string;
  diastolic?: string;
  heartRate?: string;
  temperature?: string;
  tempUnit?: 'C' | 'F';
  respiratoryRate?: string;
  oxygenSaturation?: string;
  notes?: string;
  detectedFields: string[];
}

/**
 * Parses spoken English clinical dictation into structured EMR vitals fields and encounter notes.
 * Example inputs:
 * "Blood pressure is 135 over 85, heart rate 78 bpm, temperature 37.2 degrees C, respiratory rate 16, oxygen saturation 98 percent. Patient complains of severe headache."
 * "BP 120/80, pulse 72, temp 98.6 F, RR 18, spo2 99."
 */
export function parseVitalsFromSpeech(transcript: string): ParsedVitalsResult {
  if (!transcript || !transcript.trim()) {
    return { detectedFields: [] };
  }

  const result: ParsedVitalsResult = {
    detectedFields: [],
  };

  const text = transcript;

  // 1. Blood Pressure: e.g. "blood pressure 135 over 85", "BP 120/80", "130 over 85"
  const bpMatch =
    text.match(/(?:blood pressure|bp|pressure)\s*(?:is|=|:)?\s*(\d{2,3})\s*(?:over|\/|-)\s*(\d{2,3})/i) ||
    text.match(/(\d{2,3})\s*(?:over|\/)\s*(\d{2,3})\s*(?:mmhg)?/i);

  if (bpMatch) {
    const sys = parseInt(bpMatch[1], 10);
    const dia = parseInt(bpMatch[2], 10);
    if (sys >= 60 && sys <= 250 && dia >= 30 && dia <= 150) {
      result.systolic = String(sys);
      result.diastolic = String(dia);
      result.detectedFields.push('Blood Pressure');
    }
  }

  // 2. Heart Rate / Pulse: e.g. "heart rate 78", "pulse 82 bpm", "hr 75"
  const hrMatch =
    text.match(/(?:heart rate|pulse|hr)\s*(?:is|=|:)?\s*(\d{2,3})/i) ||
    text.match(/(\d{2,3})\s*(?:bpm|beats per minute)/i);

  if (hrMatch) {
    const hr = parseInt(hrMatch[1], 10);
    if (hr >= 30 && hr <= 220) {
      result.heartRate = String(hr);
      result.detectedFields.push('Heart Rate');
    }
  }

  // 3. Temperature: e.g. "temperature 37.2 degrees C", "temp 98.6 fahrenheit", "36.8 C"
  const tempMatch = text.match(
    /(?:temperature|temp)\s*(?:is|=|:)?\s*(\d{2,3}(?:\.\d)?)\s*(?:degrees?)?\s*(celsius|fahrenheit|centigrade|c|f)?/i
  );

  if (tempMatch) {
    const val = parseFloat(tempMatch[1]);
    if (val >= 30 && val <= 110) {
      result.temperature = String(val);
      const unitRaw = tempMatch[2]?.toLowerCase();
      if (unitRaw === 'f' || unitRaw === 'fahrenheit') {
        result.tempUnit = 'F';
      } else {
        result.tempUnit = 'C';
      }
      result.detectedFields.push('Temperature');
    }
  }

  // 4. Respiratory Rate: e.g. "respiratory rate 16", "resp rate 18", "breaths 14"
  const rrMatch =
    text.match(/(?:respiratory rate|resp rate|rr|breaths?)\s*(?:is|=|:)?\s*(\d{1,2})/i) ||
    text.match(/(\d{1,2})\s*(?:breaths per minute|rpm)/i);

  if (rrMatch) {
    const rr = parseInt(rrMatch[1], 10);
    if (rr >= 6 && rr <= 60) {
      result.respiratoryRate = String(rr);
      result.detectedFields.push('Respiratory Rate');
    }
  }

  // 5. Oxygen Saturation (SpO2): e.g. "oxygen saturation 98 percent", "spo2 99%", "o2 sat 97"
  const spo2Match =
    text.match(/(?:oxygen saturation|spo2|o2 sat|oxygen|sats?)\s*(?:is|=|:)?\s*(\d{2,3})\s*(?:percent|%)?/i) ||
    text.match(/(\d{2,3})\s*(?:percent|%)\s*(?:spo2|o2|oxygen)?/i);

  if (spo2Match) {
    const spo2 = parseInt(spo2Match[1], 10);
    if (spo2 >= 50 && spo2 <= 100) {
      result.oxygenSaturation = String(spo2);
      result.detectedFields.push('Oxygen Saturation');
    }
  }

  // 6. Clinical Encounter Notes: cleaned transcript
  result.notes = transcript.trim();

  return result;
}
