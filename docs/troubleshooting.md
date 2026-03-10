# 트러블슈팅

## 문서 사이트 빌드 실패

증상:

- docs workflow에서 `mkdocs build` 실패

점검:

1. `mkdocs.yml`의 `nav` 경로와 실제 파일 경로 일치 여부
2. Markdown 코드블록 fence/표 문법 오류
3. 로컬에서 `mkdocs build --clean` 재현

## Consumer가 메시지를 읽지 못함

점검:

1. `streamKey`, `group`, `consumer` 설정값 확인
2. Redis 연결 정보/권한 확인
3. `XINFO GROUPS <streamKey>`로 group 생성 여부 확인

## PEL이 계속 증가함

점검:

1. 핸들러 예외 로그 확인
2. manual ack 모드에서 `ack()` 누락 여부
3. 종료 시 `stop({ mode: 'drain' })` 적용 여부

대응:

- 멱등성 보장 후 `XAUTOCLAIM`으로 pending 메시지 재처리

## decode 오류가 반복됨

점검:

1. producer payload 포맷(JSON/Protobuf wrapper) 일치 여부
2. `schemaVersion` 호환성 검토
3. 최근 배포 이후 이벤트 스키마 변경 여부

## stop()이 오래 걸림

원인:

- drain 모드에서 in-flight 핸들러가 종료되지 않음

대응:

1. 핸들러 timeout/취소 처리 추가
2. `drainTimeoutMs` 조정
3. 비상 시 `mode: 'immediate'` 사용 (중복 처리 가능성 인지 필요)
