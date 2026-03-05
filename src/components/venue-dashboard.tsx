"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useEffectEvent, useMemo, useRef, useState, useTransition } from "react";
import { authClient } from "@/lib/auth/client";
import { VenueCalendar } from "@/components/venue-calendar";
import type { Venue, VenueInput, VenueNote, VenueStatus } from "@/lib/types";

const DynamicVenueMap = dynamic(
  () => import("@/components/venue-map").then((mod) => mod.VenueMap),
  { ssr: false },
);

type VenueDashboardProps = {
  databaseEnabled: boolean;
  googleAuthEnabled: boolean;
  initialMessage?: string | null;
  initialVenues: Venue[];
  initialUserEmail: string | null;
  magicLinkEnabled: boolean;
};

type FormState = VenueInput;
type DetailState = {
  venueId: string;
  name: string;
  address: string;
  event_date: string;
  fee: number;
  status: VenueStatus;
  contact_tel: string;
  contact_fax: string;
  contact_email: string;
  permit_file_path: string | null;
  permit_file_name: string | null;
  conversation_notes: VenueNote[];
};
type AuthMode = "password" | "magic-link";
type CsvConflictMode = "overwrite" | "alternative";
type CsvRowPlan =
  | { kind: "insert"; venue: VenueInput }
  | { kind: "update"; venueId: string; venue: VenueInput }
  | { kind: "skip" };
type PendingCsvImport = {
  rows: VenueInput[];
  currentIndex: number;
  plans: CsvRowPlan[];
  workingVenues: Venue[];
  userId: string;
  userEmail: string;
  conflictMode: CsvConflictMode;
  conflictExisting: Venue | null;
  conflictIncoming: VenueInput | null;
};
type MapFocusState = {
  venueId: string;
  zoom: number;
};
type SpatialPanelMode = "map" | "calendar";

const defaultFormState: FormState = {
  name: "",
  address: "",
  event_date: "",
  fee: 150000,
  status: "candidate",
  lat: 0,
  lng: 0,
  contact_tel: "",
  contact_fax: "",
  contact_email: "",
  permit_file_path: null,
  permit_file_name: null,
  conversation_notes: [],
};

