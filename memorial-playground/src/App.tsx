import {ChangeEvent, FormEvent, useEffect, useMemo, useState} from 'react';
import {
  ArrowRight,
  BookHeart,
  CalendarDays,
  Camera,
  ChevronLeft,
  Heart,
  ImagePlus,
  MessageCircleHeart,
  PencilLine,
  PawPrint,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import profileData from './data/profile.json';

type PetProfile = typeof profileData.pet_profile;

type DiaryEntry = {
  entry_id: number;
  date: string;
  title: string;
  content: string;
  photo_url: string | null;
  created_at?: string;
};

type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

type DiaryEntryDraft = {
  date: string;
  title: string;
  content: string;
  photo_url: string | null;
};

type MemorialChatResponse = {
  status: 'ok' | 'blocked';
  response: string;
  reason: string;
  memory_hits: Array<{
    entry_id: number;
    date: string;
    title: string;
  }>;
  supervised: boolean;
  guardrail_result: 'allow' | 'block';
  matched_rules: string[];
  history_summary_saved: boolean;
  history_memory_hits: Array<{
    memory_id: number;
    summary: string;
    keywords: string[];
  }>;
};

type MemorialPhotoEntry = {
  photo_id: number;
  photo_url: string;
  created_at?: string;
};

type GalleryItem = {
  key: string;
  photo_url: string;
  kind: 'uploaded' | 'diary' | 'sample';
  photo_id?: number;
};

const MEMORIAL_LINES = [
  '사진 한 장 한 장이 초코와 함께한 시간을 천천히 되돌려줘요.',
  '주인님과의 행복했던 시간을 추억하며 언제나 행복하기를 바라고 있답니다.',
  '기록이 쌓일수록 초코가 떠올릴 수 있는 기억도 조금씩 더 풍성해져요.',
];

const INITIAL_FORM = {
  date: new Date().toISOString().slice(0, 10),
  title: '',
  content: '',
};

const MEMORIAL_SESSION_STORAGE_KEY = 'walwal_memorial_session_id';

function normalizeProfile(input: Partial<PetProfile> | undefined): PetProfile {
  const fallback = profileData.pet_profile;

  return {
    ...fallback,
    ...input,
    characteristics: {
      ...fallback.characteristics,
      ...(input?.characteristics ?? {}),
      personality:
        input?.characteristics?.personality ??
        input?.characteristics?.activity_level ??
        fallback.characteristics.personality,
    },
    health_records: {
      ...fallback.health_records,
      ...(input?.health_records ?? {}),
      allergies: input?.health_records?.allergies ?? fallback.health_records.allergies,
    },
    preferences: {
      ...fallback.preferences,
      ...(input?.preferences ?? {}),
      favorite_food: input?.preferences?.favorite_food ?? fallback.preferences.favorite_food,
      fears: input?.preferences?.fears ?? fallback.preferences.fears,
    },
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('이미지 데이터를 읽지 못했습니다.'));
    };
    reader.onerror = () => reject(new Error('이미지 파일을 불러오는 중 오류가 발생했습니다.'));
    reader.readAsDataURL(file);
  });
}

