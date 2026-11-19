# AI design rules (anti-slop)

## Core principle
You default to the statistical median of your training data whenever a design choice is left unspecified. That median is the "AI look." Before shipping any UI, assume your first instinct for color, type, and layout is that median, and make one deliberate departure from it.

## Color
- Do not default to an indigo or purple gradient (the Tailwind `indigo-500` / `violet-500` reflex). Pick a palette from the actual brand. If there is no brand, choose one committed accent and justify it, rather than a gradient of two adjacent hues.
- Do not fall back to emerald or cream just because purple is off the table. Those are the second-wave defaults now.
- Avoid neon-on-near-black with colored glow shadows unless the product genuinely calls for a dark developer aesthetic.
- Use one dominant color with a real accent, not four muted colors at equal weight.
- Do not apply gradient fills to headings or numbers as decoration.

## Typography
- Build a real type scale with clear steps. Do not set the whole page in one family at one weight.
- Do not crush letter spacing on display type or set body copy in a monospace font for "hacker" flavor.

## Layout and hero
- Do not emit the default hero: centered eyebrow pill, oversized centered headline, two buttons (gradient primary reading "Get Started" plus ghost secondary), gradient orb behind. If you build a centered hero, vary it.
- Do not resolve every feature section into exactly three equal cards with an icon on top. Let the content decide the count and shape.
- Avoid the full template waterfall in fixed order. Cut or reorder sections to fit the actual story.
- Do not invent trust content: no fabricated user counts ("Trusted by 5,000+ teams"), no placeholder client logo walls.
- Vary spacing for rhythm and emphasis. Do not apply one uniform section padding everywhere.

## Components and surfaces
- Do not apply one large border radius (`rounded-2xl`) to every card, input, button, and image. Vary radius by element.
- Do not pair a hairline border with a wide diffuse shadow on the same card. Commit to one edge treatment.
- Do not put a decorative colored strip on the left border of ordinary cards. That treatment belongs to semantic alerts.
- Avoid frosted glassmorphism where there is no real layering problem to solve.

## Icons and imagery
- Do not use the same five Lucide icons across unrelated concepts (Sparkles for AI, Zap for fast, Shield for secure). Pick icons that match the specific meaning, or use none.
- Never use emoji as feature-card or section icons in a product UI.
- Do not use a fake terminal window with macOS traffic-light dots as the hero visual unless it is a developer tool showing real output.

## Copy
- Do not write the weightless headline that could describe any product ("Build faster. Ship smarter."). Say what this specific product does.
- Strip the buzzword layer: streamline, supercharge, empower, world-class, enterprise-grade, seamless, robust, unlock, unleash, "in today's fast-paced world."
- Do not overuse the em dash, the "it's not just X, it's Y" pivot, or a manufactured-contrast aphorism at the end of every section.
- Do not set every heading, button, and label in Title Case out of reflex. Pick a case convention and apply it with intent.
