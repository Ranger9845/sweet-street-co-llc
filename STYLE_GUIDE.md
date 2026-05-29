# Sweet Street Storefront Style Guide

This style guide documents the core design tokens for the Sweet Street customer storefront, including colors, typography, spacing, and border radii. All tokens are defined as CSS custom properties in `src/index.css`. Future updates should be made here first and then propagated to `src/index.css`.

---

## Color Palette

### Light Mode (default)

| Token                              | CSS Variable                | HSL Values           | Description               |
|------------------------------------|-----------------------------|----------------------|---------------------------|
| Background                         | `--background`              | 24, 100%, 96%        | Peachy cream              |
| Foreground (text)                  | `--foreground`              | 20, 50%, 20%         | Dark charcoal             |
| Border                             | `--border`                  | 20, 30%, 84%         | Light gray                |
| Card background                    | `--card`                    | 0, 0%, 100%          | Pure white                |
| Card foreground                    | `--card-foreground`         | 20, 50%, 20%         | Dark charcoal             |
| Primary background                 | `--primary`                 | 16, 90%, 78%         | Soft coral-peach          |
| Primary foreground (text on primary) | `--primary-foreground`    | 20, 55%, 22%         | Strong contrast on coral  |
| Secondary background               | `--secondary`               | 34, 80%, 85%         | Warm apricot              |
| Secondary foreground               | `--secondary-foreground`    | 30, 60%, 22%         | Deep apricot text         |
| Destructive (error/critical)       | `--destructive`             | 0, 84.2%, 60.2%      | Vivid red for errors      |
| Destructive foreground             | `--destructive-foreground`  | 0, 0%, 98%           | White text on red         |
| Muted background (disabled, UI accents) | `--muted`            | 24, 50%, 92%         | Light neutral gray        |
| Muted foreground                   | `--muted-foreground`        | 20, 28%, 42%         | Medium gray text          |

### Dark Mode

| Token                  | CSS Variable               | HSL Values          | Description              |
|------------------------|----------------------------|---------------------|--------------------------|
| Background             | `--background`             | 345, 50%, 10%       | Deep charcoal            |
| Foreground             | `--foreground`             | 51, 100%, 95%       | Crisp white              |
| Border                 | `--border`                 | 345, 30%, 25%       | Dark gray                |
| Card background        | `--card`                   | 345, 50%, 15%       | Dark card surface        |
| Primary background     | `--primary`                | 345, 80%, 40%       | Dark coral emphasis      |
| Primary foreground     | `--primary-foreground`     | 51, 100%, 95%       | White text on coral      |
| Secondary background   | `--secondary`              | 214, 40%, 40%       | Dark steel blue          |
| Secondary foreground   | `--secondary-foreground`   | 51, 100%, 95%       | White text on blue       |
| Destructive            | `--destructive`            | 0, 62.8%, 30.6%     | Deep error red           |

---

## Typography

| Token         | CSS Variable            | Value                               | Description                              |
|---------------|-------------------------|-------------------------------------|------------------------------------------|
| Sans serif    | `--app-font-sans`       | 'Outfit', 'Inter', sans-serif       | Main UI sans-serif font                  |
| Serif         | `--app-font-serif`      | 'Playfair Display', Georgia, serif  | Highlighted headings or accents          |
| Monospace     | `--app-font-mono`       | Menlo, monospace                    | Code snippets or fixed-width contexts    |


Base font stacks and weights are applied via Tailwind's `font-sans`, `font-serif`, and `font-mono` utilities.

---

## Spacing & Border Radius

| Token           | CSS Variable      | Value                 | Usage                                        |
|-----------------|-------------------|-----------------------|----------------------------------------------|
| Base spacing    | `--spacing`       | 0.25rem               | Used for small gaps/margins                  |
| Border radius   | `--radius`        | 1rem                  | Base border radius                           |
| Small radius    | `--radius-sm`     | calc(var(--radius) - 4px) | Buttons and small elements             |
| Medium radius   | `--radius-md`     | calc(var(--radius) - 2px) | Cards and panels                       |
| Large radius    | `--radius-lg`     | var(--radius)         | Default for most containers                   |
| Extra radius    | `--radius-xl`     | calc(var(--radius) + 4px) | Modals and highlighted surfaces        |

Margin and padding increments follow Tailwind’s spacing scale (multiples of `--spacing`).

---

## Next Steps

1. Review and confirm token values.
2. Refactor individual page components to use CSS variables and Tailwind classes that map to these tokens.
3. Gradually migrate hard-coded colors, fonts, and spacing to use the tokens defined here.

---

*Document version: 1.0*