# Repository Guidelines

## 프로젝트 구조
이 저장소는 브로커 독립 이벤트 메시징 라이브러리입니다.

- `core/`: 브로커 독립 Port/타입(`ports/`, `types/`, `index.ts`)
- `adapters/redis/`: Redis Streams 어댑터 구현
- `test/`: 소스 구조를 미러링한 테스트(`test/core`, `test/adapters/redis`)
- `docs/`: MkDocs 문서(아키텍처, 사용법, 운영)
- `examples/service-integration/`: 서비스 통합 예시
- `scripts/`: 릴리즈/자동화 스크립트
- `dist/`: 빌드 산출물(수동 수정 금지)

## 빌드, 테스트, 개발 명령어
- `npm ci`: 잠금 파일 기준 의존성 설치
- `npm run build`: CJS/ESM/타입 선언 빌드
- `npm test`: Jest 테스트 실행
- `npm run type-check`: 타입 검사
- `npm run clean`: `dist/` 정리
- `npm run release:patch|minor|major`: 릴리즈 스크립트 실행
- `mkdocs serve`, `mkdocs build --clean`: 문서 로컬 확인/빌드

## 한글 작성 규칙
- 코드 주석, 문서, PR 설명, 이슈 설명은 한글로 작성합니다.
- 커밋 메시지는 한글을 포함해야 합니다.
- 식별자(변수/함수/타입명), 라이브러리 API, import 경로는 기존 영어 관례를 유지합니다.
- 기본 스타일은 기존 코드에 맞춰 2칸 들여쓰기, 세미콜론 미사용을 유지합니다.

## 테스트 규칙
- 프레임워크: `jest` + `ts-jest` (`jest.config.js`)
- 파일명: `*.spec.ts`
- 위치: 테스트 대상 구조를 따라 `test/` 하위에 배치
- 변경 시 정상/예외 경로를 함께 검증하고 `npm test` 통과를 확인합니다.

## 커밋 및 PR 규칙
- 커밋 접두사는 `feat:`, `fix:`, `docs:`, `test:`, `chore:` 권장
- 접두사 뒤 본문은 한글로 작성합니다.
- PR 생성 전 `npm test && npm run build`를 실행합니다.
- PR은 `.github/PULL_REQUEST_TEMPLATE.md` 항목을 모두 작성합니다.
