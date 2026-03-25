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
  PawPrint,
  Sparkles,
} from 'lucide-react';

type PetProfile = {
  id: string;
  name: string;
  breed: string;
  gender: string;
  alive_state: boolean;
  is_neutered: boolean;
  birth_date: string;
  weight_kg: number;
  characteristics: {
    coat_color: string;
    size_category: string;
    activity_level: string[];
  };
  health_records: {
    allergies: string[];
    vaccination_completed: boolean;
    last_medical_check: string;
  };
  preferences: {
    favorite_food: string[];
    fears: string[];
    walking_habit_min: number;
  };
};

type PetProfileResponse = {
  pet_profile: PetProfile;
};

type DiaryEntry = {
  entry_id: number;
  date: string;
  title: string;
  content?: string;
  diary_text?: string;
  photo_url?: string | null;
  created_at?: string;
};

type DiaryResponse = {
  pet_id: string;
  entries: DiaryEntry[];
};

const MEMORIAL_PHOTOS = [
  'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1518717758536-85ae29035b6d?auto=format&fit=crop&w=1200&q=80',
];

const MEMORIAL_LINES = [
  '오늘도 초코를 기억하는 마음이 이곳에 머물러요.',
  '사진 한 장 한 장 속에 초코와 함께한 시간이 남아 있어요.',
  '말보다 먼저 떠오르는 건 늘 초코의 표정과 눈빛이었어요.',
];

const INITIAL_FORM = {
  date: new Date().toISOString().slice(0, 10),
  title: '',
  content: '',
};

function formatDiaryText(entry: DiaryEntry) {
  return entry.content ?? entry.diary_text ?? '';
}

