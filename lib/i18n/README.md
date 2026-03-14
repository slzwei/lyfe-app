# i18n — Internationalization

## Adding new strings
Add keys to `locales/en.json` under a namespace matching the screen or feature.

## Using in components
```tsx
import { useTranslation } from 'react-i18next';
const { t } = useTranslation();
<Text>{t('common.loading')}</Text>
```

## Adding a new language
1. Create `locales/xx.json` (copy `en.json` and translate).
2. Import it in `index.ts` and add to `resources: { en: …, xx: … }`.
3. Set `lng` or add a language picker that calls `i18n.changeLanguage('xx')`.
