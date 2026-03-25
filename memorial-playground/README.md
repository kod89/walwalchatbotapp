# WALWAL Memorial Playground

`Dae-hong` 폴더 안에서만 독립 실행되는 추모/육성일지 프론트 프로토타입입니다.

## 실행

### 1. OpenAI API 키 설정

실제 추모 챗봇 응답은 OpenAI API를 사용합니다.

- 권장: 쉘 환경변수로 `OPENAI_API_KEY` 설정
- 대안: `backend/.env` 파일에 `OPENAI_API_KEY=...` 추가
- 실제 키 파일은 저장소에 커밋하지 마세요

샘플은 `backend/.env.example` 에 있습니다.

### 2. 백엔드 실행

```bash
cd /mnt/c/Users/GDH/Desktop/DLthon02/WALWAL/Dae-hong/memorial-playground/backend
uv pip install -r requirements.txt
uv run uvicorn app:app --reload --port 8001
```

### 3. 프론트 실행

```bash
cd /mnt/c/Users/GDH/Desktop/DLthon02/WALWAL/Dae-hong/memorial-playground
npm install
npm run dev
```

브라우저에서 보통 `http://localhost:4173` 으로 열립니다.

## Render 배포

### 프론트 Static Site

- Root Directory: `Dae-hong/memorial-playground`
- Build Command: `npm install && npm run build`
- Publish Directory: `dist`
- 환경변수: `VITE_API_BASE_URL=https://<백엔드-서비스>.onrender.com`

`VITE_API_BASE_URL` 을 비워두면 로컬 개발에서는 Vite `/api` 프록시를 그대로 사용합니다.

### 백엔드 Web Service

- Root Directory: `Dae-hong/memorial-playground/backend`
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn app:app --host 0.0.0.0 --port $PORT`
- 환경변수:
  - `OPENAI_API_KEY`
  - `FRONTEND_ORIGIN=https://<프론트-서비스>.onrender.com`
  - `WALWAL_DATA_DIR=/var/data/walwal`

### Persistent Disk

백엔드는 JSON 파일에 직접 저장하므로 Persistent Disk 연결을 권장합니다.

- Mount Path 예시: `/var/data`
- 앱 환경변수 `WALWAL_DATA_DIR` 값: `/var/data/walwal`

이렇게 설정하면 아래 파일들이 Persistent Disk 아래에 저장됩니다.

- `dog_profile.json`
- `diary.json`
- `diary_embeddings.json`
- `memorial_photos.json`
- `chat_episode_memories.json`

처음 부팅할 때 파일이 없으면 저장소의 기본 JSON 데이터를 복사해 초기화합니다.

## 특징

- 기존 팀 프론트와 분리됨
- 기존 팀 백엔드와도 분리됨
- `Dae-hong/memorial-playground/backend` 의 FastAPI와 연결됨
- 프로필은 공용 `data/dog_profile.json` 을 참조함
- 육성일지는 `backend/data/diary.json` 을 사용함
- 기억 검색용 임베딩 인덱스는 `backend/data/diary_embeddings.json` 에 저장됨
- 육성일지 작성 가능
- 사진 첨부는 data URL 형태로 백엔드 JSON에 저장됨
- 첫 화면은 공용 프로필의 `alive_state` 값으로 결정됨
- `alive_state` 는 현재 UI에서 직접 변경하지 않음
- 추모 페이지 채팅창에서 실제 반려견 챗봇 응답을 확인할 수 있음
- 새 육성일지가 저장되면 기억 검색용 인덱스도 함께 갱신됨
- 추후 일지 데이터가 늘어나도 채팅 요청 시 기억 인덱스를 다시 맞춰 검색함

## 참고

- 데이터 파일:
  - 공용 프로필: `data/dog_profile.json`
  - 기본 육성일지 시드: `backend/data/diary.json`
  - 기본 기억 인덱스 시드: `backend/data/diary_embeddings.json`
- 프론트는 `VITE_API_BASE_URL` 이 비어 있으면 `/api` 요청을 `http://127.0.0.1:8001` 로 프록시합니다.
- 초기 상태로 되돌리고 싶으면 위 JSON 파일을 직접 수정하면 됩니다.
