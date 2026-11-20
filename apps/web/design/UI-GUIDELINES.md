# UI Guidelines — Comp web app

## Navigation and information architecture
- **Top bar only, no sidebar.** The app has four sections, so a single horizontal bar keeps the full width for content.
- **Section order: Overview, Items, Reports, Settings** (`data-nav-key`: `overview`, `items`, `reports`, `settings`). Order follows how often people use them, most frequent first.
- **Account lives at the right of the top bar** (`data-nav-key="account"`), apart from the sections, because it is personal, not a place to work in.
- **Below 48rem the section links collapse behind a "Menu" button.** A phone has no room for four links beside the brand.
- **Every screen marks its own section as the current page** so people always know where they are; detail screens stay under their parent section.

## Layout and density
- **Moderately dense, work-oriented.** People scan and compare records repeatedly, so favour compact rows over decorative whitespace.
- **One content column, up to `size-container` wide, centered.** Long lines of data are harder to track.
- **Design phone-first at 375px, then widen.** Multi-column `.grid` layouts must fall back to one column on their own.
- **Space between groups uses `space-4`; inside a group uses `space-2`/`space-3`.** Consistent rhythm shows what belongs together.

## Component usage
- **Use a `.card` for a self-contained summary or a form group; use a table for comparing many records across the same fields; use a plain list for short, single-line items.** Cards hide comparisons; tables hide mobile layout, so keep them for real tabular data.
- **One `.btn-primary` per screen or dialog.** It marks the single next step.
- **Use `.btn-secondary` for other actions, `.btn-ghost` for low-emphasis ones in toolbars, `.btn-danger` only for destructive confirmations.** Colour carries meaning only if it is rare.
- **Use `.btn-icon` only for familiar actions and always give it a label via `aria-label`.** Unlabelled icons are guesses.
- **Wrap every form control in a `.field` with `.field-label`; show problems in `.field-error` with `.is-invalid` on the control.** The message must sit next to what needs fixing.
- **Use `.modal` only for confirmations and short decisions; use `.drawer` for editing or details of a record.** A drawer keeps the list visible behind it.
- **Use `.toast` for confirmation of a completed action; use `.alert` for problems that stay until fixed.** Toasts vanish, so they must never carry the only copy of an error.
- **Use `.badge` for record status (success, warning, danger, neutral) and `.chip` for filters people can toggle.** Status is read-only; filters are interactive.
- **Use `.skeleton` for content that is loading and `.spinner` for an action in progress; use `.empty-state` with one `.btn-primary` when a list has no records.** Each tells people what is happening or what to do.
- **Use `.tabs` to switch views of the same record and `.dropdown` for choosing one option from many.** Tabs are for peers; dropdowns save space.

## Theme stance
- **Light only.** The tokens define one theme; a dark theme is out of scope until it has its own token set, so screens never need `prefers-color-scheme` branches.

## Voice and tone
- **Plain and direct, sentence case, active voice.** People are here to get work done, not to be charmed.
- **Buttons say the verb and the object ("Save item", "Delete report").** A button should be clear without its surrounding text.
- **Errors say what happened and how to fix it, without blame ("Enter an email like name@example.com").** Blame stalls people; a next step moves them.
- **Empty states explain what the area is for and offer the first action.** An empty screen is the first impression of a feature.
