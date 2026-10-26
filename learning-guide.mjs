import {learningPaths} from './learning-paths.mjs';
import {captureReadings, appendReadings} from './learning-readings.mjs';

const prefix = 'vision-lab-guide-v1:';
export function cleanProgress(value, count) {
  return {
    step: Number.isInteger(value?.step) ? Math.max(0, Math.min(count - 1, value.step)) : 0,
    done: Array.from({length: count}, (_, i) => value?.done?.[i] === true),
    notes: typeof value?.notes === 'string' ? value.notes.slice(0, 12000) : ''
  };
}
export function readProgress(storage, key, count) {
  try { return cleanProgress(JSON.parse(storage.getItem(prefix + key)), count); }
  catch { return cleanProgress(null, count); }
}
export function writeProgress(storage, key, value) {
  try { storage.setItem(prefix + key, JSON.stringify(value)); return true; }
  catch { return false; }
}
export function notesText(path, state) {
  return `${path.title}\nSelf-reported learning checklist; not an automatic assessment.\n\n` +
    path.steps.map((step, i) => `${state.done[i] ? '[x]' : '[ ]'} ${i + 1}. ${step.title}`).join('\n') +
    `\n\nMy observations\n${state.notes || '(No observations yet.)'}\n`;
}

// All authored content is text, not HTML. Learner notes never enter innerHTML.
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function disclosure(title, content) {
  const node = element('details');
  node.append(element('summary', title), content);
  return node;
}
export function mountGuide(mount, key, storage) {
  const path = learningPaths[key];
  if (!path) return;
  let state = readProgress(storage, key, path.steps.length);
  mount.classList.add('learningGuide');
  mount.setAttribute('aria-labelledby', `guide-${key}-title`);
  const title = element('h2', path.title); title.id = `guide-${key}-title`;
  mount.replaceChildren(element('p', `GUIDED ROUTE · ${path.time}`, 'guideEyebrow'), title, element('p', path.intro));
  const preparation = element('dl');
  for (const [label, text] of [['What you need', path.prerequisites], ['Your goal', path.goal], ['A useful stopping point', path.finish]]) preparation.append(element('dt', label), element('dd', text));
  mount.append(disclosure('Before you begin: what you need and what to aim for', preparation));
  const words = element('dl');
  for (const [word, meaning] of path.words) words.append(element('dt', word), element('dd', meaning));
  mount.append(disclosure('A few words in plain English', words));
  const controls = element('div', undefined, 'guideControls');
  const label = element('label', 'Choose a step ');
  const choose = element('select'); choose.id = `guide-${key}-step`;
  for (const [i, step] of path.steps.entries()) { const option = element('option', `${i + 1}. ${step.title}`); option.value = String(i); choose.append(option); }
  label.append(choose);
  const previous = element('button', 'Previous step'); previous.type = 'button';
  const next = element('button', 'Next step'); next.type = 'button';
  controls.append(label, previous, next);
  const progress = element('p', undefined, 'guideProgress'); progress.setAttribute('role', 'status');
  const body = element('div', undefined, 'guideStep');
  mount.append(controls, progress, body);
  const notes = element('textarea'); notes.id = `guide-${key}-notes`; notes.rows = 4; notes.maxLength = 12000;
  notes.value = state.notes; notes.placeholder = 'Mode / input / what I changed / what I observed / what I can conclude';
  const notesLabel = element('label', 'My experiment notes'); notesLabel.htmlFor = notes.id;
  const storageNotice = 'Checklist and notes stay in this browser tab during this session when browser storage is available. Export to keep them. Model data and camera measurements are separate.';
  const saved = element('p', storageNotice, 'guideStorage guidePersistence');
  const download = element('button', 'Download my notes'); download.type = 'button';
  const capture = element('button', 'Add current settings and readings'); capture.type = 'button';
  const captureStatus = element('p', 'After trying an activity, add its displayed settings and results here, then explain what changed.', 'guideStorage'); captureStatus.setAttribute('role', 'status');
  const reset = element('button', 'Clear this guide’s checklist and notes'); reset.type = 'button';
  const resetConfirm = element('div'); resetConfirm.hidden = true;
  const yes = element('button', 'Clear my guide notes'); yes.type = 'button';
  const cancel = element('button', 'Keep my notes'); cancel.type = 'button';
  resetConfirm.append(element('p', 'Clear only this guide’s checklist and notes? Export first if you want to keep them. The experiment itself will not reset.'), yes, cancel);
  const noteControls = element('div', undefined, 'guideControls'); noteControls.append(capture, download, reset);
  const notebook = element('div'); notebook.append(notesLabel, notes, captureStatus, saved, noteControls, resetConfirm);
  mount.append(disclosure('Keep an observation, not just a score', notebook));
  const help = element('dl');
  for (const [problem, fix] of path.trouble) help.append(element('dt', problem), element('dd', fix));
  mount.append(disclosure('If you get stuck', help));
  if (path.selfCheck) {
    const check = element('div');
    const answers = element('fieldset'); answers.append(element('legend', path.selfCheck.question));
    let selected = null;
    const reveal = element('button', 'Check my reasoning'); reveal.type = 'button'; reveal.disabled = true;
    const feedback = element('p'); feedback.setAttribute('role', 'status'); feedback.className = 'guideFeedback';
    path.selfCheck.choices.forEach(([text], i) => {
      const label = element('label', undefined, 'guideCheck'), answer = element('input');
      answer.type = 'radio'; answer.name = `guide-${key}-self-check`; answer.value = String(i);
      answer.addEventListener('change', () => { selected = i; reveal.disabled = false; feedback.textContent = ''; });
      label.append(answer, document.createTextNode(text)); answers.append(label);
    });
    reveal.addEventListener('click', () => { if (selected !== null) feedback.textContent = path.selfCheck.choices[selected][1]; });
    check.append(answers, reveal, feedback, element('p', 'Practice only: no grade is recorded. Try another explanation to compare the reasoning.', 'guideStorage'));
    mount.append(disclosure('One-minute self-check: can you explain the idea?', check));
  }
  const onward = element('a', path.next[1]); onward.href = path.next[0]; mount.append(onward);
  function persist() {
    saved.textContent = writeProgress(storage, key, state) ? storageNotice : 'Browser storage is unavailable. Notes work until you leave or refresh this page. Download them to keep a copy.';
  }
  function render() {
    const step = path.steps[state.step];
    choose.value = String(state.step);
    previous.disabled = state.step === 0; next.disabled = state.step === path.steps.length - 1;
    progress.textContent = `Step ${state.step + 1} of ${path.steps.length} · ${state.done.filter(Boolean).length} checked by you. You can move between steps at any time.`;
    const heading = element('h3', step.title);
    const predict = element('p'); predict.append(element('strong', 'Predict first: '), document.createTextNode(step.predict));
    const action = element('p'); action.append(element('strong', 'Try: '), document.createTextNode(step.action));
    const jump = element('a', 'Go to the activity ↓', 'guideJump'); jump.href = step.href;
    const explain = element('p'); explain.append(element('strong', 'Explain or record: '), document.createTextNode(step.explain));
    const expected = element('div');
    const why = element('p'); why.append(element('strong', 'Why this matters: '), document.createTextNode(step.why));
    expected.append(element('p', step.expected), why);
    const doneLabel = element('label', undefined, 'guideCheck'), done = element('input'); done.type = 'checkbox'; done.checked = state.done[state.step];
    done.addEventListener('change', () => { state.done[state.step] = done.checked; persist(); progress.textContent = `Step ${state.step + 1} of ${path.steps.length} · ${state.done.filter(Boolean).length} checked by you. You can move between steps at any time.`; });
    doneLabel.append(done, document.createTextNode(' I tried this and can explain what happened'));
    body.replaceChildren(heading, predict, action, jump, disclosure('After trying: what should I notice?', expected), explain, doneLabel);
  }
  function changeStep(index) { state.step = index; render(); persist(); }
  choose.addEventListener('change', () => changeStep(Number(choose.value)));
  previous.addEventListener('click', () => changeStep(Math.max(0, state.step - 1)));
  next.addEventListener('click', () => changeStep(Math.min(path.steps.length - 1, state.step + 1)));
  notes.addEventListener('input', () => { state.notes = notes.value; persist(); });
  capture.addEventListener('click', () => {
    const combined = appendReadings(state.notes, captureReadings(key, document));
    if (combined === null) { captureStatus.textContent = 'There is not enough room for another reading. Download your notes, then shorten them or clear this guide before adding more. Your existing notes are unchanged.'; return; }
    state.notes = combined; notes.value = combined; persist();
    captureStatus.textContent = 'Current settings and readings added. Explain what you changed and observed; these copied readings are not an automatic assessment.';
  });
  reset.addEventListener('click', () => { resetConfirm.hidden = false; cancel.focus(); });
  cancel.addEventListener('click', () => { resetConfirm.hidden = true; reset.focus(); });
  yes.addEventListener('click', () => { state = cleanProgress(null, path.steps.length); notes.value = ''; captureStatus.textContent = 'Checklist and notes cleared. You can start a new comparison.'; resetConfirm.hidden = true; render(); persist(); reset.focus(); });
  download.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([notesText(path, state)], {type: 'text/plain;charset=utf-8'}));
    const link = element('a'); link.href = url; link.download = `vision-lab-${key}-notes.txt`;
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  render();
  // Detect disabled storage early, without waiting for a learner to type notes.
  persist();
}
if (typeof document !== 'undefined') {
  let storage; try { storage = window.sessionStorage; } catch { /* In-memory guidance still works. */ }
  for (const mount of document.querySelectorAll('[data-learning-guide]')) mountGuide(mount, mount.dataset.learningGuide, storage);
}
