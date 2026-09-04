# Agent Skills

오픈소스 [Agent Skills](https://agentskills.io/) 모음입니다. 작업에 맞을 때 호환 에이전트 도구가 불러오는 지침·스크립트 폴더입니다. Agent Skills는 오픈 표준이라 Kiro, Claude Code, opencode 같은 여러 코딩 에이전트에서 사용할 수 있습니다. 일부 스킬은 Claude.ai 업로드 zip으로 제공되며, 스킬별 설치 경로는 아래에 있습니다.

Copyright 2026 이장훈 (Janghoon Lee). **라이선스:** [Apache-2.0](./LICENSE)

[English README](./README.md)

## 스킬

| 스킬 | 이런 때 사용 | Claude.ai zip |
| --- | --- | --- |
| [gov-one-pager](./skills/gov-one-pager/) | 정부지원 사업 요약서 / 추진계획(안) / 1페이지 요약서 | [다운로드](./dist/gov-one-pager.zip) |
| [exec-one-pager](./skills/exec-one-pager/) | 영문 경영·피치·스타트업 원페이저 | [다운로드](./dist/exec-one-pager.zip) |
| [voice](./skills/voice/) | 문서·슬랙·이메일·PDF용 이장훈 말투 | [다운로드](./dist/voice.zip) |
| [demo-recorder](./skills/demo-recorder/) | 웹 앱의 데모 영상을 보기 좋게 녹화(마우스 커서 표시·슬로 모션)하고 UI 클릭 흐름을 검증 | [다운로드](./dist/demo-recorder.zip) |

형식이 다릅니다. 일반 영문 “one-pager” → `exec-one-pager`. 한국 정부·제안 표 양식 → `gov-one-pager`. 한국어 비즈니스 말투 → `voice`. UI 데모 영상 녹화 / 클릭 흐름 확인 → `demo-recorder`.

## 설치

사용하는 도구에 따라 아래 설치 대상 중 하나를 고르세요. Claude.ai에 zip을 업로드하거나, 에이전트가 인식하는 위치(Claude Code, Kiro, opencode)에 스킬 폴더를 두면 됩니다.

### Claude.ai에 설치

1. 위 표(또는 [`dist/`](./dist/))에서 스킬 zip을 받습니다.
2. [claude.ai](https://claude.com/) → **Settings** → **Capabilities** / **Skills** → **Upload skill**.
3. `.zip` 파일을 선택합니다.

zip은 Claude.ai가 요구하는 구조(`skill-name/SKILL.md`가 압축 루트)로 이미 맞춰 두었습니다. [Claude에서 스킬 사용하기](https://support.claude.com/en/articles/12512180-using-skills-in-claude)를 참고하세요.

원페이저 스킬로 `.docx`를 만들 때는 Node.js와 `docx`(`npm install docx`)가 필요합니다.

### 코딩 에이전트에 설치 (Claude Code, Kiro, opencode)

같은 스킬 폴더가 여러 도구에서 동작하며, 인식 디렉터리만 다릅니다. Claude Code는 `.claude/skills`에 복사합니다:

```bash
mkdir -p .claude/skills
cp -r skills/gov-one-pager skills/exec-one-pager skills/voice .claude/skills/
```

또는 전체 심볼릭 링크:

```bash
ln -s /path/to/claude-skills/skills/* .claude/skills/
```

다른 도구는 각자의 디렉터리에서 읽습니다. Kiro는 `.kiro/skills`, opencode는 `.opencode/skills`를 사용합니다(opencode는 `.claude/skills`와 `.agents/skills`도 읽습니다). `.claude/skills` 대신 해당 도구에 맞는 경로(예: `.kiro/skills`)를 쓰세요. `demo-recorder` 스킬에는 이 위치들에 한 번에 설치하는 크로스툴 설치기가 포함되어 있습니다(아래 참고).

## demo-recorder 설치

`demo-recorder`는 실제 브라우저를 구동하므로 폴더 복사 외에 몇 단계가 더 필요합니다.

**사전 준비물:** Node.js 18+ (22 권장). 시스템 `ffmpeg`는 필요 없습니다. 스킬이 `ffmpeg-static`으로 자체 포함합니다.

1. 사용하는 도구가 인식하는 위치에 스킬을 둡니다(하나 선택):

   ```bash
   # Claude Code (프로젝트 로컬)
   mkdir -p .claude/skills
   cp -r skills/demo-recorder .claude/skills/

   # 또는 심볼릭 링크
   ln -s "$(pwd)/skills/demo-recorder" .claude/skills/demo-recorder

   # 또는 내장 크로스툴 설치기 사용 (Kiro / Claude Code / opencode)
   node skills/demo-recorder/scripts/install-skill.mjs            # ./.kiro ./.claude ./.opencode 에 심볼릭 링크
   node skills/demo-recorder/scripts/install-skill.mjs --global   # ~/.kiro ~/.claude ~/.config/opencode 에 설치
   ```

2. 스킬 폴더에서 런타임 의존성을 한 번 설치합니다:

   ```bash
   cd skills/demo-recorder
   npm install
   ```

3. Playwright용 Chromium 브라우저를 한 번 설치합니다:

   ```bash
   npx playwright install chromium
   ```

   브라우저를 공용·사전 프로비저닝 디렉터리에 두는 환경이라면, 새로 내려받지 말고 그 위치를 가리키게 합니다:

   ```bash
   export PLAYWRIGHT_BROWSERS_PATH=/opt/playwright   # 실행 전마다 설정
   ```

4. 데모를 녹화합니다(내장 계산기 예제):

   ```bash
   cd skills/demo-recorder
   node scripts/demo-run.mjs --config examples/calculator/demo.config.json
   node scripts/review.mjs                     # review-report.md 작성, PASS/FAIL 출력
   ```

   명령줄에서 속도를 늦추거나 커서를 숨길 수 있습니다:

   ```bash
   node scripts/demo-run.mjs --config examples/calculator/demo.config.json --slow 1200 --slow-mo 400
   node scripts/demo-run.mjs --config examples/calculator/demo.config.json --no-cursor
   ```

결과 영상은 실행 디렉터리의 `video/` 아래 `demo.mp4`(H.264)이며, `demo.webm`은 원본 녹화로 보관됩니다. 런타임 산출물은 기본적으로 `.demo-recorder/artifacts/`에 저장됩니다(`DEMO_RECORDER_ARTIFACTS_ROOT`로 변경 가능).

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
