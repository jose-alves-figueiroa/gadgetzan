# CLAUDE.md

## Project

Gadgetzan is a self-hosted personal finance application for a single user.

* Language: Brazilian Portuguese (`pt-BR`)
* Runtime: self-hosted / local network
* Data entry: manual
* Product goal: financial decision support, not merely bookkeeping

## Project Documentation

Project-specific documentation lives under:

```text
docs/agents/
```

Read the relevant document before implementing behavior covered by it.

| Document                                | Authority                                             |
| --------------------------------------- | ----------------------------------------------------- |
| `docs/agents/README.md`                 | Documentation map and handoff overview                |
| `docs/agents/PROMPT.md`                 | Initial execution instructions                        |
| `docs/agents/PLAN.md`                   | Implementation backlog, order, and DoD                |
| `docs/agents/01-data-model.md`          | Data model                                            |
| `docs/agents/02-business-rules.md`      | Financial business rules                              |
| `docs/agents/03-screens.md`             | Screens, routes, UI behavior, and responsive behavior |
| `docs/agents/04-design-tokens.md`       | Visual design system                                  |
| `docs/agents/05-acceptance-criteria.md` | Acceptance criteria and E2E flows                     |
| `docs/agents/06-stack-and-deploy.md`    | Stack, architecture, authentication, and deployment   |
| `docs/agents/07-open-decisions.md`      | Unresolved decisions and explicit out-of-scope items  |

Do not duplicate the detailed contents of these documents in this file.

If documentation conflicts, do not silently choose an interpretation. Stop and ask.

## Implementation Rules

### Technology versions

Default to the current LTS / latest stable GA release of every technology choice — never a pre-release, RC, dev, or preview build, and never an old major once a newer stable major has shipped. This overrides literal version numbers written in `docs/agents/06-stack-and-deploy.md`; what's authoritative from that document is behavior and structure, not the version pins. See `docs/agents/06-stack-and-deploy.md § Versioning policy`. Decide a version once per dependency; don't re-litigate it without a real reason (a security advisory, a breaking incompatibility).

### Follow the plan

`docs/agents/PLAN.md` defines the implementation order.

Do not skip stages.

Do not proceed with known failing tests or a broken build.

At the end of each stage, run:

```bash
pnpm test
pnpm build
```

Report the result and remaining work before proceeding.

### Financial domain

All financial calculations and business rules belong in:

```text
lib/finance/
```

Financial domain functions must be pure and independently testable.

They must not depend on:

* Prisma
* PostgreSQL
* Next.js
* React
* HTTP/request objects
* browser APIs
* UI state

Never duplicate financial calculations in components or route handlers.

Prisma and database access belong outside the financial domain.

### Money

Money is always represented as integer **centavos**.

Never use `Float` for monetary values.

Never perform monetary calculations using floating-point arithmetic.

Parsing and formatting happen at system boundaries.

Use the application's Brazilian monetary conventions defined in the acceptance criteria and design documentation.

### Dates

Financial competence is date-based.

Never use time-of-day when comparing or calculating financial competence.

Follow the financial-month rules defined in:

```text
docs/agents/02-business-rules.md
```

Do not introduce timezone-dependent behavior into competence calculations.

### Business rules

`docs/agents/02-business-rules.md` is the source of truth for financial behavior.

Do not infer financial rules from the UI.

Do not simplify or duplicate business rules in presentation code.

Future values must preserve their confidence classification:

```text
REALIZED
CONFIRMED
RECURRING
PROJECTED
```

### Design

`docs/agents/04-design-tokens.md` is the visual source of truth.

Use the defined tokens for colors, typography, spacing, radii, components, and charts.

Do not invent visual values when an existing token applies.

UI copy is `pt-BR` and must follow the terminology defined by the design documentation.

The HTML files under:

```text
docs/agents/design/
```

are design references, not production code.

Recreate the designs using the application's React/Tailwind implementation. Do not copy prototype implementation code.

Use Phosphor Icons as specified by the design handoff.

### Testing

Financial behavior must be covered by Vitest.

The acceptance criteria in:

```text
docs/agents/05-acceptance-criteria.md
```

define expected behavior.

Do not weaken, remove, or bypass tests simply to make them pass.

End-to-end behavior must follow the Playwright flows defined by the acceptance criteria.

## Changelog

Maintain the project changelog in:

```text
CHANGELOG.md
```

The changelog records meaningful changes to the application's behavior and is written in Brazilian Portuguese (`pt-BR`).

Update `CHANGELOG.md` after a requested change or implementation stage is complete and:

```bash
pnpm test
pnpm build
```

both pass.

Do not update the changelog for incomplete work or known failing tests.

### Format

Use this structure:

```md
## [DD/MM/YYYY - HH:mm]

### Modificado
- ...

### Adicionado
- ...

### Removido
- ...

### Corrigido
- ...

### Impacto
- ...
```

Only include sections that are relevant. Do not create empty sections.

### Changelog content

Describe **behavioral changes**, not merely files or implementation steps.

Prefer explaining:

* what behavior changed;
* relevant domain rules;
* important edge cases;
* affected integrations or downstream behavior;
* relevant function, module, endpoint, or architectural names when they clarify the change;
* the practical impact on users, data, or the system.

For example, prefer:

```md
### Modificado
- O cancelamento de créditos passou a consolidar as assinaturas por produto,
  preservando apenas o item com maior `validUntil` como sobrevivente.
```

instead of:

```md
### Modificado
- Refatorado `subscriptionWriteModel.ts`.
- Adicionados testes.
```

Implementation details may be included when they are important for understanding the resulting behavior.

Do not fabricate changes, impacts, deployment dates, or requirements.

Do not claim a change was deployed unless it was actually deployed.

Do not rewrite previous changelog entries unless correcting an error.

Group related changes into a single changelog entry instead of creating one entry per commit or file.

The `Impacto` section should explain the relevant consequences of the change, including preserved behavior when that is important for defining scope.

When a change has not been deployed, do not use a fake `Deploy` date. Use an appropriate non-deployment heading if the project's existing changelog convention requires recording the change before deployment.

## Decisions

Resolved product decisions must not be reopened.

Unresolved decisions are documented in:

```text
docs/agents/07-open-decisions.md
```

If an unresolved decision blocks implementation, ask the product owner.

Do not invent product behavior merely to unblock implementation.

Likewise, do not implement functionality explicitly marked as out of scope without explicit instruction.

## Architecture Principles

* Keep domain logic independent from infrastructure.
* Keep persistence concerns in the data-access layer.
* Keep UI concerns in React components.
* Prefer explicit domain functions over implicit calculations.
* Prefer existing abstractions over introducing duplicate ones.
* Keep business behavior deterministic and testable.
* Preserve the single-user product boundary while keeping `userId` in user-owned data as specified by the data model.

## Working with Documentation

Before changing behavior:

1. Identify which specification governs it.
2. Read that specification.
3. Check `07-open-decisions.md` for unresolved constraints.
4. Check `05-acceptance-criteria.md` for expected behavior.
5. Implement.
6. Add or update tests.
7. Run the relevant checks.
8. Update `CHANGELOG.md` when the implementation is complete and all required checks pass.

When a recurring implementation mistake reveals a missing **project-wide invariant**, update this file.

Do not put temporary task information, implementation progress, or detailed requirements here.

## Priority

When deciding how to implement something, use this order:

1. Explicit user instruction
2. Resolved product decisions
3. Business rules
4. Data model
5. Acceptance criteria
6. Screen/design specifications
7. Existing architecture and conventions
8. Reasonable implementation judgment

When none of these determines the behavior and the decision affects the product, ask instead of guessing.
