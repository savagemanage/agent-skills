# Claude Skills

Claude용 오픈소스 [Agent Skills](https://agentskills.io/) 모음입니다. 작업에 맞을 때 Claude가 불러오는 지침·스크립트 폴더입니다.

Copyright 2026 이장훈 (Janghoon Lee). **라이선스:** [Apache-2.0](./LICENSE)

[English README](./README.md)

## 스킬

| 스킬 | 이런 때 사용 | Claude.ai zip |
| --- | --- | --- |
| [gov-one-pager](./skills/gov-one-pager/) | 정부지원 사업 요약서 / 추진계획(안) / 1페이지 요약서 | [다운로드](./dist/gov-one-pager.zip) |
| [exec-one-pager](./skills/exec-one-pager/) | 영문 경영·피치·스타트업 원페이저 | [다운로드](./dist/exec-one-pager.zip) |
| [voice](./skills/voice/) | 문서·슬랙·이메일·PDF용 이장훈 말투 | [다운로드](./dist/voice.zip) |

형식이 다릅니다. 일반 영문 “one-pager” → `exec-one-pager`. 한국 정부·제안 표 양식 → `gov-one-pager`. 한국어 비즈니스 말투 → `voice`.

## Claude.ai에 설치

1. 위 표(또는 [`dist/`](./dist/))에서 스킬 zip을 받습니다.
2. [claude.ai](https://claude.com/) → **Settings** → **Capabilities** / **Skills** → **Upload skill**.
3. `.zip` 파일을 선택합니다.

zip은 Claude.ai가 요구하는 구조(`skill-name/SKILL.md`가 압축 루트)로 이미 맞춰 두었습니다. [Claude에서 스킬 사용하기](https://support.claude.com/en/articles/12512180-using-skills-in-claude)를 참고하세요.

원페이저 스킬로 `.docx`를 만들 때는 Node.js와 `docx`(`npm install docx`)가 필요합니다.

## Claude Code에 설치

```bash
mkdir -p .claude/skills
cp -r skills/gov-one-pager skills/exec-one-pager skills/voice .claude/skills/
```

또는 전체 심볼릭 링크:

```bash
ln -s /path/to/claude-skills/skills/* .claude/skills/
```

## 스킬 추가

1. [`template/`](./template/)를 `skills/<name>/`으로 복사
2. `name` + `description` 작성 (무엇을·언제; Claude.ai용 description은 **200자** 이하)
3. `python scripts/package-skills.py`로 `dist/<name>.zip` 갱신
4. 이 파일과 [`README.md`](./README.md)의 스킬 표 모두 수정
5. [CONTRIBUTING.md](./CONTRIBUTING.md) 참고

## 링크

- [Agent Skills](https://agentskills.io/)
- [커스텀 스킬 만들기](https://support.claude.com/en/articles/12512198-creating-custom-skills)
- [anthropics/skills](https://github.com/anthropics/skills)