export default function MemorialPrototypeApp() {
  const [profile, setProfile] = useState<PetProfile | null>(null);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [page, setPage] = useState<'loading' | 'diary' | 'memorial'>('loading');
  const [form, setForm] = useState(INITIAL_FORM);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatOpened, setChatOpened] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const [profileResponse, diaryResponse] = await Promise.all([
          fetch('/api/pet-profile'),
          fetch('/api/diary-entries'),
        ]);

        if (!profileResponse.ok || !diaryResponse.ok) {
          throw new Error('데이터를 불러오지 못했습니다.');
        }

        const profileData = (await profileResponse.json()) as PetProfileResponse;
        const diaryData = (await diaryResponse.json()) as DiaryResponse;

        if (!isMounted) return;

        setProfile(profileData.pet_profile);
        setEntries(diaryData.entries ?? []);
        setPage(profileData.pet_profile.alive_state ? 'diary' : 'memorial');
      } catch (loadError) {
        if (!isMounted) return;
        setError(loadError instanceof Error ? loadError.message : '알 수 없는 오류가 발생했습니다.');
      }
    };

    void loadData();

    return () => {
      isMounted = false;
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  const recentEntries = useMemo(() => entries.slice(0, 6), [entries]);
  const galleryPhotos = useMemo(() => {
    const diaryPhotos = entries
      .map((entry) => entry.photo_url)
      .filter((value): value is string => Boolean(value))
      .slice(0, 4);

    return [...diaryPhotos, ...MEMORIAL_PHOTOS].slice(0, 6);
  }, [entries]);

  const handleInputChange = (field: keyof typeof INITIAL_FORM) => (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setForm((prev) => ({...prev, [field]: event.target.value}));
  };

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedPhoto(file);

    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }

    if (file) {
      setPhotoPreview(URL.createObjectURL(file));
      return;
    }

    setPhotoPreview(null);
  };

  const handleDiarySubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!profile) return;
    if (!form.title.trim() || !form.content.trim()) {
      setError('제목과 오늘의 이야기를 입력해 주세요.');
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      const payload = new FormData();
      payload.append('pet_id', profile.id);
      payload.append('date', form.date);
      payload.append('title', form.title);
      payload.append('content', form.content);
      if (selectedPhoto) {
        payload.append('photo', selectedPhoto);
      }

      const response = await fetch('/api/diary-entries', {
        method: 'POST',
        body: payload,
      });

      if (!response.ok) {
        throw new Error('육성일지를 저장하지 못했습니다.');
      }

      const savedEntry = (await response.json()) as DiaryEntry;
      setEntries((prev) => [savedEntry, ...prev]);
      setForm({...INITIAL_FORM, date: form.date});
      setSelectedPhoto(null);
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
      }
      setPhotoPreview(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '저장 중 문제가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  if (error && !profile) {
    return <div>{error}</div>;
  }

  if (!profile || page === 'loading') {
    return <div>loading...</div>;
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
                평범한 하루를 적어두는 공간이에요. 작은 습관과 표정까지 천천히 남겨보세요.
              </p>
              <div className="profile-meta">
                <span>{profile.breed}</span>
                <span>{profile.weight_kg}kg</span>
                <span>{profile.preferences.walking_habit_min}분 산책</span>
              </div>
              <button type="button" className="memorial-link" onClick={() => setPage('memorial')}>
                추모 페이지로 이동
                <ArrowRight size={16} />
              </button>
            </div>

            <div className="recent-story-card">
              <div className="card-title-row">
                <BookHeart size={18} />
                <h2>최근 기록</h2>
              </div>
              <div className="recent-story-list">
                {recentEntries.slice(0, 3).map((entry) => (
                  <article key={entry.entry_id} className="mini-story-card">
                    <p className="story-date">{entry.date}</p>
                    <strong>{entry.title}</strong>
                    <p>{formatDiaryText(entry).slice(0, 72)}...</p>
                  </article>
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
                    <p className="soft-copy">선택 사항이에요. 오늘의 순간을 함께 남겨도 좋아요.</p>
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

                <button type="submit" className="primary-button" disabled={isSaving}>
                  {isSaving ? '저장 중...' : '육성일지 저장하기'}
                </button>
              </form>
            </div>
          </main>
        </section>
      ) : (
        <section className="memorial-layout">
          <header className="memorial-hero">
            <div className="memorial-copy">
              <p className="eyebrow">Memory Garden</p>
              <h1>{profile.name}를 기억하는 페이지</h1>
              <p className="soft-copy">{MEMORIAL_LINES[0]}</p>
              <div className="profile-meta">
                <span>{profile.breed}</span>
                <span>{profile.characteristics.coat_color}</span>
                <span>{profile.preferences.favorite_food.join(', ')}</span>
              </div>
            </div>
            {profile.alive_state ? (
              <button type="button" className="ghost-button" onClick={() => setPage('diary')}>
                <ChevronLeft size={16} />
                육성일지로 돌아가기
              </button>
            ) : null}
          </header>

          <div className="memorial-gallery">
            {galleryPhotos.map((photo, index) => (
              <div key={`${photo}-${index}`} className={`gallery-tile gallery-${(index % 4) + 1}`}>
                <img src={photo} alt={`${profile.name} 추모 사진 ${index + 1}`} />
              </div>
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
                <h2>초코에게 다시 말을 걸어볼 수 있는 자리</h2>
              </div>
              <button type="button" className="primary-button" onClick={() => setChatOpened((prev) => !prev)}>
                <MessageCircleHeart size={18} />
                {chatOpened ? '닫기' : '대화 시작'}
              </button>
            </div>

            {chatOpened ? (
              <div className="chat-placeholder">
                <div className="chat-bubble left">
                  오늘도 보고 싶었어. 천천히 이야기 걸어줘.
                </div>
                <div className="chat-bubble right">초코야, 오늘 네 사진을 한참 보고 있었어.</div>
                <div className="chat-input-shell">
                  <input type="text" placeholder="추억을 담아 초코에게 말을 걸어보세요." disabled />
                  <button type="button" disabled>
                    준비 중
                  </button>
                </div>
              </div>
            ) : (
              <div className="chat-closed-panel">
                사진과 기록을 먼저 둘러본 뒤, 준비가 되면 대화를 시작할 수 있어요.
              </div>
            )}
          </section>
        </section>
      )}
    </div>
  );
}
