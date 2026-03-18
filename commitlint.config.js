module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'header-max-length': [2, 'always', 200],
    'subject-case': [0, 'never'],
    'subject-full-stop': [0, 'never'],
  },
};