export default function App() {
  const initialSessionId =
    typeof window !== 'undefined'
      ? window.localStorage.getItem(MEMORIAL_SESSION_STORAGE_KEY) || crypto.randomUUID()
      : 'memorial-session';
  const [profile, setProfile] = useState<PetProfile>(normalizeProfile(profileData.pet_profile));
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [page, setPage] = useState<'loading' | 'diary' | 'diary-all' | 'memorial'>('loading');
  const [form, setForm] = useState(INITIAL_FORM);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [memorialPhotos, setMemorialPhotos] = useState<MemorialPhotoEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [chatOpened, setChatOpened] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {role: 'assistant', content: '오늘도 보고 싶었어. 천천히 이야기 걸어줘.'},
  ]);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatMeta, setChatMeta] = useState<string | null>(null);
  const [isChatSubmitting, setIsChatSubmitting] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<DiaryEntry | null>(null);
  const [entryDraft, setEntryDraft] = useState<DiaryEntryDraft | null>(null);
  const [entryError, setEntryError] = useState<string | null>(null);
  const [isEditingEntry, setIsEditingEntry] = useState(false);
  const [isEntrySaving, setIsEntrySaving] = useState(false);
  const [isEntryDeleting, setIsEntryDeleting] = useState(false);
  const [isMemorialPhotoUploading, setIsMemorialPhotoUploading] = useState(false);
  const [memorialPhotoError, setMemorialPhotoError] = useState<string | null>(null);
  const [selectedMemorialPhoto, setSelectedMemorialPhoto] = useState<MemorialPhotoEntry | null>(null);
  const [isMemorialPhotoSaving, setIsMemorialPhotoSaving] = useState(false);
  const [isMemorialPhotoDeleting, setIsMemorialPhotoDeleting] = useState(false);
  const [sessionId, setSessionId] = useState(initialSessionId);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(MEMORIAL_SESSION_STORAGE_KEY, sessionId);
  }, [sessionId]);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const [profileResponse, diaryResponse, memorialResponse] = await Promise.all([
          fetch('/api/pet-profile'),
          fetch('/api/diary-entries'),
          fetch('/api/memorial-photos'),
        ]);

        if (!profileResponse.ok || !diaryResponse.ok || !memorialResponse.ok) {
          throw new Error('백엔드 데이터를 불러오지 못했습니다.');
        }

        const nextProfile = normalizeProfile((await profileResponse.json()).pet_profile as Partial<PetProfile>);
        const diaryPayload = (await diaryResponse.json()) as {entries: DiaryEntry[]};
        const memorialPhotoPayload = (await memorialResponse.json()) as {
          entries: MemorialPhotoEntry[];
        };

        if (!isMounted) return;
        setProfile(nextProfile);
        setEntries(diaryPayload.entries ?? []);
        setMemorialPhotos(memorialPhotoPayload.entries ?? []);
        setPage(nextProfile.alive_state ? 'diary' : 'memorial');
        if (!nextProfile.alive_state) {
          setChatOpened(true);
        }
      } catch (loadError) {
        if (!isMounted) return;
        setError(loadError instanceof Error ? loadError.message : '데이터 로드 중 오류가 발생했습니다.');
      }
    };

    void loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const recentEntries = useMemo(() => entries.slice(0, 6), [entries]);
  const galleryItems = useMemo<GalleryItem[]>(() => {
    const uploadedMemorialPhotos = memorialPhotos
      .filter((entry) => Boolean(entry.photo_url))
      .map((entry) => ({
        key: `uploaded-${entry.photo_id}`,
        photo_url: entry.photo_url,
        kind: 'uploaded' as const,
        photo_id: entry.photo_id,
      }));
    const diaryPhotos = entries
      .map((entry) => entry.photo_url)
      .filter((value): value is string => Boolean(value))
      .slice(0, 4)
      .map((photoUrl, index) => ({
        key: `diary-${index}-${photoUrl.slice(0, 16)}`,
        photo_url: photoUrl,
        kind: 'diary' as const,
      }));

    return [...uploadedMemorialPhotos, ...diaryPhotos].slice(0, 6);
  }, [entries, memorialPhotos]);

  const handleInputChange = (field: keyof typeof INITIAL_FORM) => (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setForm((prev) => ({...prev, [field]: event.target.value}));
  };

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;

    void (async () => {
      if (!file) {
        setPhotoPreview(null);
        return;
      }

      try {
        const nextPreview = await readFileAsDataUrl(file);
        setPhotoPreview(nextPreview);
        setError(null);
      } catch (photoError) {
        setPhotoPreview(null);
        setError(photoError instanceof Error ? photoError.message : '사진을 불러오지 못했습니다.');
      }
    })();
  };

  const handleDiarySubmit = (event: FormEvent) => {
    void (async () => {
      event.preventDefault();

      if (!form.title.trim() || !form.content.trim()) {
        setError('제목과 오늘의 이야기를 입력해 주세요.');
        return;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        const response = await fetch('/api/diary-entries', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pet_id: profile.id,
            date: form.date,
            title: form.title,
            content: form.content,
            photo_url: photoPreview,
          }),
        });

        if (!response.ok) {
          throw new Error('육성일지를 저장하지 못했습니다.');
        }

        const newEntry = (await response.json()) as DiaryEntry;
        setEntries((prev) => [newEntry, ...prev]);
        setForm({...INITIAL_FORM, date: form.date});
        setPhotoPreview(null);
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : '저장 중 오류가 발생했습니다.');
      } finally {
        setIsSubmitting(false);
      }
    })();
  };

  const handleMemorialPhotoUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;

    void (async () => {
      if (!file || isMemorialPhotoUploading) {
        return;
      }

      setIsMemorialPhotoUploading(true);
      setMemorialPhotoError(null);

      try {
        const photoUrl = await readFileAsDataUrl(file);
        const response = await fetch('/api/memorial-photos', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pet_id: profile.id,
            photo_url: photoUrl,
          }),
        });

        const payload = (await response.json()) as MemorialPhotoEntry | {detail?: string};
        if (!response.ok) {
          throw new Error('detail' in payload && payload.detail ? payload.detail : '추모 사진을 저장하지 못했습니다.');
        }

        setMemorialPhotos((prev) => [payload as MemorialPhotoEntry, ...prev]);
      } catch (uploadError) {
        setMemorialPhotoError(
          uploadError instanceof Error ? uploadError.message : '추모 사진 업로드 중 오류가 발생했습니다.',
        );
      } finally {
        setIsMemorialPhotoUploading(false);
        event.target.value = '';
      }
    })();
  };

  const openMemorialPhotoManager = (item: GalleryItem) => {
    if (item.kind !== 'uploaded' || !item.photo_id) {
      return;
    }

    const target = memorialPhotos.find((entry) => entry.photo_id === item.photo_id) ?? null;
    setSelectedMemorialPhoto(target);
    setMemorialPhotoError(null);
  };

  const closeMemorialPhotoManager = () => {
    setSelectedMemorialPhoto(null);
    setMemorialPhotoError(null);
  };

  const handleMemorialPhotoReplace = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;

    void (async () => {
      if (!file || !selectedMemorialPhoto || isMemorialPhotoSaving) {
        return;
      }

      setIsMemorialPhotoSaving(true);
      setMemorialPhotoError(null);

      try {
        const nextPhotoUrl = await readFileAsDataUrl(file);
        const response = await fetch(`/api/memorial-photos/${selectedMemorialPhoto.photo_id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pet_id: profile.id,
            photo_url: nextPhotoUrl,
          }),
        });

        const payload = (await response.json()) as MemorialPhotoEntry | {detail?: string};
        if (!response.ok) {
          throw new Error('detail' in payload && payload.detail ? payload.detail : '추모 사진을 수정하지 못했습니다.');
        }

        const updatedPhoto = payload as MemorialPhotoEntry;
        setMemorialPhotos((prev) => prev.map((item) => (item.photo_id === updatedPhoto.photo_id ? updatedPhoto : item)));
        setSelectedMemorialPhoto(updatedPhoto);
      } catch (replaceError) {
        setMemorialPhotoError(
          replaceError instanceof Error ? replaceError.message : '추모 사진 수정 중 오류가 발생했습니다.',
        );
      } finally {
        setIsMemorialPhotoSaving(false);
        event.target.value = '';
      }
    })();
  };

  const handleMemorialPhotoDelete = () => {
    if (!selectedMemorialPhoto || isMemorialPhotoDeleting) {
      return;
    }

    const targetPhoto = selectedMemorialPhoto;
    void (async () => {
      setIsMemorialPhotoDeleting(true);
      setMemorialPhotoError(null);

      try {
        const response = await fetch(`/api/memorial-photos/${targetPhoto.photo_id}`, {
          method: 'DELETE',
        });
        const payload = (await response.json()) as {deleted?: boolean; detail?: string};
        if (!response.ok) {
          throw new Error(payload.detail || '추모 사진을 삭제하지 못했습니다.');
        }

        setMemorialPhotos((prev) => prev.filter((item) => item.photo_id !== targetPhoto.photo_id));
        closeMemorialPhotoManager();
      } catch (deleteError) {
        setMemorialPhotoError(
          deleteError instanceof Error ? deleteError.message : '추모 사진 삭제 중 오류가 발생했습니다.',
        );
      } finally {
        setIsMemorialPhotoDeleting(false);
      }
    })();
  };

  useEffect(() => {
    if (!selectedEntry) {
      return;
    }

    const nextSelectedEntry = entries.find((entry) => entry.entry_id === selectedEntry.entry_id) ?? null;
    setSelectedEntry(nextSelectedEntry);
    if (!nextSelectedEntry) {
      setIsEditingEntry(false);
      setEntryDraft(null);
      setEntryError(null);
    }
  }, [entries, selectedEntry]);

  const openEntryDetail = (entry: DiaryEntry) => {
    setSelectedEntry(entry);
    setEntryDraft({
      date: entry.date,
      title: entry.title,
      content: entry.content,
      photo_url: entry.photo_url,
    });
    setIsEditingEntry(false);
    setEntryError(null);
  };

  const closeEntryDetail = () => {
    setSelectedEntry(null);
    setEntryDraft(null);
    setIsEditingEntry(false);
    setEntryError(null);
  };

  const startEntryEdit = () => {
    if (!selectedEntry) {
      return;
    }
    setEntryDraft({
      date: selectedEntry.date,
      title: selectedEntry.title,
      content: selectedEntry.content,
      photo_url: selectedEntry.photo_url,
    });
    setIsEditingEntry(true);
    setEntryError(null);
  };

  const handleEntryDraftChange = (field: keyof DiaryEntryDraft) => (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setEntryDraft((prev) => (prev ? {...prev, [field]: event.target.value} : prev));
  };

  const handleEntryDraftPhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;

    void (async () => {
      if (!file) {
        return;
      }

      try {
        const nextPhoto = await readFileAsDataUrl(file);
        setEntryDraft((prev) => (prev ? {...prev, photo_url: nextPhoto} : prev));
        setEntryError(null);
      } catch (photoError) {
        setEntryError(photoError instanceof Error ? photoError.message : '사진을 불러오지 못했습니다.');
      }
    })();
  };

  const clearEntryDraftPhoto = () => {
    setEntryDraft((prev) => (prev ? {...prev, photo_url: null} : prev));
  };

  const handleEntrySave = () => {
    if (!selectedEntry || !entryDraft || isEntrySaving) {
      return;
    }

    void (async () => {
      if (!entryDraft.title.trim() || !entryDraft.content.trim()) {
        setEntryError('제목과 오늘의 이야기를 입력해 주세요.');
        return;
      }

      setIsEntrySaving(true);
      setEntryError(null);

      try {
        const response = await fetch(`/api/diary-entries/${selectedEntry.entry_id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pet_id: profile.id,
            date: entryDraft.date,
            title: entryDraft.title,
            content: entryDraft.content,
            photo_url: entryDraft.photo_url,
          }),
        });

        const payload = (await response.json()) as DiaryEntry | {detail?: string};
        if (!response.ok) {
          throw new Error('detail' in payload && payload.detail ? payload.detail : '육성일지를 수정하지 못했습니다.');
        }

        const updatedEntry = payload as DiaryEntry;
        setEntries((prev) => prev.map((entry) => (entry.entry_id === updatedEntry.entry_id ? updatedEntry : entry)));
        setSelectedEntry(updatedEntry);
        setEntryDraft({
          date: updatedEntry.date,
          title: updatedEntry.title,
          content: updatedEntry.content,
          photo_url: updatedEntry.photo_url,
        });
        setIsEditingEntry(false);
      } catch (saveError) {
        setEntryError(saveError instanceof Error ? saveError.message : '수정 중 오류가 발생했습니다.');
      } finally {
        setIsEntrySaving(false);
      }
    })();
  };

  const handleEntryDelete = () => {
    if (!selectedEntry || isEntryDeleting) {
      return;
    }

    const entryToDelete = selectedEntry;
    void (async () => {
      setIsEntryDeleting(true);
      setEntryError(null);

      try {
        const response = await fetch(`/api/diary-entries/${entryToDelete.entry_id}`, {
          method: 'DELETE',
        });

        const payload = (await response.json()) as {deleted?: boolean; detail?: string};
        if (!response.ok) {
          throw new Error(payload.detail || '육성일지를 삭제하지 못했습니다.');
        }

        setEntries((prev) => prev.filter((entry) => entry.entry_id !== entryToDelete.entry_id));
        closeEntryDetail();
      } catch (deleteError) {
        setEntryError(deleteError instanceof Error ? deleteError.message : '삭제 중 오류가 발생했습니다.');
      } finally {
        setIsEntryDeleting(false);
      }
    })();
  };

  const handleMemorialChatSubmit = (event: FormEvent) => {
    event.preventDefault();

    void (async () => {
      const trimmedInput = chatInput.trim();
      if (!trimmedInput || isChatSubmitting) {
        return;
      }

      const nextUserMessage: ChatMessage = {role: 'user', content: trimmedInput};
      const history = chatMessages
        .filter((message): message is Extract<ChatMessage, {role: 'user' | 'assistant'}> => message.role !== 'system')
        .map((message) => ({role: message.role, content: message.content}));

      setChatMessages((prev) => [...prev, nextUserMessage]);
      setChatInput('');
      setChatError(null);
      setChatMeta(null);
      setIsChatSubmitting(true);

      try {
        const response = await fetch('/api/memorial-chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pet_id: profile.id,
            session_id: sessionId,
            message: trimmedInput,
            history,
          }),
        });

        const payload = (await response.json()) as MemorialChatResponse | {detail?: string};
        if (!response.ok) {
          throw new Error('detail' in payload && payload.detail ? payload.detail : '추모 대화를 불러오지 못했습니다.');
        }

        const chatPayload = payload as MemorialChatResponse;
        setChatMessages((prev) => [...prev, {role: 'assistant', content: chatPayload.response}]);

        if (chatPayload.status === 'blocked' || chatPayload.guardrail_result === 'block') {
          setChatMeta('추억이나 네 마음을 조금 더 편안한 말로 들려주면 내가 더 잘 귀 기울일 수 있어.');
          return;
        }

        const metaParts: string[] = [];
        if (chatPayload.memory_hits.length) {
          metaParts.push(`참조한 기억: ${chatPayload.memory_hits.map((item) => item.title).join(', ')}`);
        } else {
          metaParts.push('이번 답변에서는 뚜렷한 기억 제목이 잡히지 않았어요.');
        }
        if (chatPayload.history_summary_saved) {
          metaParts.push('이번 대화가 기억으로 남았어요.');
        } else if (chatPayload.history_memory_hits.length) {
          metaParts.push('예전 대화 기억도 함께 참고했어요.');
        }
        setChatMeta(metaParts.join(' '));
      } catch (submitError) {
        const message = submitError instanceof Error ? submitError.message : '대화 중 오류가 발생했습니다.';
        setChatError(message);
        setChatMessages((prev) => [
          ...prev,
          {role: 'system', content: '지금은 초코의 목소리를 안정적으로 불러오지 못했어요. 잠시 뒤 다시 이야기해 주세요.'},
        ]);
      } finally {
        setIsChatSubmitting(false);
      }
    })();
  };

  if (page === 'loading') {
    return (
      <div className="page-shell diary-shell">
        <div className="status-card">
          <p className="eyebrow">Loading</p>
          <h1>서버와 연결 중이에요.</h1>
          <p className="soft-copy">FastAPI 서버가 켜져 있는지 확인해 주세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={page === 'memorial' ? 'page-shell memorial-shell' : 'page-shell diary-shell'}>
      {page === 'diary' ? (
        <section className="diary-layout">
          <aside className="profile-panel">
            <div className="profile-badge">
              <PawPrint size={18} />
              <span>{profile.alive_state ? '현재 함께하는 시간' : '추모 상태'}</span>
            </div>
            <div className="profile-card">
              <p className="eyebrow">Life Track Diary</p>
              <h1>{profile.name}의 오늘</h1>
              <p className="soft-copy">
                사랑하는 반려견의 하루를 자유롭게 기록하는 공간입니다.
              </p>
              <div className="profile-meta">
                <span>{profile.breed}</span>
                <span>{profile.birth_date}</span>
                <span>{profile.gender}</span>
              </div>
              <div className="button-stack">
                <button type="button" className="memorial-link" onClick={() => setPage('memorial')}>
                  추모 페이지로 이동
                  <ArrowRight size={16} />
                </button>
                <button type="button" className="memorial-link" onClick={() => setPage('diary-all')}>
                  전체 육성일지 보기
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>

            <div className="recent-story-card">
              <div className="card-title-row">
                <BookHeart size={18} />
                <h2>최근 기록</h2>
              </div>
              <div className="recent-story-list">
                {recentEntries.slice(0, 3).map((entry) => (
                  <button
                    key={entry.entry_id}
                    type="button"
                    className="mini-story-card mini-story-button"
                    onClick={() => openEntryDetail(entry)}
                  >
                    <p className="story-date">{entry.date}</p>
                    <strong>{entry.title}</strong>
                    <p>{entry.content.slice(0, 72)}...</p>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <main className="diary-main">
            <div className="editor-card">
              <div className="card-title-row">
                <CalendarDays size={18} />
                <h2>육성일지 작성</h2>
              </div>
              <form className="diary-form" onSubmit={handleDiarySubmit}>
                <label>
                  날짜
                  <input type="date" value={form.date} onChange={handleInputChange('date')} />
                </label>
                <label>
                  제목
                  <input
                    type="text"
                    placeholder="예: 오늘은 산책이 유난히 길었던 날"
                    value={form.title}
                    onChange={handleInputChange('title')}
                  />
                </label>
                <label>
                  오늘의 이야기
                  <textarea
                    rows={7}
                    placeholder="오늘 초코와 함께한 순간을 자유롭게 적어보세요."
                    value={form.content}
                    onChange={handleInputChange('content')}
                  />
                </label>

                <div className="photo-picker">
                  <div>
                    <p className="photo-title">사진 첨부</p>
                    <p className="soft-copy">선택 사항이에요. 지금은 브라우저 미리보기 기준으로만 동작해요.</p>
                  </div>
                  <label className="upload-button">
                    <ImagePlus size={18} />
                    사진 선택
                    <input type="file" accept="image/*" onChange={handlePhotoChange} />
                  </label>
                </div>

                {photoPreview ? (
                  <div className="photo-preview">
                    <img src={photoPreview} alt="업로드 미리보기" />
                  </div>
                ) : (
                  <div className="photo-placeholder">
                    <Camera size={18} />
                    아직 첨부된 사진이 없어요.
                  </div>
                )}

                {error ? <p className="form-error">{error}</p> : null}

                <button type="submit" className="primary-button" disabled={isSubmitting}>
                  {isSubmitting ? '저장 중...' : '육성일지 저장하기'}
                </button>
              </form>
            </div>

            <div className="timeline-grid">
              {recentEntries.map((entry) => (
                <button
                  key={entry.entry_id}
                  type="button"
                  className="timeline-card timeline-button"
                  onClick={() => openEntryDetail(entry)}
                >
                  {entry.photo_url ? (
                    <div className="timeline-media">
                      <img src={entry.photo_url} alt={entry.title} className="timeline-photo" />
                      <div className="timeline-media-overlay">
                        <span>{entry.date}</span>
                        <strong>{entry.title}</strong>
                      </div>
                    </div>
                  ) : (
                    <div className="timeline-text-preview">
                      <div className="timeline-header">
                        <span>{entry.date}</span>
                        <Sparkles size={14} />
                      </div>
                      <h3>{entry.title}</h3>
                      <p>{entry.content.slice(0, 110)}{entry.content.length > 110 ? '...' : ''}</p>
                    </div>
                  )}
                  {entry.photo_url ? (
                    <div className="timeline-body">
                      <p>{entry.content.slice(0, 88)}{entry.content.length > 88 ? '...' : ''}</p>
                    </div>
                  ) : null}
                </button>
              ))}
            </div>
          </main>
        </section>
      ) : page === 'diary-all' ? (
        <section className="diary-all-layout">
          <header className="diary-all-header">
            <div>
              <p className="eyebrow">All Diary Entries</p>
              <h1>전체 육성일지</h1>
              <p className="soft-copy">최신 기록부터 전체 육성일지를 확인하고, 각 기록을 눌러 상세 보기와 수정, 삭제를 이어서 할 수 있어요.</p>
            </div>
            <button type="button" className="ghost-plain-button" onClick={() => setPage('diary')}>
              <ChevronLeft size={16} />
              육성일지 메인으로 돌아가기
            </button>
          </header>

          <div className="diary-all-summary">
            <span>총 {entries.length}개 기록</span>
            <span>정렬: 최신순</span>
          </div>

          <div className="timeline-grid diary-all-grid">
            {entries.map((entry) => (
              <button
                key={entry.entry_id}
                type="button"
                className="timeline-card timeline-button"
                onClick={() => openEntryDetail(entry)}
              >
                {entry.photo_url ? (
                  <div className="timeline-media">
                    <img src={entry.photo_url} alt={entry.title} className="timeline-photo" />
                    <div className="timeline-media-overlay">
                      <span>{entry.date}</span>
                      <strong>{entry.title}</strong>
                    </div>
                  </div>
                ) : (
                  <div className="timeline-text-preview">
                    <div className="timeline-header">
                      <span>{entry.date}</span>
                      <Sparkles size={14} />
                    </div>
                    <h3>{entry.title}</h3>
                    <p>
                      {entry.content.slice(0, 110)}
                      {entry.content.length > 110 ? '...' : ''}
                    </p>
                  </div>
                )}
                {entry.photo_url ? (
                  <div className="timeline-body">
                    <p>
                      {entry.content.slice(0, 88)}
                      {entry.content.length > 88 ? '...' : ''}
                    </p>
                  </div>
                ) : null}
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section className="memorial-layout">
          <header className="memorial-hero">
            <div className="memorial-copy">
              <p className="eyebrow">Memory Garden</p>
              <h1>{profile.name}를 기억하는 페이지</h1>
              <p className="soft-copy">사랑스러운 우리 아이의 모습을 담은 공간입니다.</p>
              <div className="memorial-upload-row">
                <label className="upload-button memorial-upload-button">
                  <ImagePlus size={18} />
                  {isMemorialPhotoUploading ? '사진 업로드 중...' : '추모 사진 올리기'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleMemorialPhotoUpload}
                    disabled={isMemorialPhotoUploading}
                  />
                </label>
                <p className="soft-copy memorial-upload-copy">추모 페이지에 남기고 싶은 초코 사진을 직접 추가할 수 있어요.</p>
              </div>
              {memorialPhotoError ? <p className="form-error">{memorialPhotoError}</p> : null}
            </div>
            {profile.alive_state ? (
              <button type="button" className="ghost-button" onClick={() => setPage('diary')}>
                <ChevronLeft size={16} />
                육성일지로 돌아가기
              </button>
            ) : null}
          </header>

          <div className="memorial-gallery">
            {galleryItems.map((item, index) => (
              <button
                key={item.key}
                type="button"
                className={`gallery-tile gallery-${(index % 4) + 1} gallery-button ${
                  item.kind === 'uploaded' ? 'gallery-uploaded' : ''
                }`}
                onClick={() => openMemorialPhotoManager(item)}
              >
                <img src={item.photo_url} alt={`${profile.name} 추모 사진 ${index + 1}`} />
              </button>
            ))}
          </div>

          <div className="memory-note-row">
            {MEMORIAL_LINES.map((line) => (
              <article key={line} className="memory-note">
                <Heart size={16} />
                <p>{line}</p>
              </article>
            ))}
          </div>

          <section className="chat-shell">
            <div className="chat-shell-header">
              <div>
                <p className="eyebrow">Memorial Chat</p>
                <h2>{profile.name}와 다시 이야기하기</h2>
              </div>
              <button type="button" className="primary-button" onClick={() => setChatOpened((prev) => !prev)}>
                <MessageCircleHeart size={18} />
                {chatOpened ? '닫기' : '대화 시작'}
              </button>
            </div>

            {chatOpened ? (
              <div className="chat-placeholder">
                <div className="chat-message-list">
                  {chatMessages.map((message, index) => (
                    <div
                      key={`${message.role}-${index}`}
                      className={`chat-bubble ${
                        message.role === 'user' ? 'right' : message.role === 'system' ? 'system' : 'left'
                      }`}
                    >
                      {message.content}
                    </div>
                  ))}
                </div>
                <form className="chat-input-shell" onSubmit={handleMemorialChatSubmit}>
                  <input
                    type="text"
                    placeholder="추억을 담아 초코에게 말을 걸어보세요."
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                  />
                  <button type="submit" disabled={isChatSubmitting || !chatInput.trim()}>
                    {isChatSubmitting ? '대답을 생각하는 중...' : '보내기'}
                  </button>
                </form>
                {chatError ? <p className="form-error">{chatError}</p> : null}
              </div>
            ) : (
              <div className="chat-closed-panel">
                사진과 기록을 먼저 둘러본 뒤, 준비가 되면 대화를 시작할 수 있어요.
              </div>
            )}
          </section>
        </section>
      )}

      {selectedEntry && entryDraft ? (
        <div className="entry-modal-backdrop" onClick={closeEntryDetail}>
          <section className="entry-modal" onClick={(event) => event.stopPropagation()}>
            <div className="entry-modal-header">
              <div>
                <p className="eyebrow">Diary Detail</p>
                <h2>{isEditingEntry ? '육성일지 수정' : selectedEntry.title}</h2>
              </div>
              <button type="button" className="icon-button" onClick={closeEntryDetail} aria-label="상세 보기 닫기">
                <X size={18} />
              </button>
            </div>

            {isEditingEntry ? (
              <div className="entry-modal-body">
                <div className="entry-form-grid">
                  <label>
                    날짜
                    <input type="date" value={entryDraft.date} onChange={handleEntryDraftChange('date')} />
                  </label>
                  <label>
                    제목
                    <input type="text" value={entryDraft.title} onChange={handleEntryDraftChange('title')} />
                  </label>
                  <label className="entry-detail-full">
                    오늘의 이야기
                    <textarea rows={8} value={entryDraft.content} onChange={handleEntryDraftChange('content')} />
                  </label>
                </div>

                <div className="detail-photo-actions">
                  <label className="upload-button">
                    <ImagePlus size={18} />
                    사진 교체
                    <input type="file" accept="image/*" onChange={handleEntryDraftPhotoChange} />
                  </label>
                  <button type="button" className="soft-button" onClick={clearEntryDraftPhoto}>
                    사진 제거
                  </button>
                </div>

                {entryDraft.photo_url ? (
                  <div className="entry-detail-photo">
                    <img src={entryDraft.photo_url} alt={entryDraft.title} />
                  </div>
                ) : (
                  <div className="photo-placeholder">
                    <Camera size={18} />
                    아직 첨부된 사진이 없어요.
                  </div>
                )}

                {entryError ? <p className="form-error">{entryError}</p> : null}

                <div className="entry-action-row">
                  <button type="button" className="ghost-plain-button" onClick={() => setIsEditingEntry(false)}>
                    취소
                  </button>
                  <button type="button" className="primary-button" onClick={handleEntrySave} disabled={isEntrySaving}>
                    {isEntrySaving ? '저장 중...' : '수정 저장'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="entry-modal-body">
                <div className="entry-detail-meta">
                  <span>{selectedEntry.date}</span>
                  <span>{selectedEntry.created_at ? '저장된 기록' : '기존 기록'}</span>
                </div>
                {selectedEntry.photo_url ? (
                  <div className="entry-detail-photo">
                    <img src={selectedEntry.photo_url} alt={selectedEntry.title} />
                  </div>
                ) : (
                  <div className="photo-placeholder">
                    <Camera size={18} />
                    첨부된 사진이 없어요.
                  </div>
                )}
                <div className="entry-detail-copy">
                  <h3>{selectedEntry.title}</h3>
                  <p>{selectedEntry.content}</p>
                </div>
                {entryError ? <p className="form-error">{entryError}</p> : null}
                <div className="entry-action-row">
                  <button type="button" className="ghost-plain-button" onClick={startEntryEdit}>
                    <PencilLine size={16} />
                    수정
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={handleEntryDelete}
                    disabled={isEntryDeleting}
                  >
                    <Trash2 size={16} />
                    {isEntryDeleting ? '삭제 중...' : '삭제'}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      ) : null}

      {selectedMemorialPhoto ? (
        <div className="entry-modal-backdrop" onClick={closeMemorialPhotoManager}>
          <section className="entry-modal memorial-photo-modal" onClick={(event) => event.stopPropagation()}>
            <div className="entry-modal-header">
              <div>
                <p className="eyebrow">Memorial Photo</p>
                <h2>추모 사진 관리</h2>
              </div>
              <button type="button" className="icon-button" onClick={closeMemorialPhotoManager} aria-label="추모 사진 관리 닫기">
                <X size={18} />
              </button>
            </div>
            <div className="entry-modal-body">
              <div className="entry-detail-photo">
                <img src={selectedMemorialPhoto.photo_url} alt="업로드한 추모 사진" />
              </div>
              <div className="detail-photo-actions">
                <label className="upload-button memorial-upload-button">
                  <ImagePlus size={18} />
                  {isMemorialPhotoSaving ? '사진 교체 중...' : '사진 교체'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleMemorialPhotoReplace}
                    disabled={isMemorialPhotoSaving}
                  />
                </label>
                <button
                  type="button"
                  className="danger-button"
                  onClick={handleMemorialPhotoDelete}
                  disabled={isMemorialPhotoDeleting}
                >
                  <Trash2 size={16} />
                  {isMemorialPhotoDeleting ? '삭제 중...' : '삭제'}
                </button>
              </div>
              {memorialPhotoError ? <p className="form-error">{memorialPhotoError}</p> : null}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
