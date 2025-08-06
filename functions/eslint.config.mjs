// @ts-check
import globals from 'globals'
import pluginJs from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginPromise from 'eslint-plugin-promise'
import stylistic from '@stylistic/eslint-plugin'

export default [
    { files: ['**/*.{js,mjs,cjs,ts}'] },
    { files: ['**/*.js'], languageOptions: { sourceType: 'commonjs' } },
    { languageOptions: { globals: globals.node } },
    pluginJs.configs.recommended,
    pluginPromise.configs['flat/recommended'],
    ...tseslint.configs.strict,
    ...tseslint.configs.stylistic,
    stylistic.configs.customize({
        indent: 4,
        semi: false,
        commaDangle: 'only-multiline'
    }),
    {
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/naming-convention': 'off',
            '@typescript-eslint/no-misused-promises': 'off',
            '@typescript-eslint/no-confusing-void-expression': 'off',
            '@typescript-eslint/strict-boolean-expressions': 'off',
            '@typescript-eslint/ban-ts-comment': 'off',
            '@typescript-eslint/no-extraneous-class': 'off',
            '@stylistic/max-statements-per-line': 'off',
        }
    }
]
