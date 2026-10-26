// Capture only explicitly listed page controls/statuses. Never capture video,
// uploaded file contents, model weights, or unrelated page/form data.
const readings = {
  lecture: {
    controls: [['cnnFilter', 'Displayed filter']],
    text: [['cnnStatus', 'Model state'], ['cnnEvaluation', 'Held-out evaluation'], ['cnnExampleResult', 'Example prediction'], ['cnnFeatureStatus', 'Feature map']]
  },
  deep: {
    controls: [['bpTarget', 'True class'], ['bpRate', 'Learning rate'], ['bpWeight', 'Current K[0,0]']],
    text: [['bpStage', 'Calculation stage'], ['bpForward', 'Forward calculation'], ['bpUpdateResult', 'Update result']]
  },
  playground: {
    controls: [['filter', 'Filter'], ['relu', 'ReLU'], ['brushSize', 'Brush size'], ['twist', 'Game twist']],
    text: [['calculation', 'Selected patch'], ['status', 'Input mode'], ['seen', 'Tracking state'], ['toolCue', 'Brush rule']]
  },
  final: {
    controls: [['purpose', 'Round purpose'], ['simLabel', 'Simulation move'], ['movementDuration', 'Movement time (ms)'], ['lead', 'Lock lead'], ['late', 'Hide simulated opening']],
    text: [['modeTag', 'Mode'], ['modelInfo', 'Model source'], ['counts', 'Training counts'], ['prediction', 'Early guess'], ['timing', 'Lock timing'], ['evidenceStatus', 'Early evidence'], ['score', 'Test report'], ['roundResult', 'Last round']]
  },
  home: {
    controls: [['positionSource', 'Position source'], ['effect', 'Effect'], ['trailLength', 'Recent observations'], ['fps', 'CSV frames per second']],
    text: [['sampleDescription', 'Video source'], ['previewStatus', 'Data state'], ['frameInfo', 'Inspected frame'], ['tinyStatus', 'Optional CNN state']]
  }
};

export function captureReadings(key, root, timestamp = new Date().toISOString()) {
  const config = readings[key];
  if (!config) return '';
  const lines = [`Page readings · ${timestamp}`, 'Copied from the current interface; not an independent accuracy measurement.'];
  const get = id => root.getElementById(id);
  for (const [id, label] of config.controls) {
    const node = get(id);
    if (!node || node.hidden || node.closest?.('[hidden]')) continue;
    const value = node.type === 'checkbox' ? (node.checked ? 'on' : 'off') :
      node.tagName === 'SELECT' ? node.selectedOptions?.[0]?.textContent : node.value;
    lines.push(`${label}: ${String(value ?? '').trim() || '(not set)'}`);
  }
  for (const [id, label] of config.text) {
    const node = get(id);
    if (!node || node.hidden || node.closest?.('[hidden]')) continue;
    const value = (node.innerText ?? node.textContent)?.trim();
    if (value) lines.push(`${label}: ${value.length > 2400 ? value.slice(0, 2400) + '\n[Long reading shortened; inspect the activity for the full calculation.]' : value}`);
  }
  if (lines.length === 2) lines.push('No experiment readings are available on this page yet.');
  return lines.join('\n');
}

export function appendReadings(notes, reading, limit = 12000) {
  const combined = notes ? `${notes}\n\n${reading}` : reading;
  return combined.length <= limit ? combined : null;
}
