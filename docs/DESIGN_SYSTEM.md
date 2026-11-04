# Design foundations

Preview `/design-system` at 375 px and 1440 px in light and dark system themes.

- App: Geist. Story titles: Lora, via `font-display`. Mono: Geist Mono for technical references only. Fonts load through Next's font loader.
- Accent: burnt orange. Use `primary` for actions, `accent` for soft emphasis, and neutrals for surfaces. Evidence levels must also have text labels.
- Use semantic Tailwind utilities (`bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`, `border-border`), not hardcoded palette values.
- Light/dark follow the system, with explicit `.light` or `.dark` overrides on the root. Existing `dark:` utilities respect both.
- Base radius: 12 px; smaller controls and larger panels derive from it. Use the spacing scale, with 24 to 40 px page gutters and generous section spacing.
- `components/ui`: shadcn Button, Card, Badge and Input, copied from the official new-york registry, with 44 px control targets. `cn` merges class overrides. `components.json` supports adding more components.
- Use Button `asChild` with a Link for navigation. Give every field a visible label and every icon-only action an accessible name. Focus must stay visible. Motion respects reduced-motion preference.

This foundation does not restyle Div's game or checkpoint components. New screens should consume these tokens and primitives. Shared CSS typography and theme are global.

Sources: [shadcn theming](https://ui.shadcn.com/docs/theming), [official new-york registry](https://ui.shadcn.com/r/styles/new-york/button.json). Components remain editable source in this repository.