export function VenueDashboard({
  databaseEnabled,
  googleAuthEnabled,
  initialMessage,
  initialVenues,
  initialUserEmail,
  magicLinkEnabled,
}: VenueDashboardProps) {
  const MOBILE_CARD_FOCUS_ZOOM = 12;
  const {
    data: sessionData,
    isPending: sessionPending,
    refetch: refetchSession,
  } = authClient.useSession();
  const currentUser = sessionData?.user ?? null;
  const [venues, setVenues] = useState<Venue[]>(initialVenues);
  const [statusFilter, setStatusFilter] = useState<"all" | VenueStatus>("all");
  const [form, setForm] = useState<FormState>(defaultFormState);
  const [detailState, setDetailState] = useState<DetailState | null>(null);
  const [detailPermitFile, setDetailPermitFile] = useState<File | null>(null);
  const [detailNoteStatement, setDetailNoteStatement] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteStatement, setEditingNoteStatement] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(initialUserEmail);
  const [authMode, setAuthMode] = useState<AuthMode>("password");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [loading, startTransition] = useTransition();
  const [pendingCsvImport, setPendingCsvImport] = useState<PendingCsvImport | null>(null);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [manualMapFocus, setManualMapFocus] = useState<MapFocusState | null>(null);
  const [spatialPanelMode, setSpatialPanelMode] = useState<SpatialPanelMode>("map");
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const timelineItemRefs = useRef<Record<string, HTMLElement | null>>({});
  const isTimelineDraggingRef = useRef(false);
  const timelineDragStartXRef = useRef(0);
  const timelineDragStartScrollLeftRef = useRef(0);
  const [message, setMessage] = useState<string>(
    initialMessage ??
      (initialUserEmail ? `サインイン中: ${initialUserEmail}` : "サインインすると会場一覧を表示します。"),
  );
  const detailAutosaveTimerRef = useRef<number | null>(null);
  const detailSaveInFlightRef = useRef(false);
  const pendingDetailSaveRef = useRef(false);
  const lastSavedDetailFingerprintRef = useRef<string | null>(null);

  useEffect(() => {
    if (sessionPending) {
      return;
    }

    startTransition(() => {
      setUserEmail(currentUser?.email ?? null);
    });
    void syncSessionState(setUserEmail, setVenues, setMessage, databaseEnabled, currentUser);
  }, [currentUser, databaseEnabled, sessionPending, startTransition]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      if (detailAutosaveTimerRef.current) {
        window.clearTimeout(detailAutosaveTimerRef.current);
      }
    };
  }, []);

  const filteredVenues = useMemo(() => {
    return [...venues]
      .filter((venue) => statusFilter === "all" || venue.status === statusFilter)
      .sort((a, b) => a.event_date.localeCompare(b.event_date));
  }, [statusFilter, venues]);
  const [focusedTimelineVenueId, setFocusedTimelineVenueId] = useState<string | null>(
    filteredVenues[0]?.id ?? null,
  );
  const leadingVenue =
    filteredVenues.find((venue) => venue.id === focusedTimelineVenueId) ??
    filteredVenues[0] ??
    null;
  const mapFocusVenue =
    filteredVenues.find((venue) => venue.id === manualMapFocus?.venueId) ?? leadingVenue;
  const mapFocusZoom = manualMapFocus?.zoom ?? 8;
  const selectedVenue =
    detailState ? venues.find((venue) => venue.id === detailState.venueId) ?? null : null;

  useEffect(() => {
    setFocusedTimelineVenueId((current) =>
      current && filteredVenues.some((venue) => venue.id === current)
        ? current
        : (filteredVenues[0]?.id ?? null),
    );
  }, [filteredVenues]);

  useEffect(() => {
    setManualMapFocus((current) =>
      current && filteredVenues.some((venue) => venue.id === current.venueId) ? current : null,
    );
  }, [filteredVenues]);

  const bookedCount = venues.filter((venue) => venue.status === "booked").length;
  const candidateCount = venues.filter((venue) => venue.status === "candidate").length;
  const totalCost = venues.reduce((sum, venue) => sum + venue.fee, 0);
  const autosaveDetailChanges = useEffectEvent(() => {
    void saveVenueDetails({ suppressToast: true });
  });

  useEffect(() => {
    if (!detailState || !selectedVenue) {
      return;
    }

    const nextFingerprint = getDetailFingerprint(detailState, detailPermitFile);

    if (lastSavedDetailFingerprintRef.current === nextFingerprint) {
      return;
    }

    if (detailAutosaveTimerRef.current) {
      window.clearTimeout(detailAutosaveTimerRef.current);
    }

    detailAutosaveTimerRef.current = window.setTimeout(() => {
      autosaveDetailChanges();
    }, 700);

    return () => {
      if (detailAutosaveTimerRef.current) {
        window.clearTimeout(detailAutosaveTimerRef.current);
        detailAutosaveTimerRef.current = null;
      }
    };
  }, [detailPermitFile, detailState, selectedVenue]);

  function getVisibleCommentCount(venue: Venue | DetailState) {
    return venue.conversation_notes.filter((note) => !note.deleted_at).length;
  }

  function isOwnNote(note: VenueNote) {
    if (!userEmail) {
      return false;
    }

    return (note.author_email ?? note.speaker) === userEmail;
  }

  async function signInWithGoogle() {
    if (!googleAuthEnabled) {
      setMessage("Google サインインは環境変数未設定のため無効です。");
      return;
    }

    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: window.location.origin,
    });

    if (error) {
      setMessage(`Google サインイン開始に失敗しました: ${error.message}`);
    }
  }

  async function handleEmailAuthSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!authEmail.trim()) {
      setMessage("メールアドレスを入力してください。");
      return;
    }

    if (authMode === "magic-link") {
      if (!magicLinkEnabled) {
        setMessage("マジックリンクは SMTP 未設定のため無効です。");
        return;
      }

      const { error } = await authClient.signIn.magicLink({
        email: authEmail.trim(),
        callbackURL: window.location.origin,
      });

      if (error) {
        setMessage(`マジックリンク送信に失敗しました: ${error.message}`);
        return;
      }

      setMessage("マジックリンクを送信しました。ローカルでは Mailpit を確認してください。");
      return;
    }

    if (!authPassword) {
      setMessage("パスワードを入力してください。");
      return;
    }

    const signInResult = await authClient.signIn.email({
      email: authEmail.trim(),
      password: authPassword,
    });

    if (!signInResult.error) {
      await refetchSession();
      setMessage("メールアドレスでサインインしました。");
      return;
    }

    const signUpResult = await authClient.signUp.email({
      name: authEmail.trim().split("@")[0] || authEmail.trim(),
      email: authEmail.trim(),
      password: authPassword,
      callbackURL: window.location.origin,
    });

    if (signUpResult.error) {
      setMessage(`メール認証に失敗しました: ${signUpResult.error.message}`);
      return;
    }

    await refetchSession();
    setMessage("ユーザーを作成してサインインしました。");
  }

  async function signOut() {
    const { error: signOutError } = await authClient.signOut();
    if (signOutError) {
      setMessage(`サインアウトに失敗しました: ${signOutError.message}`);
      return;
    }

    await refetchSession();
    setUserEmail(null);
    setVenues([]);
    setMessage("サインアウトしました。");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentUser?.email) {
      setMessage("会場を登録するにはサインインしてください。");
      return;
    }

    const geocoded = await geocodeAddress(form.address);

    if (!geocoded) {
      setMessage("住所から座標を取得できませんでした。住所を確認してください。");
      return;
    }

    const payloadWithCoords = {
      ...form,
      lat: geocoded.lat,
      lng: geocoded.lng,
    };

    try {
      const createdVenue = await createVenueByApi(payloadWithCoords);
      setVenues((current) => [...current, createdVenue]);
      setForm(defaultFormState);
      setIsManageModalOpen(false);
      setMessage("会場を登録しました。");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "会場登録に失敗しました。",
      );
    }
  }

  async function handleCsvImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!currentUser?.email) {
      setMessage("CSV 一括登録を使うにはサインインしてください。");
      event.target.value = "";
      return;
    }

    try {
      const text = await file.text();
      const parsedRows = parseVenueCsv(text);

      if (!parsedRows.length) {
        setMessage("CSV に登録可能な行がありませんでした。");
        return;
      }

      const resolvedVenues: VenueInput[] = [];

      for (const row of parsedRows) {
        const geocoded = await geocodeAddress(row.address);
        if (!geocoded) {
          setMessage(`住所から座標を取得できませんでした: ${row.name}`);
          return;
        }

        resolvedVenues.push({
          ...row,
          lat: geocoded.lat,
          lng: geocoded.lng,
        });
      }
      await queueCsvImportResolution({
        rows: resolvedVenues,
        currentIndex: 0,
        plans: [],
        workingVenues: [...venues],
        userId: currentUser.id,
        userEmail: currentUser.email,
        conflictMode: "overwrite",
        conflictExisting: null,
        conflictIncoming: null,
      });
    } catch (error) {
      setMessage(
        error instanceof Error ? `CSV取込に失敗しました: ${error.message}` : "CSV取込に失敗しました。",
      );
    } finally {
      event.target.value = "";
    }
  }

  async function queueCsvImportResolution(state: PendingCsvImport) {
    for (let index = state.currentIndex; index < state.rows.length; index += 1) {
      const incoming = state.rows[index];
      const existing = state.workingVenues.find(
        (venue) =>
          normalizeVenueKey(venue.name) === normalizeVenueKey(incoming.name) &&
          venue.event_date === incoming.event_date,
      );

      if (existing) {
        setPendingCsvImport({
          ...state,
          currentIndex: index,
          conflictMode: "overwrite",
          conflictExisting: existing,
          conflictIncoming: incoming,
        });
        setMessage(
          `CSV取込で重複候補を検出しました: ${incoming.event_date} / ${incoming.name}`,
        );
        return;
      }

      state = {
        ...state,
        currentIndex: index + 1,
        plans: [...state.plans, { kind: "insert", venue: incoming }],
        workingVenues: [
          ...state.workingVenues,
          {
            id: `csv-preview-${index}-${crypto.randomUUID()}`,
            ...incoming,
            user_id: state.userId,
            editor_email: state.userEmail,
            created_at: new Date().toISOString(),
          },
        ],
      };
    }

    await finalizeCsvImport(state);
  }

  async function resolveCsvConflict(action: "overwrite" | "add" | "skip") {
    if (!pendingCsvImport || !pendingCsvImport.conflictIncoming) {
      return;
    }

    const { conflictExisting, conflictIncoming } = pendingCsvImport;

    if (action === "skip") {
      await queueCsvImportResolution({
        ...pendingCsvImport,
        currentIndex: pendingCsvImport.currentIndex + 1,
        plans: [...pendingCsvImport.plans, { kind: "skip" }],
        conflictMode: "overwrite",
        conflictExisting: null,
        conflictIncoming: null,
      });
      return;
    }

    if (action === "overwrite" && conflictExisting) {
      await queueCsvImportResolution({
        ...pendingCsvImport,
        currentIndex: pendingCsvImport.currentIndex + 1,
        plans: [
          ...pendingCsvImport.plans,
          { kind: "update", venueId: conflictExisting.id, venue: conflictIncoming },
        ],
        workingVenues: pendingCsvImport.workingVenues.map((venue) =>
          venue.id === conflictExisting.id
            ? {
                ...venue,
                ...conflictIncoming,
                editor_email: pendingCsvImport.userEmail,
                updated_at: new Date().toISOString(),
              }
            : venue,
        ),
        conflictMode: "overwrite",
        conflictExisting: null,
        conflictIncoming: null,
      });
      return;
    }

    await queueCsvImportResolution({
      ...pendingCsvImport,
      currentIndex: pendingCsvImport.currentIndex + 1,
      plans: [...pendingCsvImport.plans, { kind: "insert", venue: conflictIncoming }],
      workingVenues: [
        ...pendingCsvImport.workingVenues,
        {
          id: `csv-preview-${pendingCsvImport.currentIndex}-${crypto.randomUUID()}`,
          ...conflictIncoming,
          user_id: pendingCsvImport.userId,
          editor_email: pendingCsvImport.userEmail,
          created_at: new Date().toISOString(),
        },
      ],
      conflictMode: "overwrite",
      conflictExisting: null,
      conflictIncoming: null,
    });
  }

  async function finalizeCsvImport(state: PendingCsvImport) {
    if (!databaseEnabled) {
      setPendingCsvImport(null);
      setMessage("DATABASE_URL が未設定のため、CSV 一括登録を使えません。");
      return;
    }

    const inserts = state.plans.filter((plan) => plan.kind === "insert");
    const updates = state.plans.filter((plan) => plan.kind === "update");
    const skippedCount = state.plans.filter((plan) => plan.kind === "skip").length;

    try {
      if (updates.length) {
        for (const plan of updates) {
          await updateVenueByApi(plan.venueId, plan.venue);
        }
      }

      if (inserts.length) {
        for (const plan of inserts) {
          await createVenueByApi(plan.venue);
        }
      }

      const nextVenues = await listVenuesByApi();
      setVenues(nextVenues);
      setPendingCsvImport(null);
      setMessage(
        `CSV取込が完了しました。追加 ${inserts.length} 件、上書き ${updates.length} 件、スキップ ${skippedCount} 件です。`,
      );
    } catch (error) {
      setPendingCsvImport(null);
      setMessage(
        error instanceof Error ? error.message : "CSV取込に失敗しました。",
      );
    }
  }

  function cancelCsvImport() {
    setPendingCsvImport(null);
    setMessage("CSV取込を中止しました。");
  }

  function openVenueDetails(venue: Venue) {
    const nextDetailState = {
      venueId: venue.id,
      name: venue.name,
      address: venue.address,
      event_date: venue.event_date,
      fee: venue.fee,
      status: venue.status,
      contact_tel: venue.contact_tel,
      contact_fax: venue.contact_fax,
      contact_email: venue.contact_email,
      permit_file_path: venue.permit_file_path,
      permit_file_name: venue.permit_file_name,
      conversation_notes: venue.conversation_notes,
    };

    setDetailState(nextDetailState);
    setDetailPermitFile(null);
    setDetailNoteStatement("");
    setEditingNoteId(null);
    setEditingNoteStatement("");
    lastSavedDetailFingerprintRef.current = getDetailFingerprint(nextDetailState, null);
  }

  function closeVenueDetails() {
    if (detailAutosaveTimerRef.current) {
      window.clearTimeout(detailAutosaveTimerRef.current);
      detailAutosaveTimerRef.current = null;
    }
    setDetailState(null);
    setDetailPermitFile(null);
    setDetailNoteStatement("");
    setEditingNoteId(null);
    setEditingNoteStatement("");
    lastSavedDetailFingerprintRef.current = null;
    pendingDetailSaveRef.current = false;
  }

  function getDetailFingerprint(state: DetailState, permitFile: File | null) {
    return JSON.stringify({
      ...state,
      permit_file:
        permitFile
          ? {
              name: permitFile.name,
              size: permitFile.size,
              lastModified: permitFile.lastModified,
            }
          : null,
    });
  }

  function updateDetailState<Key extends keyof DetailState>(key: Key, value: DetailState[Key]) {
    setDetailState((current) =>
      current
        ? {
            ...current,
            [key]: value,
          }
        : current,
    );
  }

  function appendDetailNote() {
    if (!detailState) {
      return;
    }

    const speaker = userEmail ?? "不明";
    const statement = detailNoteStatement.trim();

    if (!statement) {
      setMessage("発言内容を入力してください。");
      return;
    }

    updateDetailState("conversation_notes", [
      ...detailState.conversation_notes,
      {
        id: crypto.randomUUID(),
        speaker,
        author_email: userEmail,
        statement,
        created_at: new Date().toISOString(),
        edited_at: null,
        deleted_at: null,
        liked_by: [],
      },
    ]);
    setDetailNoteStatement("");
  }

  function startEditingNote(note: VenueNote) {
    if (note.deleted_at) {
      return;
    }

    setEditingNoteId(note.id);
    setEditingNoteStatement(note.statement);
  }

  function cancelEditingNote() {
    setEditingNoteId(null);
    setEditingNoteStatement("");
  }

  function saveEditedNote(noteId: string) {
    if (!detailState) {
      return;
    }

    const statement = editingNoteStatement.trim();

    if (!statement) {
      setMessage("発言内容を入力してください。");
      return;
    }

    updateDetailState(
      "conversation_notes",
      detailState.conversation_notes.map((note) =>
        note.id === noteId
          ? {
              ...note,
              statement,
              edited_at: new Date().toISOString(),
            }
          : note,
      ),
    );
    cancelEditingNote();
  }

  function deleteNote(noteId: string) {
    if (!detailState) {
      return;
    }

    updateDetailState(
      "conversation_notes",
      detailState.conversation_notes.map((note) =>
        note.id === noteId
          ? {
              ...note,
              deleted_at: new Date().toISOString(),
            }
          : note,
      ),
    );

    if (editingNoteId === noteId) {
      cancelEditingNote();
    }
  }

  function toggleNoteLike(noteId: string) {
    if (!detailState || !userEmail) {
      setMessage("ライクするにはサインインしてください。");
      return;
    }

    updateDetailState(
      "conversation_notes",
      detailState.conversation_notes.map((note) => {
        if (note.id !== noteId) {
          return note;
        }

        if (isOwnNote(note)) {
          return note;
        }

        const likedBy = note.liked_by ?? [];
        const nextLikedBy = likedBy.includes(userEmail)
          ? likedBy.filter((email) => email !== userEmail)
          : [...likedBy, userEmail];

        return {
          ...note,
          liked_by: nextLikedBy,
        };
      }),
    );
  }

  async function saveVenueDetails(options?: { suppressToast?: boolean }) {
    if (!detailState || !selectedVenue || !databaseEnabled) {
      return;
    }

    if (detailSaveInFlightRef.current) {
      pendingDetailSaveRef.current = true;
      return;
    }

    detailSaveInFlightRef.current = true;

    if (!currentUser?.email) {
      detailSaveInFlightRef.current = false;
      setMessage("詳細保存にはサインインが必要です。");
      return;
    }

    const geocoded = await geocodeAddress(detailState.address);

    if (!geocoded) {
      detailSaveInFlightRef.current = false;
      setMessage("住所から座標を取得できませんでした。住所を確認してください。");
      return;
    }

    let permitFilePath = detailState.permit_file_path;
    let permitFileName = detailState.permit_file_name;

    if (detailPermitFile) {
      if (detailPermitFile.type !== "application/pdf") {
        detailSaveInFlightRef.current = false;
        setMessage("利用許可証は PDF を選択してください。");
        return;
      }

      const formData = new FormData();
      formData.set("venueId", selectedVenue.id);
      formData.set("file", detailPermitFile);

      const uploadResponse = await fetch("/api/uploads/venue-document", {
        method: "POST",
        credentials: "same-origin",
        body: formData,
      });

      if (!uploadResponse.ok) {
        detailSaveInFlightRef.current = false;
        setMessage(
          await getErrorMessage(uploadResponse, "利用許可証のアップロードに失敗しました。"),
        );
        return;
      }

      const uploadResult = (await uploadResponse.json()) as {
        storagePath: string;
        fileName: string;
      };

      permitFilePath = uploadResult.storagePath;
      permitFileName = uploadResult.fileName;
    }

    const payload = {
      name: detailState.name,
      address: detailState.address,
      event_date: detailState.event_date,
      fee: detailState.fee,
      status: detailState.status,
      lat: geocoded.lat,
      lng: geocoded.lng,
      contact_tel: normalizeContactInput(detailState.contact_tel),
      contact_fax: normalizeContactInput(detailState.contact_fax),
      contact_email: normalizeContactInput(detailState.contact_email),
      permit_file_path: permitFilePath,
      permit_file_name: permitFileName,
      conversation_notes: detailState.conversation_notes,
      editor_email: currentUser.email,
      updated_at: new Date().toISOString(),
    };

    let updatedVenue: Venue;

    try {
      updatedVenue = await updateVenueByApi(selectedVenue.id, payload);
    } catch (error) {
      detailSaveInFlightRef.current = false;
      setMessage(
        error instanceof Error ? error.message : "詳細保存に失敗しました。",
      );
      return;
    }

    setVenues((current) =>
      current.map((venue) =>
        venue.id === selectedVenue.id
          ? {
              ...venue,
              ...updatedVenue,
            }
          : venue,
      ),
    );
    setDetailState((current) =>
      current
        ? {
            ...current,
            contact_tel: payload.contact_tel,
            contact_fax: payload.contact_fax,
            contact_email: payload.contact_email,
            permit_file_path: permitFilePath,
            permit_file_name: permitFileName,
          }
        : current,
    );
    setDetailPermitFile(null);
    lastSavedDetailFingerprintRef.current = getDetailFingerprint(
      {
        ...detailState,
        contact_tel: payload.contact_tel,
        contact_fax: payload.contact_fax,
        contact_email: payload.contact_email,
        permit_file_path: permitFilePath,
        permit_file_name: permitFileName,
      },
      null,
    );
    detailSaveInFlightRef.current = false;

    if (!options?.suppressToast) {
      showToast("保存されました！");
    }

    if (pendingDetailSaveRef.current) {
      pendingDetailSaveRef.current = false;
      void saveVenueDetails(options);
    }
  }

  function showToast(value: string) {
    setToastMessage(value);

    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }

    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 2400);
  }

  function updateForm<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleFeeInput(value: string) {
    updateForm("fee", parseFeeInput(value));
  }

  function updateTimelineFocus() {
    const container = timelineRef.current;

    if (!container || !filteredVenues.length || typeof window === "undefined") {
      return;
    }

    const isMobile = window.matchMedia("(max-width: 720px)").matches;
    const containerRect = container.getBoundingClientRect();
    let nextVenueId = filteredVenues[0].id;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const venue of filteredVenues) {
      const element = timelineItemRefs.current[venue.id];

      if (!element) {
        continue;
      }

      const itemRect = element.getBoundingClientRect();
      const distance = isMobile
        ? Math.abs(itemRect.top - containerRect.top)
        : Math.abs(itemRect.left - containerRect.left);

      if (distance < bestDistance) {
        bestDistance = distance;
        nextVenueId = venue.id;
      }
    }

    setManualMapFocus((current) => (current ? null : current));
    setFocusedTimelineVenueId((current) => (current === nextVenueId ? current : nextVenueId));
  }

  function handleTimelineWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (typeof window === "undefined" || window.matchMedia("(max-width: 720px)").matches) {
      return;
    }

    const container = timelineRef.current;

    if (!container) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    container.scrollLeft += event.deltaY;
  }

  function handleTimelinePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (typeof window === "undefined" || window.matchMedia("(max-width: 720px)").matches) {
      return;
    }

    const container = timelineRef.current;

    if (!container) {
      return;
    }

    isTimelineDraggingRef.current = true;
    timelineDragStartXRef.current = event.clientX;
    timelineDragStartScrollLeftRef.current = container.scrollLeft;
    container.setPointerCapture(event.pointerId);
  }

  function handleTimelinePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!isTimelineDraggingRef.current) {
      return;
    }

    const container = timelineRef.current;

    if (!container) {
      return;
    }

    const deltaX = event.clientX - timelineDragStartXRef.current;
    container.scrollLeft = timelineDragStartScrollLeftRef.current - deltaX;
  }

  function handleTimelinePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const container = timelineRef.current;

    if (!container) {
      return;
    }

    isTimelineDraggingRef.current = false;
    container.releasePointerCapture(event.pointerId);
  }

  function focusVenueFromCard(venue: Venue) {
    setFocusedTimelineVenueId(venue.id);
    setManualMapFocus({
      venueId: venue.id,
      zoom: MOBILE_CARD_FOCUS_ZOOM,
    });
  }

  function openVenueFromList(venue: Venue) {
    focusVenueFromCard(venue);
    openVenueDetails(venue);
  }

  function scrollToVenueRecord(venueId: string) {
    const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 720px)").matches;
    const target = timelineItemRefs.current[venueId];
    target?.scrollIntoView(
      isMobile
        ? { behavior: "smooth", block: "start" }
        : { behavior: "smooth", inline: "start", block: "nearest" },
    );

    const venue = filteredVenues.find((item) => item.id === venueId);
    if (venue) {
      focusVenueFromCard(venue);
    }
  }

  function stopEventPropagation(event: React.SyntheticEvent) {
    event.stopPropagation();
  }

  if (!userEmail) {
    return (
      <div className="shell auth-shell">
        <header className="topbar auth-topbar">
          <div className="hero-copy auth-hero">
            <div className="hero-brand">
              <Image
                alt="Fitness World Japan"
                className="brand-logo"
                height={1080}
                priority
                src="/fwj-logo.svg"
                width={1080}
              />
              <div className="hero-text">
                <p className="eyebrow">FWJ Venue Booking</p>
                <h1>FWJ施設予約管理ツール</h1>
                <p className="subtitle">
                  会場一覧の表示と編集はサインイン後に有効になります。まず認証を完了してください。
                </p>
              </div>
            </div>
          </div>
          <section className="auth-panel">
            <div className="auth-copy">
              <p className="section-label">Authentication</p>
              <h2>サインイン</h2>
              <p className="status-text">未サインイン</p>
            </div>
            <form className="auth-form" onSubmit={handleEmailAuthSubmit}>
              <div className="auth-mode-switch">
                <button
                  className={authMode === "password" ? "table-button active" : "table-button"}
                  onClick={() => setAuthMode("password")}
                  type="button"
                >
                  メール+パスワード
                </button>
                {magicLinkEnabled ? (
                  <button
                    className={authMode === "magic-link" ? "table-button active" : "table-button"}
                    onClick={() => setAuthMode("magic-link")}
                    type="button"
                  >
                    マジックリンク
                  </button>
                ) : null}
              </div>
              <label className="field">
                メールアドレス
                <input
                  autoComplete="email"
                  onChange={(event) => setAuthEmail(event.target.value)}
                  type="email"
                  value={authEmail}
                />
              </label>
              {authMode === "password" ? (
                <label className="field">
                  パスワード
                  <input
                    autoComplete="current-password"
                    onChange={(event) => setAuthPassword(event.target.value)}
                    type="password"
                    value={authPassword}
                  />
                </label>
              ) : null}
              <button className="primary-button" type="submit">
                {authMode === "password" ? "サインイン / 登録" : "マジックリンク送信"}
              </button>
            </form>
            <div className="auth-actions">
              {googleAuthEnabled ? (
                <button className="ghost-button" onClick={signInWithGoogle} type="button">
                  Googleでサインイン
                </button>
              ) : null}
            </div>
            <p className="panel-note">{message}</p>
            {magicLinkEnabled ? (
              <p className="csv-note">
                ローカル開発では SMTP を Mailpit に向けると、送信されたログインリンクを確認できます。
              </p>
            ) : null}
          </section>
        </header>
      </div>
    );
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="hero-copy">
          <div className="hero-brand">
            <Image
              alt="Fitness World Japan"
              className="brand-logo"
              height={1080}
              priority
              src="/fwj-logo.svg"
              width={1080}
            />
            <div className="hero-text">
              <p className="eyebrow">FWJ Venue Booking</p>
              <h1>FWJ施設予約管理ツール</h1>
              <p className="subtitle">
                全国の会場候補と予約済み会場を、地図・タイムライン・一覧テーブルで一元管理します。
              </p>
            </div>
          </div>
        </div>
        <section className="auth-panel">
          <div className="profile-chip">
            <span className="profile-avatar">{(userEmail ?? "U").slice(0, 1).toUpperCase()}</span>
            <span className="profile-email">{userEmail ?? "未サインイン"}</span>
          </div>
          {!userEmail ? (
            <form className="auth-form" onSubmit={handleEmailAuthSubmit}>
              <div className="auth-mode-switch">
                <button
                  className={authMode === "password" ? "table-button active" : "table-button"}
                  onClick={() => setAuthMode("password")}
                  type="button"
                >
                  メール+パスワード
                </button>
                {magicLinkEnabled ? (
                  <button
                    className={authMode === "magic-link" ? "table-button active" : "table-button"}
                    onClick={() => setAuthMode("magic-link")}
                    type="button"
                  >
                    マジックリンク
                  </button>
                ) : null}
              </div>
              <label className="field">
                メールアドレス
                <input
                  autoComplete="email"
                  onChange={(event) => setAuthEmail(event.target.value)}
                  type="email"
                  value={authEmail}
                />
              </label>
              {authMode === "password" ? (
                <label className="field">
                  パスワード
                  <input
                    autoComplete="current-password"
                    onChange={(event) => setAuthPassword(event.target.value)}
                    type="password"
                    value={authPassword}
                  />
                </label>
              ) : null}
              <button className="primary-button" type="submit">
                {authMode === "password" ? "サインイン / 登録" : "マジックリンク送信"}
              </button>
            </form>
          ) : null}
          <div className="auth-actions">
            {userEmail ? (
              <button className="ghost-button" onClick={signOut} type="button">
                サインアウト
              </button>
            ) : googleAuthEnabled ? (
              <button className="ghost-button" onClick={signInWithGoogle} type="button">
                Googleでサインイン
              </button>
            ) : null}
          </div>
          <p className="panel-note">{message}</p>
          {!userEmail && magicLinkEnabled ? (
            <p className="csv-note">
              ローカル開発では SMTP を Mailpit に向けると、送信されたログインリンクを確認できます。
            </p>
          ) : null}
        </section>
      </header>

      <section className="stats-grid">
        <article className="stat-card">
          <span>予約済み</span>
          <strong>{bookedCount}</strong>
        </article>
        <article className="stat-card">
          <span>予約候補</span>
          <strong>{candidateCount}</strong>
        </article>
        <article className="stat-card">
          <span>利用料合計</span>
          <strong>{formatCurrency(totalCost)}</strong>
        </article>
      </section>

      <main className="workspace-grid workspace-grid-single">
        <section className="card map-panel">
          <div className="panel-header">
            <div>
              <p className="section-label">Spatial</p>
              <h2>{spatialPanelMode === "map" ? "全国地図" : "月次カレンダー"}</h2>
            </div>
            <div className="panel-tabs" role="tablist" aria-label="Map and calendar">
              <button
                aria-selected={spatialPanelMode === "map"}
                className={spatialPanelMode === "map" ? "table-button active" : "table-button"}
                onClick={() => setSpatialPanelMode("map")}
                role="tab"
                type="button"
              >
                MAP
              </button>
              <button
                aria-selected={spatialPanelMode === "calendar"}
                className={spatialPanelMode === "calendar" ? "table-button active" : "table-button"}
                onClick={() => setSpatialPanelMode("calendar")}
                role="tab"
                type="button"
              >
                CALENDAR
              </button>
            </div>
          </div>
          {spatialPanelMode === "map" ? (
            <>
              <div className="legend">
                <span><i className="dot dot-booked" />予約済み</span>
                <span><i className="dot dot-candidate" />予約候補</span>
              </div>
              <DynamicVenueMap
                focusVenue={mapFocusVenue}
                focusZoom={mapFocusZoom}
                venues={filteredVenues}
              />
            </>
          ) : (
            <VenueCalendar
              focusVenue={mapFocusVenue}
              onVenueSelect={scrollToVenueRecord}
              venues={filteredVenues}
            />
          )}
          <section className="spatial-venues-panel">
            <div className="panel-header">
              <div>
                <p className="section-label">Venue Focus</p>
                <h2>利用予定</h2>
              </div>
            </div>
            <div
              className="timeline spatial-timeline"
              onScroll={updateTimelineFocus}
              onPointerDown={handleTimelinePointerDown}
              onPointerMove={handleTimelinePointerMove}
              onPointerUp={handleTimelinePointerUp}
              onPointerCancel={handleTimelinePointerUp}
              onWheel={handleTimelineWheel}
              ref={timelineRef}
            >
              {filteredVenues.map((venue) => (
                <article
                  className="timeline-item"
                  data-focused={venue.id === leadingVenue?.id}
                  data-status={venue.status}
                  key={venue.id}
                  onClick={() => focusVenueFromCard(venue)}
                  ref={(element) => {
                    timelineItemRefs.current[venue.id] = element;
                  }}
                >
                  <p className="timeline-date">{formatDate(venue.event_date)}</p>
                  <div className="timeline-title-row">
                    <h3>{venue.name}</h3>
                    {getVisibleCommentCount(venue) ? (
                      <span className="comment-badge">
                        <span aria-hidden="true">💬</span>
                        {getVisibleCommentCount(venue)}
                      </span>
                    ) : null}
                  </div>
                  <p className="timeline-address">{venue.address}</p>
                  <p className="timeline-price">{formatCurrency(venue.fee)}</p>
                  <p className="timeline-editor">編集者: {venue.editor_email}</p>
                </article>
              ))}
              {!filteredVenues.length ? (
                <p className="empty-message">該当する会場はありません。</p>
              ) : null}
            </div>
          </section>
        </section>
      </main>

      <section className="card table-panel">
          <div className="panel-header">
            <div>
              <p className="section-label">Table</p>
              <h2>会場一覧</h2>
            </div>
            <label className="field compact">
              ステータス絞り込み
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as "all" | VenueStatus)
                }
              >
                <option value="all">すべて</option>
                <option value="booked">予約済み</option>
                <option value="candidate">予約候補</option>
              </select>
            </label>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>会場名</th>
                  <th>利用予定日</th>
                  <th>料金</th>
                  <th>座標</th>
                  <th>予約ステータス</th>
                  <th>編集者</th>
                </tr>
              </thead>
              <tbody>
                {filteredVenues.length ? (
                  filteredVenues.map((venue) => {
                    return (
                      <tr
                        key={venue.id}
                        onClick={() => openVenueFromList(venue)}
                      >
                        <td data-label="会場名">
                          <div className="venue-cell">
                            <div className="venue-name-row">
                              <strong>{venue.name}</strong>
                              {getVisibleCommentCount(venue) ? (
                                <span className="comment-badge">
                                  <span aria-hidden="true">💬</span>
                                  {getVisibleCommentCount(venue)}
                                </span>
                              ) : null}
                            </div>
                            <span>{venue.address}</span>
                          </div>
                        </td>
                        <td data-label="利用予定日">
                          {formatDate(venue.event_date)}
                        </td>
                        <td data-label="料金">
                          {formatCurrency(venue.fee)}
                        </td>
                        <td data-label="座標">
                          <div className="coordinate-cell">
                            <span>{venue.lat.toFixed(4)}</span>
                            <span>{venue.lng.toFixed(4)}</span>
                          </div>
                        </td>
                        <td data-label="予約ステータス">
                          <span className={`status-pill ${venue.status}`}>
                            {venue.status === "booked" ? "予約済み" : "予約候補"}
                          </span>
                        </td>
                        <td data-label="編集者">
                          <div className="editor-cell">
                            <strong>{venue.editor_email}</strong>
                            <span>{venue.updated_at ? `${formatDateTime(venue.updated_at)} 更新` : "作成時の編集者"}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="empty-cell no-label">
                      該当する会場はありません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mobile-venue-list">
            {filteredVenues.length ? (
              filteredVenues.map((venue) => (
                <article
                  className="mobile-venue-card"
                  key={venue.id}
                >
                  <button
                    className="mobile-venue-summary"
                    onClick={() => openVenueFromList(venue)}
                    type="button"
                  >
                    <div className="mobile-venue-head">
                      <div className="venue-name-row">
                        <strong>{venue.name}</strong>
                        {getVisibleCommentCount(venue) ? (
                          <span className="comment-badge">
                            <span aria-hidden="true">💬</span>
                            {getVisibleCommentCount(venue)}
                          </span>
                        ) : null}
                      </div>
                      <span>{formatDate(venue.event_date)}</span>
                    </div>
                    <span className={`status-pill ${venue.status}`}>
                      {venue.status === "booked" ? "予約済み" : "予約候補"}
                    </span>
                  </button>
                </article>
              ))
            ) : (
              <p className="empty-message">該当する会場はありません。</p>
            )}
          </div>
      </section>

      {pendingCsvImport?.conflictExisting && pendingCsvImport.conflictIncoming ? (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-labelledby="csv-conflict-title"
            aria-modal="true"
            className="modal-card"
            role="dialog"
          >
            <p className="section-label">CSV Import</p>
            <h2 id="csv-conflict-title">同じ日付と会場名のレコードが見つかりました</h2>
            <div className="conflict-grid">
              <article className="conflict-block">
                <h3>既存レコード</h3>
                <p>{pendingCsvImport.conflictExisting.event_date}</p>
                <p>{pendingCsvImport.conflictExisting.name}</p>
                <p>{pendingCsvImport.conflictExisting.address}</p>
                <p>{formatCurrency(pendingCsvImport.conflictExisting.fee)}</p>
              </article>
              <article className="conflict-block">
                <h3>CSVレコード</h3>
                <p>{pendingCsvImport.conflictIncoming.event_date}</p>
                <p>{pendingCsvImport.conflictIncoming.name}</p>
                <p>{pendingCsvImport.conflictIncoming.address}</p>
                <p>{formatCurrency(pendingCsvImport.conflictIncoming.fee)}</p>
              </article>
            </div>
            {pendingCsvImport.conflictMode === "overwrite" ? (
              <>
                <p className="panel-note">既存レコードをこの内容で上書きしますか。</p>
                <div className="modal-actions">
                  <button className="primary-button" onClick={() => void resolveCsvConflict("overwrite")} type="button">
                    はい、上書きする
                  </button>
                  <button
                    className="ghost-button"
                    onClick={() =>
                      setPendingCsvImport((current) =>
                        current ? { ...current, conflictMode: "alternative" } : current,
                      )
                    }
                    type="button"
                  >
                    いいえ
                  </button>
                  <button className="table-button danger" onClick={cancelCsvImport} type="button">
                    取込を中止
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="panel-note">上書きしない場合、このCSVレコードをどう扱いますか。</p>
                <div className="modal-actions">
                  <button className="primary-button" onClick={() => void resolveCsvConflict("add")} type="button">
                    新規レコードとして追加
                  </button>
                  <button className="ghost-button" onClick={() => void resolveCsvConflict("skip")} type="button">
                    このレコードはスキップ
                  </button>
                  <button
                    className="table-button"
                    onClick={() =>
                      setPendingCsvImport((current) =>
                        current ? { ...current, conflictMode: "overwrite" } : current,
                      )
                    }
                    type="button"
                  >
                    上書き確認に戻る
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      ) : null}

      {isManageModalOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-labelledby="manage-modal-title"
            aria-modal="true"
            className="modal-card manage-modal"
            role="dialog"
          >
            <div className="panel-header">
              <div>
                <p className="section-label">Manage</p>
                <h2 id="manage-modal-title">会場登録</h2>
              </div>
              <button className="table-button" onClick={() => setIsManageModalOpen(false)} type="button">
                閉じる
              </button>
            </div>
            <form className="venue-form" onSubmit={handleSubmit}>
              <label className="field">
                会場名
                <input
                  onChange={(event) => updateForm("name", event.target.value)}
                  placeholder="札幌コンベンションホール"
                  required
                  type="text"
                  value={form.name}
                />
              </label>
              <label className="field">
                住所
                <input
                  onChange={(event) => updateForm("address", event.target.value)}
                  placeholder="北海道札幌市白石区東札幌6条1丁目"
                  required
                  type="text"
                  value={form.address}
                />
              </label>
              <div className="form-row">
                <label className="field">
                  利用予定日
                  <input
                    onChange={(event) => updateForm("event_date", event.target.value)}
                    required
                    type="date"
                    value={form.event_date}
                  />
                </label>
                <label className="field">
                  利用料
                  <input
                    inputMode="numeric"
                    onChange={(event) => handleFeeInput(event.target.value)}
                    required
                    type="text"
                    value={String(form.fee)}
                  />
                </label>
              </div>
              <label className="field">
                予約ステータス
                <select
                  onChange={(event) => updateForm("status", event.target.value as VenueStatus)}
                  value={form.status}
                >
                  <option value="booked">予約済み</option>
                  <option value="candidate">予約候補</option>
                </select>
              </label>
              <button className="primary-button" disabled={loading} type="submit">
                {loading ? "保存中..." : "会場を追加"}
              </button>
            </form>
            <div className="csv-import">
              <p className="section-label">CSV Import</p>
              <label className="field">
                CSVファイル
                <input accept=".csv,text/csv" onChange={(event) => void handleCsvImport(event)} type="file" />
              </label>
              <p className="csv-note">
                ヘッダー例: `name,address,event_date,fee,status,contact_tel,contact_fax,contact_email`
                または `会場名,住所,利用予定日,料金,予約ステータス,TEL,FAX,Mail`
              </p>
            </div>
          </section>
        </div>
      ) : null}

      {detailState && selectedVenue ? (
        <div className="modal-backdrop" onClick={closeVenueDetails} role="presentation">
          <section
            aria-labelledby="detail-modal-title"
            aria-modal="true"
            className="modal-card detail-modal"
            onClick={stopEventPropagation}
            role="dialog"
          >
            <div className="panel-header">
              <div>
                <p className="section-label">Venue Detail</p>
                <h2 id="detail-modal-title">{selectedVenue.name}</h2>
                <p className="panel-note">{selectedVenue.address}</p>
              </div>
              <button className="table-button" onClick={closeVenueDetails} type="button">
                閉じる
              </button>
            </div>

            <div className="detail-grid">
              <article className="detail-card-block">
                <p className="section-label">Overview</p>
                <div className="detail-form-grid">
                  <label className="field detail-full">
                    会場名
                    <input
                      onChange={(event) => updateDetailState("name", event.target.value)}
                      type="text"
                      value={detailState.name}
                    />
                  </label>
                  <label className="field detail-full">
                    住所
                    <input
                      onChange={(event) => updateDetailState("address", event.target.value)}
                      type="text"
                      value={detailState.address}
                    />
                  </label>
                  <label className="field">
                    利用予定日
                    <input
                      onChange={(event) => updateDetailState("event_date", event.target.value)}
                      type="date"
                      value={detailState.event_date}
                    />
                  </label>
                  <label className="field">
                    料金
                    <input
                      inputMode="numeric"
                      onChange={(event) => updateDetailState("fee", parseFeeInput(event.target.value))}
                      type="text"
                      value={String(detailState.fee)}
                    />
                  </label>
                  <label className="field detail-full">
                    予約ステータス
                    <select
                      onChange={(event) => updateDetailState("status", event.target.value as VenueStatus)}
                      value={detailState.status}
                    >
                      <option value="booked">予約済み</option>
                      <option value="candidate">予約候補</option>
                    </select>
                  </label>
                </div>
              </article>

              <article className="detail-card-block">
                <p className="section-label">Contact</p>
                <div className="detail-form-grid">
                  <label className="field">
                    TEL
                    <input
                      onChange={(event) => updateDetailState("contact_tel", event.target.value)}
                      type="text"
                      value={detailState.contact_tel}
                    />
                  </label>
                  <label className="field">
                    FAX
                    <input
                      onChange={(event) => updateDetailState("contact_fax", event.target.value)}
                      type="text"
                      value={detailState.contact_fax}
                    />
                  </label>
                  <label className="field detail-full">
                    Mail
                    <input
                      onChange={(event) => updateDetailState("contact_email", event.target.value)}
                      type="email"
                      value={detailState.contact_email}
                    />
                  </label>
                </div>
              </article>

              <article className="detail-card-block">
                <p className="section-label">Permit</p>
                <label className="field">
                  利用許可証（PDF）
                  <input
                    accept="application/pdf"
                    onChange={(event) => setDetailPermitFile(event.target.files?.[0] ?? null)}
                    type="file"
                  />
                </label>
                {detailPermitFile ? (
                  <p className="csv-note">選択中: {detailPermitFile.name}</p>
                ) : detailState.permit_file_path ? (
                  <a
                    className="detail-link"
                    href={getPermitFileUrl(detailState.permit_file_path)}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {detailState.permit_file_name ?? "利用許可証を開く"}
                  </a>
                ) : (
                  <p className="csv-note">まだ添付されていません。</p>
                )}
              </article>

              <article className="detail-card-block detail-notes">
                <p className="section-label">Conversation</p>
                <div className="note-log">
                  {detailState.conversation_notes.length ? (
                    detailState.conversation_notes
                      .slice()
                      .sort((a, b) => a.created_at.localeCompare(b.created_at))
                      .map((note) => {
                        const ownNote = isOwnNote(note);
                        const liked = note.liked_by?.includes(userEmail ?? "") ?? false;

                        return (
                        <div className="note-entry" data-deleted={Boolean(note.deleted_at)} key={note.id}>
                          <div className="note-entry-head">
                            <div className="note-entry-meta">
                              <strong>{note.speaker}</strong>
                              <span>{formatDateTime(note.created_at)}</span>
                              {note.edited_at ? (
                                <span className="note-status">編集済 {formatDateTime(note.edited_at)}</span>
                              ) : null}
                              {note.deleted_at ? (
                                <span className="note-status danger">
                                  削除されました {formatDateTime(note.deleted_at)}
                                </span>
                              ) : null}
                            </div>
                            <div className="note-actions">
                              <button
                                aria-label={`Like ${note.liked_by?.length ?? 0}`}
                                className={`note-icon-button ${liked ? "active" : ""}`}
                                disabled={ownNote}
                                onClick={() => toggleNoteLike(note.id)}
                                type="button"
                                title={`Like ${note.liked_by?.length ?? 0}`}
                              >
                                <span aria-hidden="true">{liked ? "♥" : "♡"}</span>
                                <small>{note.liked_by?.length ?? 0}</small>
                              </button>
                              {!note.deleted_at && ownNote ? (
                                <>
                                  <button
                                    aria-label="Edit"
                                    className="note-icon-button"
                                    onClick={() => startEditingNote(note)}
                                    type="button"
                                    title="Edit"
                                  >
                                    <span aria-hidden="true">✎</span>
                                  </button>
                                  <button
                                    aria-label="Del"
                                    className="note-icon-button danger"
                                    onClick={() => deleteNote(note.id)}
                                    type="button"
                                    title="Del"
                                  >
                                    <span aria-hidden="true">🗑</span>
                                  </button>
                                </>
                              ) : null}
                            </div>
                          </div>
                          {editingNoteId === note.id ? (
                            <div className="note-edit-block">
                              <textarea
                                className="detail-textarea"
                                onChange={(event) => setEditingNoteStatement(event.target.value)}
                                value={editingNoteStatement}
                              />
                              <div className="note-actions">
                                <button
                                  className="table-button"
                                  onClick={() => saveEditedNote(note.id)}
                                  type="button"
                                >
                                  編集を保存
                                </button>
                                <button className="table-button" onClick={cancelEditingNote} type="button">
                                  キャンセル
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p>{note.deleted_at ? "（削除されました）" : note.statement}</p>
                          )}
                        </div>
                      )})
                  ) : (
                    <p className="csv-note">まだ発言ログはありません。</p>
                  )}
                </div>
                <div className="detail-form-grid">
                  <label className="field">
                    発言者
                    <input
                      disabled
                      placeholder={userEmail ?? "サインイン中のメールアドレス"}
                      type="text"
                      value={userEmail ?? ""}
                    />
                  </label>
                  <label className="field detail-full">
                    発言内容
                    <textarea
                      className="detail-textarea"
                      onChange={(event) => setDetailNoteStatement(event.target.value)}
                      placeholder="何と発言したかを記録"
                      value={detailNoteStatement}
                    />
                  </label>
                </div>
                <div className="modal-actions">
                  <button className="table-button" onClick={appendDetailNote} type="button">
                    発言ログに追加
                  </button>
                </div>
              </article>
            </div>
          </section>
        </div>
      ) : null}

      <button className="floating-cta-button" onClick={() => setIsManageModalOpen(true)} type="button">
        会場を登録
      </button>

      {toastMessage ? <div className="toast-message">{toastMessage}</div> : null}
    </div>
  );
}

async function geocodeAddress(address: string) {
  const query = address.trim();

  if (!query) {
    return null;
  }

  try {
    const params = new URLSearchParams({ address: query });
    const response = await fetch(`/api/geocode?${params.toString()}`);

    if (!response.ok) {
      return null;
    }

    const result = (await response.json()) as { lat: number; lng: number };

    return {
      lat: result.lat,
      lng: result.lng,
    };
  } catch {
    return null;
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getPermitFileUrl(path: string | null) {
  if (!path) {
    return "#";
  }

  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("/")) {
    return path;
  }

  return `/api/files/${path}`;
}

function parseFeeInput(value: string) {
  const normalized = value
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/[，、]/g, ",")
    .replace(/[．。]/g, ".")
    .replace(/,/g, "")
    .trim();

  if (!normalized) {
    return 0;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function normalizeContactInput(value: string) {
  return value
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/＠/g, "@")
    .replace(/[‐－―ー]/g, "-")
    .replace(/[（）]/g, (char) => (char === "（" ? "(" : ")"))
    .replace(/[　]/g, " ")
    .trim();
}

function parseVenueCsv(text: string) {
  const rows = parseCsvRows(text).filter((row) => row.some((cell) => cell.trim()));

  if (rows.length < 2) {
    return [];
  }

  const headers = rows[0].map((header) => normalizeCsvHeader(header));

  return rows.slice(1).flatMap((row) => {
    const record = Object.fromEntries(headers.map((header, index) => [header, row[index]?.trim() ?? ""]));

    const name = record.name;
    const address = record.address;
    const eventDate = record.event_date;
    const fee = parseFeeInput(record.fee ?? "");
    const status = normalizeVenueStatus(record.status);
    const contactTel = normalizeContactInput(record.contact_tel ?? "");
    const contactFax = normalizeContactInput(record.contact_fax ?? "");
    const contactEmail = normalizeContactInput(record.contact_email ?? "");

    if (!name || !address || !eventDate || !status) {
      return [];
    }

    return [
      {
        name,
        address,
        event_date: eventDate,
        fee,
        status,
        lat: 0,
        lng: 0,
        contact_tel: contactTel,
        contact_fax: contactFax,
        contact_email: contactEmail,
        permit_file_path: null,
        permit_file_name: null,
        conversation_notes: [],
      } satisfies VenueInput,
    ];
  });
}

function parseCsvRows(text: string) {
  const rows: string[][] = [];
  let currentCell = "";
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentCell = "";
      currentRow = [];
      continue;
    }

    currentCell += char;
  }

  if (currentCell || currentRow.length) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows;
}

function normalizeCsvHeader(header: string) {
  const normalized = header.trim().toLowerCase();

  switch (normalized) {
    case "会場名":
    case "name":
      return "name";
    case "住所":
    case "address":
      return "address";
    case "利用予定日":
    case "event_date":
    case "date":
      return "event_date";
    case "料金":
    case "利用料":
    case "fee":
    case "price":
      return "fee";
    case "予約ステータス":
    case "status":
      return "status";
    case "tel":
    case "電話":
    case "電話番号":
    case "contact_tel":
      return "contact_tel";
    case "fax":
    case "contact_fax":
      return "contact_fax";
    case "mail":
    case "email":
    case "e-mail":
    case "contact_email":
      return "contact_email";
    default:
      return normalized;
  }
}

function normalizeVenueStatus(value: string) {
  const normalized = value.trim().toLowerCase();

  if (normalized === "booked" || normalized === "予約済み") {
    return "booked" as const;
  }

  if (normalized === "candidate" || normalized === "予約候補") {
    return "candidate" as const;
  }

  return null;
}

function normalizeVenueKey(value: string) {
  return value.trim().replace(/\s+/g, "").toLowerCase();
}

async function syncSessionState(
  setUserEmail: (value: string | null) => void,
  setVenues: (value: Venue[] | ((current: Venue[]) => Venue[])) => void,
  setMessage: (value: string) => void,
  databaseEnabled: boolean,
  user: { email?: string | null } | null,
) {
  setUserEmail(user?.email ?? null);

  if (!user?.email) {
    setVenues([]);
    setMessage("サインインすると会場一覧を表示します。");
    return;
  }

  if (!databaseEnabled) {
    setVenues([]);
    setMessage("DATABASE_URL が未設定のため、会場データを読み込めません。");
    return;
  }

  try {
    const fetchedVenues = await listVenuesByApi();
    setVenues(fetchedVenues);
    setMessage(`サインイン中: ${user.email}`);
  } catch (error) {
    setMessage(
      error instanceof Error
        ? `会場データの取得に失敗しました: ${error.message}`
        : "会場データの取得に失敗しました。",
    );
  }
}

async function listVenuesByApi() {
  const response = await fetch("/api/venues", {
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "会場一覧の取得に失敗しました。"));
  }

  return (await response.json()) as Venue[];
}

async function createVenueByApi(payload: VenueInput) {
  const response = await fetch("/api/venues", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "会場登録に失敗しました。"));
  }

  return (await response.json()) as Venue;
}

async function updateVenueByApi(venueId: string, payload: Partial<VenueInput>) {
  const response = await fetch(`/api/venues/${venueId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "会場更新に失敗しました。"));
  }

  return (await response.json()) as Venue;
}

async function getErrorMessage(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
}
