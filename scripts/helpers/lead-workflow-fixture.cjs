const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8').replace(/\r\n/g, '\n');
function functionSource(file, name) {
  const text = file === 'js/app.js' ? source : fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
  const start = text.search(new RegExp('(?:async )?function ' + name + '\\('));
  if (start < 0) throw new Error('Missing function: ' + name);
  const rest = text.slice(start);
  const next = rest.slice(1).search(/\n(?:async )?function |\n(?:const|let) /);
  return next < 0 ? rest : rest.slice(0, next + 1);
}
function constant(name) {
  const match = source.match(new RegExp('const ' + name + ' = [\\s\\S]*?\\n(?:\\];|\\};)'));
  if (!match) throw new Error('Missing constant: ' + name);
  return match[0];
}
const constants = ['LEAD_COLUMNS', 'FUNNEL_STAGES', 'LEAD_LANGUAGE_LEVELS', 'LEAD_APPLICANTS', 'LEAD_GENDERS',
  'LEAD_UZ_REGIONS', 'LEAD_FOREIGN_COUNTRIES', 'LEAD_LEARNING_GOALS', 'LEAD_INFO_PROVIDED_QUESTIONS'];
function appContext(names, globals = {}) {
  const context = vm.createContext({ leadWorkflow: require('../../js/leadWorkflow'), trialWorkflow: require('../../js/trialWorkflow'), ...globals });
  if (names.includes('renderLeadCard')) names = [...new Set([...names, 'renderTrialAttendanceBadge', 'renderLeadTrialStatus'])];
  vm.runInContext(constants.map(constant).join('\n') + '\nconst LEAD_STATUS_IDS = new Set(LEAD_COLUMNS.map(c => c.id));\n'
    + names.map(name => functionSource('js/app.js', name)).join('\n'), context);
  return context;
}
function browserBundle(extraNames = []) {
  const names = ['normalizeLeadStatus', 'normalizeLeadExtras', 'renderSurveyRadioGroup', 'renderSurveyCarousel',
    'initSurveyCarousels', 'getSurveyOptionLabel', 'collectConnectedSurveyData', 'formatConnectedSurveyComment',
    'renderInfoProvidedQuestions', 'collectInfoProvidedData', 'clearInfoProvidedValidation', 'showInfoProvidedValidation',
    'clearLeadModalValidation', 'findFirstLeadModalIncompleteTarget', 'showLeadModalValidation', 'wireLeadModalValidationClear',
    'formatInfoProvidedComment', 'openConnectedSurveyModal', 'collectDeferredPurchaseData', 'openDeferredPurchaseModal',
    'renderDeferredPurchaseDates', 'renderTrialAttendanceBadge', 'renderLeadTrialStatus', 'renderLeadCard', ...extraNames];
  return {
    code: fs.readFileSync(path.join(root, 'js/leadWorkflow.js'), 'utf8') + '\n'
      + fs.readFileSync(path.join(root, 'js/trialWorkflow.js'), 'utf8') + '\n' + constants.map(constant).join('\n')
      + '\nconst LEAD_STATUS_IDS = new Set(LEAD_COLUMNS.map(c => c.id));\n' + names.map(name => functionSource('js/app.js', name)).join('\n')
      + '\nwindow.fixtureColumns = LEAD_COLUMNS;',
    css: fs.readFileSync(path.join(root, 'css/styles.css'), 'utf8').replace(/^@import[^\r\n]*(?:\r?\n|$)/, '')
  };
}
module.exports = { source, functionSource, constant, appContext, browserBundle };
