import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // SEC-008 / SEC-009: chữ của người dùng chỉ hiển thị dạng text, không chèn HTML.
      'no-restricted-syntax': ['error', { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: 'Không chèn HTML (SEC-008 / SEC-009).' }],
    },
  },
  {
    // Layer rule (architecture-design §Layer): domain không phụ thuộc UI / dữ liệu.
    files: ['src/domain/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: ['../data/*', '../features/*', '../ui/*', '../app/*', 'react', 'dexie'] }] },
  },
)
