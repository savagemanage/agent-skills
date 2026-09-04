# Agent Skills

오픈소스 [Agent Skills](https://agentskills.io/) 모음입니다. 호환 에이전트 도구가 작업에 맞을 때 불러오는 지침·스크립트 폴더로, Agent Skills는 오픈 표준이라 여기 담긴 스킬은 Kiro, Claude Code, opencode 같은 여러 코딩 에이전트에서 동작하며, 일부는 Claude.ai 업로드 zip으로도 제공됩니다.

[English README](./README.md)

## 목차

- [스킬](#스킬)
- [시작하기](#시작하기)
- [사용법](#사용법)
  - [Claude.ai (zip 업로드)](#claudeai-zip-업로드)
  - [코딩 에이전트 (Claude Code, Kiro, opencode)](#코딩-에이전트-claude-code-kiro-opencode)
- [기여하기](#기여하기)
- [링크](#링크)
- [라이선스](#라이선스)

## 스킬

| 스킬 | 이런 때 사용 | Claude.ai zip |
| --- | --- | --- |
| [gov-one-pager](./skills/gov-one-pager/) | 정부지원 사업 요약서 / 추진계획(안) / 1페이지 요약서 | [다운로드](./dist/gov-one-pager.zip) |
| [exec-one-pager](./skills/exec-one-pager/) | 영문 경영·피치·스타트업 원페이저 | [다운로드](./dist/exec-one-pager.zip) |
| [voice](./skills/voice/) | 문서·슬랙·이메일·PDF용 이장훈 말투 | [다운로드](./dist/voice.zip) |
| [demo-recorder](./skills/demo-recorder/) | 웹 앱의 데모 영상을 보기 좋게 녹화(마우스 커서 표시·슬로 모션)하고 UI 클릭 흐름을 검증 | [다운로드](./dist/demo-recorder.zip) |

형식이 서로 다르니 만들려는 결과물로 고르세요. 일반 영문 "one-pager" → `exec-one-pager`. 한국 정부·제안 표 양식 → `gov-one-pager`. 한국어 비즈니스 말투 → `voice`. UI 데모 영상 녹화 또는 클릭 흐름 확인 → `demo-recorder`.

## 시작하기

각 스킬은 [`skills/`](./skills/) 아래의 독립 폴더입니다. 문서 스킬은 별도 빌드가 필요 없습니다. 아래에서 설치 대상을 고른 뒤, 작업이 스킬 설명과 맞을 때 에이전트가 불러오도록 두면 됩니다.

- 브라우저에서 Claude.ai를 쓰나요? 스킬 zip을 업로드하세요([Claude.ai (zip 업로드)](#claudeai-zip-업로드) 참고).
- 코딩 에이전트(Claude Code, Kiro, opencode)를 쓰나요? 에이전트가 인식하는 위치에 스킬 폴더를 두세요([코딩 에이전트](#코딩-에이전트-claude-code-kiro-opencode) 참고).
- `demo-recorder` 스킬을 원하나요? 실제 브라우저를 구동하므로 몇 단계가 더 필요합니다. 해당 스킬의 [SKILL.md](./skills/demo-recorder/SKILL.md)를 참고하세요.

## 사용법

### Claude.ai (zip 업로드)

1. 위 [스킬](#스킬) 표(또는 [`dist/`](./dist/))에서 스킬 zip을 받습니다.
2. [claude.ai](https://claude.com/) → **Settings** → **Capabilities** / **Skills**(문구는 다를 수 있음) → **Upload skill**.
3. `.zip` 파일을 선택합니다.

zip은 Claude.ai가 요구하는 구조(`skill-name/SKILL.md`가 압축 루트)로 이미 맞춰 두었습니다. [Claude에서 스킬 사용하기](https://support.claude.com/en/articles/12512180-using-skills-in-claude)를 참고하세요.

원페이저 스킬로 `.docx`를 만들 때는 Node.js와 `docx`(`npm install docx`)가 필요합니다.

### 코딩 에이전트 (Claude Code, Kiro, opencode)

같은 스킬 폴더가 여러 도구에서 동작하며, 인식 디렉터리만 다릅니다. Claude Code는 `.claude/skills`에 복사합니다:

```bash
mkdir -p .claude/skills
cp -r skills/gov-one-pager skills/exec-one-pager skills/voice .claude/skills/
```

또는 전체 심볼릭 링크:

```bash
ln -s /path/to/claude-skills/skills/* .claude/skills/
```

다른 도구는 각자의 디렉터리에서 읽습니다. Kiro는 `.kiro/skills`, opencode는 `.opencode/skills`를 사용합니다(opencode는 `.claude/skills`와 `.agents/skills`도 읽습니다). `.claude/skills` 대신 해당 도구에 맞는 경로(예: `.kiro/skills`)를 쓰세요. `demo-recorder` 스킬에는 이 위치들에 한 번에 설치하는 크로스툴 설치기가 포함되어 있습니다. 해당 스킬의 [SKILL.md](./skills/demo-recorder/SKILL.md)를 참고하세요.

## 기여하기

새 스킬과 개선 기여를 환영합니다. 스킬을 추가하려면:

1. [`template/`](./template/)를 `skills/<name>/`으로 복사
2. `name` + `description` 작성 (무엇을·언제; Claude.ai용 description은 **200자** 이하)
3. `python scripts/package-skills.py`(또는 `bash scripts/package-skills.sh`)로 `dist/<name>.zip` 갱신
4. 이 README와 [`README.md`](./README.md)의 스킬 표 모두 수정

전체 가이드라인은 [CONTRIBUTING.md](./CONTRIBUTING.md)를 참고하세요. README.md와 README.ko.md를 항상 동기화해야 한다는 규칙도 포함되어 있습니다.

## 링크

- [Agent Skills](https://agentskills.io/)
- [커스텀 스킬 만들기](https://support.claude.com/en/articles/12512198-creating-custom-skills)
- [anthropics/skills](https://github.com/anthropics/skills)

## 라이선스

Copyright 2026 이장훈 (Janghoon Lee). [Apache-2.0](./LICENSE) 라이선스로 배포됩니다.
