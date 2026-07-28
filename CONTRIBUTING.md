# Contributing

Thanks for helping grow this collection of Claude Agent Skills.

## Ground rules

- License contributions under **Apache-2.0** (same as this repo).
- One skill per PR when possible.
- Keep `SKILL.md` concise (ideally under 500 lines). Put deep detail in `references/`.
- Do not put secrets, private company data, or real PII in sample `DATA` or examples.

## Add a skill

1. Copy `template/` to `skills/<skill-name>/`.
2. Edit `SKILL.md`:
   - `name`: lowercase letters, numbers, hyphens; max 64 chars; must not contain reserved words like `anthropic` or `claude`.
   - `description`: third person; include **what** the skill does and **when** Claude should use it (max 1024 chars).
   - Optional: `license: Apache-2.0`
3. Add optional `scripts/`, `references/`, or `assets/` only if the agent needs them.
4. Update the skills table in `README.md`.
5. Open a pull request with a short summary of when the skill should trigger.

## Skill quality checklist

- [ ] Description includes trigger phrases a user might actually say
- [ ] Instructions are step-by-step and actionable
- [ ] Sample data (if any) is clearly fictional
- [ ] Scripts declare dependencies and how to run them
- [ ] Paths use forward slashes (`scripts/foo.js`, not `scripts\foo.js`)
- [ ] No README inside the skill folder (repo-level README only)

## Improve an existing skill

Prefer small, focused changes: clearer triggers, tighter instructions, safer scripts, or better examples. Say why the change helps Claude pick or follow the skill.
