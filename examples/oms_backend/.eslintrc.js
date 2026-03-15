module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin', 'unused-imports'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js', 'src/db/migrations/**', 'src/database/migrations/**'],
  rules: {
    // JS 규칙
    'no-console': 'error', // console.log 사용 금지
    'no-unused-vars': 'off', // JS에서의 unused-vars 규칙 비활성화
    'no-extra-semi': 0, // 불필요한 세미콜론 사용 허용

    // TS 전용 규칙
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }], // TS에서의 unused-vars 규칙 활성화, _로 시작하는 것은 허용
    '@typescript-eslint/interface-name-prefix': 'off', // 인터페이스에서 I로 시작하는 규칙 비활성화
    '@typescript-eslint/explicit-function-return-type': 'off', // 함수에서 리턴 타입을 명시하는 규칙 비활성화
    '@typescript-eslint/explicit-module-boundary-types': 'off', // 모듈의 타입 명시하는 규칙 비활성화
    '@typescript-eslint/no-explicit-any': 'off', // any 타입 사용 금지 비활성화, TODO: 제거

    // Promise 관련 규칙
    'no-promise-executor-return': 'error', // Promise executor 함수에서의 불필요한 return 사용 금지
    '@typescript-eslint/no-misused-promises': 'warn', // Promise 오용 경고

    // 미사용 import 제거
    'unused-imports/no-unused-imports': 'error',
    'unused-imports/no-unused-vars': [
      'warn',
      {
        vars: 'all',
        varsIgnorePattern: '^_',
        args: 'after-used',
        argsIgnorePattern: '^_',
      },
    ],
  },
}
