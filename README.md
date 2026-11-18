# 모여 — 날짜 조율 프로토타입

HTML, CSS, Vanilla JavaScript만 사용하는 로컬 프로토타입입니다. 서버, DB, Supabase, 회원가입은 사용하지 않습니다.

## 실행

`index.html`을 브라우저에서 열면 됩니다. 또는 프로젝트 폴더에서 `python -m http.server 8000`을 실행한 뒤 `http://localhost:8000`을 엽니다.

일정과 새 모임은 현재 브라우저의 `localStorage`에 저장됩니다. 초대 링크는 모임을 식별하지만, 다른 브라우저나 기기와 실제 일정을 공유하지는 않습니다. 새 모임을 만들면 데모 참여자 대신 빈 새 모임이 표시됩니다.
