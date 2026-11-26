import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Filter,
  Heart,
  Loader2,
  MessageCircle,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  Settings2,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  Wifi,
  X,
} from 'lucide-react';
import type {
  ApiProtocol,
  ArkState,
  ShowbizPhoneApiConfig,
  ShowbizPhoneContact,
  ShowbizPhoneGroup,
  ShowbizPhoneMessage,
  ShowbizPhonePost,
  ShowbizPhoneState,
} from '../types/ark';
import {
  cleanJunkShowbizContacts,
  formatShowbizPostForStoryBridge,
  generateShowbizNpcPostsWithAi,
  getShowbizMcProfile,
  makeShowbizHandle,
  remapShowbizPhoneContactIds,
  requestShowbizPostReactionsWithAi,
  resolveShowbizPhoneRuntimeSummary,
  sendShowbizDmWithAi,
  sendShowbizGroupMessageWithAi,
  syncShowbizContactsFromCurrentSave,
  testShowbizPhoneAiConnection,
} from '../utils/showbizPhone';
import { createDefaultShowbizPhoneState } from '../utils/storage';

type PhoneTab = 'dm' | 'groups' | 'social';

interface ShowbizPhonePanelProps {
  state: ArkState;
  onUpdatePhone: (
    updater: (prev: ShowbizPhoneState) => ShowbizPhoneState,
  ) => void;
  onUpdatePhoneAiConfig: (nextConfig: ShowbizPhoneApiConfig) => void;
  onBridgeToStory: (storyPrompt: string) => void;
  onShowBanner?: (text: string, type?: 'info' | 'err') => void;
}

const GROUP_TEMPLATES = [
  { name: 'Nhóm Đoàn phim', topic: 'Lịch quay, kịch bản & chuyện trường quay' },
  { name: 'Hậu trường & Ê-kíp', topic: 'Trang phục, lịch chạy show & lịch trình' },
  { name: 'Hội đồng nghiệp thân', topic: 'Tám chuyện showbiz, ăn khuya & drama nội bộ' },
];

function formatRelativeTime(ts: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return 'Vừa xong';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} giờ trước`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} ngày trước`;
}

function getInitials(name: string): string {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return 'NV';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function ContactAvatar({
  name,
  avatarData,
  size = 'md',
}: {
  name: string;
  avatarData?: string;
  size?: 'sm' | 'md';
}) {
  const cls = size === 'sm' ? 'h-8 w-8 text-[11px]' : 'h-10 w-10 text-xs';
  if (avatarData) {
    return (
      <img
        src={avatarData}
        alt={name}
        className={`${cls} shrink-0 rounded-full object-cover ring-1 ring-white/[0.12]`}
      />
    );
  }
  return (
    <div
      className={`${cls} flex shrink-0 items-center justify-center rounded-full bg-slate-800 font-semibold text-sky-200 ring-1 ring-white/[0.12]`}
    >
      {getInitials(name)}
    </div>
  );
}

export const ShowbizPhonePanel: React.FC<ShowbizPhonePanelProps> = ({
  state,
  onUpdatePhone,
  onUpdatePhoneAiConfig,
  onBridgeToStory,
  onShowBanner,
}) => {
  const phone = state.showbizPhone || createDefaultShowbizPhoneState();
  const mcProfile = useMemo(() => getShowbizMcProfile(state), [state]);
  const runtime = useMemo(
    () => resolveShowbizPhoneRuntimeSummary(state.config),
    [state.config],
  );

  const [activeTab, setActiveTab] = useState<PhoneTab>('dm');
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Dedicated AI settings local form
  const dedicatedCfg = state.config.showbizPhoneConfig || {};
  const [cfgUrl, setCfgUrl] = useState(dedicatedCfg.proxyUrl || '');
  const [cfgKey, setCfgKey] = useState(dedicatedCfg.proxyKey || '');
  const [cfgModel, setCfgModel] = useState(
    dedicatedCfg.model || state.config.taskModels?.showbizPhone || '',
  );
  const [cfgProtocol, setCfgProtocol] = useState<ApiProtocol | ''>(
    dedicatedCfg.apiProtocol || '',
  );
  const [cfgUseProxy, setCfgUseProxy] = useState<boolean>(
    typeof dedicatedCfg.useServerProxy === 'boolean'
      ? dedicatedCfg.useServerProxy
      : typeof state.config.useServerProxy === 'boolean'
        ? state.config.useServerProxy
        : true,
  );
  const [testingConn, setTestingConn] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  // DM state
  const [selectedContactId, setSelectedContactId] = useState<string>(
    phone.contacts[0]?.id || '',
  );
  const [mobileDmThreadOpen, setMobileDmThreadOpen] = useState(false);
  const [dmDraft, setDmDraft] = useState('');
  const [dmSending, setDmSending] = useState(false);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactRole, setNewContactRole] = useState('');
  const [newContactRelation, setNewContactRelation] = useState('');

  // Group state
  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    phone.groups[0]?.id || '',
  );
  const [mobileGroupOpen, setMobileGroupOpen] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupTopic, setNewGroupTopic] = useState('');
  const [newGroupMemberIds, setNewGroupMemberIds] = useState<string[]>([]);
  const [groupDraft, setGroupDraft] = useState('');
  const [groupSending, setGroupSending] = useState(false);

  // Social feed state
  const [postDraft, setPostDraft] = useState('');
  const [postLocation, setPostLocation] = useState('');
  const [postHashtags, setPostHashtags] = useState('');
  const [socialBusy, setSocialBusy] = useState(false);
  const [reactingPostId, setReactingPostId] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>(
    {},
  );

  const selectedContact = useMemo(
    () =>
      phone.contacts.find((c) => c.id === selectedContactId) ||
      phone.contacts[0] ||
      null,
    [phone.contacts, selectedContactId],
  );

  const selectedGroup = useMemo(
    () =>
      phone.groups.find((g) => g.id === selectedGroupId) ||
      phone.groups[0] ||
      null,
    [phone.groups, selectedGroupId],
  );

  const selectedDmMessages: ShowbizPhoneMessage[] = useMemo(() => {
    if (!selectedContact) return [];
    return phone.dmThreads[selectedContact.id] || [];
  }, [phone.dmThreads, selectedContact]);

  const contactById = useMemo(() => {
    const map = new Map<string, ShowbizPhoneContact>();
    for (const c of phone.contacts) {
      map.set(c.id, c);
    }
    return map;
  }, [phone.contacts]);

  const notify = (text: string, type: 'info' | 'err' = 'info') => {
    onShowBanner?.(text, type);
  };

  // --- Handlers: Sync & Junk Clean ---
  const handleSyncSaveNpcs = () => {
    const result = syncShowbizContactsFromCurrentSave(state, phone);
    onUpdatePhone(() => result.nextPhone);
    if (!selectedContactId && result.nextPhone.contacts[0]) {
      setSelectedContactId(result.nextPhone.contacts[0].id);
    }
    const parts: string[] = [];
    if (result.addedCount > 0) {
      parts.push(`thêm ${result.addedCount} NPC từ save hiện tại`);
    }
    if (result.removedJunkCount > 0) {
      parts.push(`đã dọn ${result.removedJunkCount} mục rác/trùng`);
    }
    notify(
      parts.length
        ? `Đồng bộ danh bạ xong: ${parts.join(', ')} (tổng ${result.nextPhone.contacts.length} liên hệ).`
        : `Danh bạ đã khớp với save hiện tại (${result.nextPhone.contacts.length} liên hệ).`,
      'info',
    );
  };

  const handleCleanJunkContacts = () => {
    const threadCountById: Record<string, number> = {};
    for (const [id, msgs] of Object.entries(phone.dmThreads || {})) {
      if (Array.isArray(msgs) && msgs.length > 0) {
        threadCountById[id] = msgs.length;
      }
    }
    const cleaned = cleanJunkShowbizContacts(phone.contacts, mcProfile.name, {
      threadCountById,
    });
    if (cleaned.removedCount === 0) {
      notify('Danh bạ Điện thoại Showbiz hiện sạch, không phát hiện tên rác.', 'info');
      return;
    }
    onUpdatePhone((prev) =>
      remapShowbizPhoneContactIds(prev, cleaned.contacts, cleaned.mergedIdMap),
    );
    if (selectedContactId && cleaned.mergedIdMap[selectedContactId]) {
      setSelectedContactId(cleaned.mergedIdMap[selectedContactId]);
    }
    notify(
      `Đã xóa ${cleaned.removedCount} liên hệ rác/trùng khỏi danh bạ Điện thoại Showbiz.`,
      'info',
    );
  };

  // --- Handlers: Dedicated AI Config ---
  const handleSaveAiConfig = () => {
    const nextCfg: ShowbizPhoneApiConfig = {
      ...(cfgUrl.trim() ? { proxyUrl: cfgUrl.trim() } : {}),
      ...(cfgKey.trim() ? { proxyKey: cfgKey.trim() } : {}),
      ...(cfgModel.trim() ? { model: cfgModel.trim() } : {}),
      ...(cfgProtocol ? { apiProtocol: cfgProtocol } : {}),
      useServerProxy: cfgUseProxy,
    };
    onUpdatePhoneAiConfig(nextCfg);
    setTestResult(null);
    notify(
      'Đã lưu cấu hình AI riêng cho Điện thoại Showbiz (không ảnh hưởng màn Truyện chính).',
      'info',
    );
  };

  const handleResetAiConfig = () => {
    setCfgUrl('');
    setCfgKey('');
    setCfgModel('');
    setCfgProtocol('');
    setCfgUseProxy(
      typeof state.config.useServerProxy === 'boolean'
        ? state.config.useServerProxy
        : true,
    );
    onUpdatePhoneAiConfig({});
    setTestResult(null);
    notify('Đã đưa Điện thoại Showbiz về dùng cấu hình AI chung.', 'info');
  };

  const handleTestAiConnection = async () => {
    setTestingConn(true);
    setTestResult(null);
    try {
      const previewState: ArkState = {
        ...state,
        config: {
          ...state.config,
          showbizPhoneConfig: {
            ...(cfgUrl.trim() ? { proxyUrl: cfgUrl.trim() } : {}),
            ...(cfgKey.trim() ? { proxyKey: cfgKey.trim() } : {}),
            ...(cfgModel.trim() ? { model: cfgModel.trim() } : {}),
            ...(cfgProtocol ? { apiProtocol: cfgProtocol } : {}),
            useServerProxy: cfgUseProxy,
          },
        },
      };
      const res = await testShowbizPhoneAiConnection(previewState);
      setTestResult({ ok: res.ok, message: res.message });
    } finally {
      setTestingConn(false);
    }
  };

  // --- Handlers: Contacts & DM ---
  const handleAddManualContact = () => {
    const name = newContactName.trim();
    if (!name) {
      notify('Vui lòng nhập tên liên hệ.', 'err');
      return;
    }
    const now = Date.now();
    const newItem: ShowbizPhoneContact = {
      id: `sb_manual_${now}`,
      name,
      handle: makeShowbizHandle(name, phone.contacts.length + 1),
      role: newContactRole.trim(),
      relation: newContactRelation.trim(),
      source: 'manual',
      addedAt: now,
    };
    onUpdatePhone((prev) => ({
      ...prev,
      contacts: [newItem, ...prev.contacts],
    }));
    setSelectedContactId(newItem.id);
    setNewContactName('');
    setNewContactRole('');
    setNewContactRelation('');
    setAddContactOpen(false);
    notify(`Đã thêm "${name}" vào danh bạ save hiện tại.`, 'info');
  };

  const handleDeleteContact = (contact: ShowbizPhoneContact) => {
    onUpdatePhone((prev) => {
      const nextContacts = prev.contacts.filter((c) => c.id !== contact.id);
      const nextDm = { ...prev.dmThreads };
      delete nextDm[contact.id];
      const nextGroups = prev.groups.map((g) => ({
        ...g,
        memberIds: g.memberIds.filter((id) => id !== contact.id),
      }));
      return {
        ...prev,
        contacts: nextContacts,
        dmThreads: nextDm,
        groups: nextGroups,
      };
    });
    if (selectedContactId === contact.id) {
      setSelectedContactId('');
      setMobileDmThreadOpen(false);
    }
    notify(`Đã xóa "${contact.name}" khỏi danh bạ.`, 'info');
  };

  const handleSendDm = async () => {
    const text = dmDraft.trim();
    if (!text || !selectedContact || dmSending) return;
    if (!runtime.isReady) {
      notify(
        'Chưa có Proxy Endpoint để gửi tin. Mở "Cài đặt AI" ở trên hoặc tab Cấu hình để nhập.',
        'err',
      );
      return;
    }

    const now = Date.now();
    const mcMsg: ShowbizPhoneMessage = {
      id: `dm_mc_${now}`,
      senderId: 'mc',
      senderName: mcProfile.name,
      text,
      createdAt: now,
      isMc: true,
    };
    const nextHistory = [...selectedDmMessages, mcMsg];
    setDmDraft('');
    onUpdatePhone((prev) => ({
      ...prev,
      dmThreads: {
        ...prev.dmThreads,
        [selectedContact.id]: [...(prev.dmThreads[selectedContact.id] || []), mcMsg].slice(-120),
      },
      contacts: prev.contacts.map((c) =>
        c.id === selectedContact.id ? { ...c, lastActiveAt: now } : c,
      ),
    }));

    setDmSending(true);
    try {
      const res = await sendShowbizDmWithAi(
        state,
        selectedContact,
        nextHistory,
        text,
      );
      if (!res.ok || !res.reply) {
        notify(res.error || 'Không nhận được phản hồi DM.', 'err');
        return;
      }
      const replyTs = Date.now();
      const npcMsg: ShowbizPhoneMessage = {
        id: `dm_npc_${replyTs}`,
        senderId: selectedContact.id,
        senderName: selectedContact.name,
        text: res.reply,
        createdAt: replyTs,
        isMc: false,
      };
      onUpdatePhone((prev) => ({
        ...prev,
        dmThreads: {
          ...prev.dmThreads,
          [selectedContact.id]: [
            ...(prev.dmThreads[selectedContact.id] || []),
            npcMsg,
          ].slice(-120),
        },
        contacts: prev.contacts.map((c) =>
          c.id === selectedContact.id ? { ...c, lastActiveAt: replyTs } : c,
        ),
      }));
    } finally {
      setDmSending(false);
    }
  };

  // --- Handlers: Groups ---
  const handleCreateGroup = () => {
    const name = newGroupName.trim();
    if (!name) {
      notify('Vui lòng nhập tên nhóm chat.', 'err');
      return;
    }
    if (!newGroupMemberIds.length) {
      notify('Hãy chọn ít nhất 1 thành viên NPC trong danh bạ.', 'err');
      return;
    }
    const now = Date.now();
    const grp: ShowbizPhoneGroup = {
      id: `sb_grp_${now}`,
      name,
      topic: newGroupTopic.trim(),
      memberIds: newGroupMemberIds,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    onUpdatePhone((prev) => ({
      ...prev,
      groups: [grp, ...prev.groups],
    }));
    setSelectedGroupId(grp.id);
    setMobileGroupOpen(true);
    setCreateGroupOpen(false);
    setNewGroupName('');
    setNewGroupTopic('');
    setNewGroupMemberIds([]);
    notify(`Đã tạo nhóm "${name}".`, 'info');
  };

  const handleDeleteGroup = (group: ShowbizPhoneGroup) => {
    onUpdatePhone((prev) => ({
      ...prev,
      groups: prev.groups.filter((g) => g.id !== group.id),
    }));
    if (selectedGroupId === group.id) {
      setSelectedGroupId('');
      setMobileGroupOpen(false);
    }
    notify(`Đã xóa nhóm "${group.name}".`, 'info');
  };

  const handleSendGroupMessage = async (spontaneous = false) => {
    if (!selectedGroup || groupSending) return;
    if (!runtime.isReady) {
      notify(
        'Chưa có Proxy Endpoint để chat nhóm. Hãy cấu hình trong "Cài đặt AI".',
        'err',
      );
      return;
    }
    const members = selectedGroup.memberIds
      .map((id) => contactById.get(id))
      .filter((c): c is ShowbizPhoneContact => Boolean(c));
    if (!members.length) {
      notify('Nhóm hiện không còn thành viên NPC hợp lệ.', 'err');
      return;
    }

    const userText = spontaneous ? '' : groupDraft.trim();
    if (!spontaneous && !userText) return;

    const now = Date.now();
    let updatedGroupForAi = selectedGroup;
    if (!spontaneous && userText) {
      const mcMsg: ShowbizPhoneMessage = {
        id: `grp_mc_${now}`,
        senderId: 'mc',
        senderName: mcProfile.name,
        text: userText,
        createdAt: now,
        isMc: true,
      };
      setGroupDraft('');
      updatedGroupForAi = {
        ...selectedGroup,
        messages: [...selectedGroup.messages, mcMsg].slice(-140),
        updatedAt: now,
      };
      onUpdatePhone((prev) => ({
        ...prev,
        groups: prev.groups.map((g) =>
          g.id === selectedGroup.id
            ? {
                ...g,
                messages: [...g.messages, mcMsg].slice(-140),
                updatedAt: now,
              }
            : g,
        ),
      }));
    }

    setGroupSending(true);
    try {
      const res = await sendShowbizGroupMessageWithAi(
        state,
        updatedGroupForAi,
        members,
        userText || undefined,
      );
      if (!res.ok || !res.replies?.length) {
        notify(res.error || 'Không nhận được phản hồi nhóm.', 'err');
        return;
      }
      const baseTs = Date.now();
      const npcMsgs: ShowbizPhoneMessage[] = res.replies.map((r, idx) => ({
        id: `grp_npc_${baseTs}_${idx}`,
        senderId: r.contactId,
        senderName: r.senderName,
        text: r.text,
        createdAt: baseTs + idx * 500,
        isMc: false,
      }));
      onUpdatePhone((prev) => ({
        ...prev,
        groups: prev.groups.map((g) =>
          g.id === selectedGroup.id
            ? {
                ...g,
                messages: [...g.messages, ...npcMsgs].slice(-140),
                updatedAt: baseTs,
              }
            : g,
        ),
      }));
    } finally {
      setGroupSending(false);
    }
  };

  // --- Handlers: Social Feed (MXH) ---
  const handlePublishMcPost = async () => {
    const content = postDraft.trim();
    if (!content || socialBusy) return;
    const now = Date.now();
    const hashtags = postHashtags
      .split(/[\s,]+/)
      .map((h) => h.trim())
      .filter(Boolean)
      .map((h) => (h.startsWith('#') ? h : `#${h}`))
      .slice(0, 6);

    const newPost: ShowbizPhonePost = {
      id: `sb_post_mc_${now}`,
      authorId: 'mc',
      authorName: mcProfile.name,
      authorHandle: mcProfile.handle,
      authorRole: mcProfile.role,
      authorAvatarData: mcProfile.avatarData,
      isMc: true,
      content,
      locationTag: postLocation.trim(),
      hashtags,
      likes: 1,
      likedByMc: true,
      comments: [],
      createdAt: now,
    };

    setPostDraft('');
    setPostLocation('');
    setPostHashtags('');
    onUpdatePhone((prev) => ({
      ...prev,
      posts: [newPost, ...prev.posts].slice(0, 80),
    }));

    if (!runtime.isReady) return;
    setReactingPostId(newPost.id);
    try {
      const res = await requestShowbizPostReactionsWithAi(
        state,
        newPost,
        phone.contacts,
      );
      if (res.ok && res.comments?.length) {
        onUpdatePhone((prev) => ({
          ...prev,
          posts: prev.posts.map((p) =>
            p.id === newPost.id
              ? {
                  ...p,
                  likes: p.likes + (res.likeDelta || 0),
                  comments: [...p.comments, ...res.comments!],
                }
              : p,
          ),
        }));
      }
    } finally {
      setReactingPostId(null);
    }
  };

  const handleRefreshNpcFeed = async () => {
    if (socialBusy) return;
    if (!runtime.isReady) {
      notify(
        'Chưa có Proxy Endpoint để tạo bài đăng MXH. Mở "Cài đặt AI" để cấu hình.',
        'err',
      );
      return;
    }
    let activeContacts = phone.contacts;
    if (!activeContacts.length) {
      const synced = syncShowbizContactsFromCurrentSave(state, phone);
      if (synced.nextPhone.contacts.length) {
        onUpdatePhone(() => synced.nextPhone);
        activeContacts = synced.nextPhone.contacts;
      }
    }
    if (!activeContacts.length) {
      notify(
        'Chưa có NPC nào trong save hiện tại. Hãy đồng bộ NPC hoặc thêm liên hệ thủ công trước.',
        'err',
      );
      return;
    }
    setSocialBusy(true);
    try {
      const res = await generateShowbizNpcPostsWithAi(
        state,
        activeContacts,
        phone.posts,
      );
      if (!res.ok || !res.posts?.length) {
        notify(res.error || 'Không thể tải bài đăng mới.', 'err');
        return;
      }
      onUpdatePhone((prev) => ({
        ...prev,
        posts: [...res.posts!, ...prev.posts].slice(0, 80),
      }));
      notify(`Đã cập nhật ${res.posts.length} bài đăng mới trên MXH.`, 'info');
    } finally {
      setSocialBusy(false);
    }
  };

  const handleToggleLike = (postId: string) => {
    onUpdatePhone((prev) => ({
      ...prev,
      posts: prev.posts.map((p) => {
        if (p.id !== postId) return p;
        const nextLiked = !p.likedByMc;
        return {
          ...p,
          likedByMc: nextLiked,
          likes: Math.max(0, p.likes + (nextLiked ? 1 : -1)),
        };
      }),
    }));
  };

  const handleSubmitComment = async (post: ShowbizPhonePost) => {
    const text = (commentDrafts[post.id] || '').trim();
    if (!text || reactingPostId) return;
    const now = Date.now();
    const mcComment = {
      id: `sb_cm_mc_${now}`,
      authorId: 'mc',
      authorName: mcProfile.name,
      authorHandle: mcProfile.handle,
      text,
      createdAt: now,
      isMc: true,
    };
    setCommentDrafts((prev) => ({ ...prev, [post.id]: '' }));
    const updatedPost: ShowbizPhonePost = {
      ...post,
      comments: [...post.comments, mcComment],
    };
    onUpdatePhone((prev) => ({
      ...prev,
      posts: prev.posts.map((p) =>
        p.id === post.id ? { ...p, comments: [...p.comments, mcComment] } : p,
      ),
    }));

    if (!runtime.isReady) return;
    setReactingPostId(post.id);
    try {
      const res = await requestShowbizPostReactionsWithAi(
        state,
        updatedPost,
        phone.contacts,
        text,
      );
      if (res.ok && res.comments?.length) {
        onUpdatePhone((prev) => ({
          ...prev,
          posts: prev.posts.map((p) =>
            p.id === post.id
              ? {
                  ...p,
                  likes: p.likes + (res.likeDelta || 0),
                  comments: [...p.comments, ...res.comments!],
                }
              : p,
          ),
        }));
      }
    } finally {
      setReactingPostId(null);
    }
  };

  const handleAskMoreReactions = async (post: ShowbizPhonePost) => {
    if (reactingPostId || !runtime.isReady) return;
    setReactingPostId(post.id);
    try {
      const res = await requestShowbizPostReactionsWithAi(
        state,
        post,
        phone.contacts,
      );
      if (!res.ok) {
        notify(res.error || 'Không nhận được thêm phản ứng.', 'err');
        return;
      }
      onUpdatePhone((prev) => ({
        ...prev,
        posts: prev.posts.map((p) =>
          p.id === post.id
            ? {
                ...p,
                likes: p.likes + (res.likeDelta || 0),
                comments: [...p.comments, ...(res.comments || [])],
              }
            : p,
        ),
      }));
    } finally {
      setReactingPostId(null);
    }
  };

  const handleBridgePostToStory = (post: ShowbizPhonePost) => {
    const prompt = formatShowbizPostForStoryBridge(post, mcProfile.name);
    onUpdatePhone((prev) => ({
      ...prev,
      posts: prev.posts.map((p) =>
        p.id === post.id ? { ...p, bridgedToStoryAt: Date.now() } : p,
      ),
    }));
    onBridgeToStory(prompt);
  };

  const handleDeletePost = (postId: string) => {
    onUpdatePhone((prev) => ({
      ...prev,
      posts: prev.posts.filter((p) => p.id !== postId),
    }));
  };

  return (
    <div className="space-y-3.5">
      {/* Top Bar: Active Main Phone Owner + Save scope + AI Config summary + Sync / Junk / AI Settings */}
      <div className="space-y-3 rounded-2xl bg-[#141e30]/95 p-3.5 ring-1 ring-white/[0.08]">
        {/* Active Main Identity Strip */}
        <div
          className={`flex flex-wrap items-center justify-between gap-2.5 rounded-xl px-3 py-2 ring-1 ring-inset ${
            mcProfile.isGenericFallback
              ? 'bg-amber-500/10 ring-amber-400/25'
              : 'bg-sky-500/10 ring-sky-400/25'
          }`}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <ContactAvatar
              name={mcProfile.name}
              avatarData={mcProfile.avatarData}
              size="sm"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
                <span className="text-[11px] font-medium text-slate-400">
                  Đang cầm máy:
                </span>
                <span className="truncate font-bold text-slate-50">
                  {mcProfile.name}
                </span>
                <span className="rounded bg-sky-500/22 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-200 ring-1 ring-inset ring-sky-400/35">
                  Main
                </span>
                <span className="truncate text-[11px] text-slate-400">
                  {mcProfile.handle}
                </span>
              </div>
              <p className="truncate text-[11px] text-slate-400">
                {mcProfile.isGenericFallback
                  ? 'Chưa gắn thẻ Main trong Ảnh NV/NPC của save này — hãy gắn thẻ "Main" cho nhân vật chính để khóa danh tính.'
                  : `${mcProfile.sourceLabel}${mcProfile.role ? ` · ${mcProfile.role}` : ''}`}
              </p>
            </div>
          </div>
          <span className="text-[11px] font-medium text-sky-200/85">
            Mọi tin nhắn & bài đăng gửi từ {mcProfile.name}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-semibold text-slate-100">
              <span>{state.world?.name || 'Save hiện tại'}</span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-300 tabular-nums">
                {phone.contacts.length} liên hệ
              </span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-300 tabular-nums">
                {phone.groups.length} nhóm
              </span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-300 tabular-nums">
                {phone.posts.length} bài MXH
              </span>
            </div>
            <p className="truncate text-[11px] text-slate-400">
              AI độc lập:{' '}
              <span className="font-medium text-sky-300">
                {runtime.effectiveModel || 'Chưa chọn model'}
              </span>
              {' · '}
              {runtime.hasCustomEndpoint ? 'Endpoint riêng' : 'Endpoint chung'}
              {runtime.hasCustomModel ? ' · Model riêng' : ' · Model chung'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={handleSyncSaveNpcs}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-sky-500/16 px-3 text-xs font-semibold text-sky-200 ring-1 ring-inset ring-sky-400/30 transition-colors hover:bg-sky-500/24"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Đồng bộ NPC</span>
            </button>
            <button
              type="button"
              onClick={handleCleanJunkContacts}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-white/[0.055] px-3 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-white/[0.1]"
            >
              <Filter className="h-3.5 w-3.5 text-amber-300" />
              <span>Lọc tên rác</span>
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen((v) => !v)}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl px-3 text-xs font-semibold ring-1 ring-inset transition-colors ${
                settingsOpen
                  ? 'bg-amber-500/18 text-amber-200 ring-amber-400/35'
                  : 'bg-white/[0.055] text-slate-200 ring-white/[0.08] hover:bg-white/[0.1]'
              }`}
            >
              <Settings2 className="h-3.5 w-3.5" />
              <span>Cài đặt AI</span>
            </button>
          </div>
        </div>

        {/* Collapsible Dedicated AI Configuration */}
        {settingsOpen && (
          <div className="mt-3.5 space-y-3 border-t border-white/[0.08] pt-3.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-slate-100">
                  Cấu hình AI riêng cho Điện thoại Showbiz
                </h3>
                <p className="text-[11px] text-slate-400">
                  Để trống bất kỳ ô nào để tự động lấy theo cấu hình chung. Mọi
                  lượt gọi ở đây hoàn toàn độc lập với màn Truyện chính.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/[0.07] hover:text-slate-100"
                aria-label="Đóng cài đặt AI"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-[11px] font-semibold text-slate-300">
                  Model riêng (Slot Điện thoại)
                </span>
                <input
                  type="text"
                  value={cfgModel}
                  onChange={(e) => setCfgModel(e.target.value)}
                  placeholder={`Mặc định: ${state.config.model || 'gemini-2.5-flash'}`}
                  className="min-h-[40px] w-full rounded-xl bg-[#0d1524] px-3 text-xs text-slate-100 placeholder:text-slate-500 ring-1 ring-inset ring-white/[0.1] focus:outline-none focus:ring-sky-400/50"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-[11px] font-semibold text-slate-300">
                  Giao thức API
                </span>
                <select
                  value={cfgProtocol}
                  onChange={(e) =>
                    setCfgProtocol(e.target.value as ApiProtocol | '')
                  }
                  className="min-h-[40px] w-full rounded-xl bg-[#0d1524] px-3 text-xs text-slate-100 ring-1 ring-inset ring-white/[0.1] focus:outline-none focus:ring-sky-400/50"
                >
                  <option value="">
                    Theo cấu hình chung ({state.config.apiProtocol || 'openai'})
                  </option>
                  <option value="openai">OpenAI Compatible</option>
                  <option value="gemini">Google Gemini Native</option>
                  <option value="auto">Tự động phát hiện</option>
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-[11px] font-semibold text-slate-300">
                  Proxy Endpoint URL riêng
                </span>
                <input
                  type="url"
                  value={cfgUrl}
                  onChange={(e) => setCfgUrl(e.target.value)}
                  placeholder={
                    state.config.proxyUrl || 'https://.../v1/chat/completions'
                  }
                  className="min-h-[40px] w-full rounded-xl bg-[#0d1524] px-3 text-xs text-slate-100 placeholder:text-slate-500 ring-1 ring-inset ring-white/[0.1] focus:outline-none focus:ring-sky-400/50"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-[11px] font-semibold text-slate-300">
                  API Key riêng
                </span>
                <input
                  type="password"
                  value={cfgKey}
                  onChange={(e) => setCfgKey(e.target.value)}
                  placeholder="Để trống để dùng Key chung"
                  className="min-h-[40px] w-full rounded-xl bg-[#0d1524] px-3 text-xs text-slate-100 placeholder:text-slate-500 ring-1 ring-inset ring-white/[0.1] focus:outline-none focus:ring-sky-400/50"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={cfgUseProxy}
                  onChange={(e) => setCfgUseProxy(e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-[#0d1524] text-sky-400"
                />
                <span>Đi qua Server Proxy (/api/proxy) chống lỗi CORS</span>
              </label>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetAiConfig}
                  className="min-h-[36px] rounded-xl bg-white/[0.05] px-3 text-xs font-semibold text-slate-300 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.09]"
                >
                  Dùng mặc định chung
                </button>
                <button
                  type="button"
                  onClick={handleTestAiConnection}
                  disabled={testingConn}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-white/[0.07] px-3 text-xs font-semibold text-slate-100 ring-1 ring-inset ring-white/[0.12] hover:bg-white/[0.12] disabled:opacity-50"
                >
                  {testingConn ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Wifi className="h-3.5 w-3.5 text-emerald-300" />
                  )}
                  <span>Test kết nối</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveAiConfig}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-sky-500/24 px-3.5 text-xs font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/40 hover:bg-sky-500/32"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Lưu cấu hình</span>
                </button>
              </div>
            </div>

            {testResult && (
              <div
                className={`rounded-xl px-3 py-2 text-xs ring-1 ring-inset ${
                  testResult.ok
                    ? 'bg-emerald-500/12 text-emerald-200 ring-emerald-400/25'
                    : 'bg-rose-500/12 text-rose-200 ring-rose-400/25'
                }`}
              >
                {testResult.message}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Segmented Navigation: DM / Chat nhóm / MXH */}
      <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-[#101828] p-1.5 ring-1 ring-white/[0.08]">
        {(
          [
            {
              id: 'dm',
              label: 'Nhắn tin riêng',
              icon: MessageCircle,
              count: phone.contacts.length,
            },
            {
              id: 'groups',
              label: 'Chat nhóm',
              icon: Users,
              count: phone.groups.length,
            },
            {
              id: 'social',
              label: 'MXH',
              icon: Sparkles,
              count: phone.posts.length,
            },
          ] as const
        ).map((tab) => {
          const active = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-semibold transition-all ${
                active
                  ? 'bg-sky-500/22 text-sky-100 ring-1 ring-inset ring-sky-400/35'
                  : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{tab.label}</span>
              <span className="text-[11px] opacity-75 tabular-nums">
                ({tab.count})
              </span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: DM (1-ON-1) */}
      {activeTab === 'dm' && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          {/* Contact list column */}
          <div
            className={`space-y-2.5 rounded-2xl bg-[#131d2f]/95 p-3 ring-1 ring-white/[0.08] md:col-span-5 ${
              mobileDmThreadOpen && selectedContact ? 'hidden md:block' : 'block'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-200">
                Danh bạ trong save ({phone.contacts.length})
              </span>
              <button
                type="button"
                onClick={() => setAddContactOpen((v) => !v)}
                className="inline-flex min-h-[34px] items-center gap-1 rounded-xl bg-white/[0.06] px-2.5 text-[11px] font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.09] hover:bg-white/[0.11]"
              >
                <UserPlus className="h-3.5 w-3.5 text-sky-300" />
                <span>Thêm người</span>
              </button>
            </div>

            {addContactOpen && (
              <div className="space-y-2 rounded-xl bg-[#0d1524] p-2.5 ring-1 ring-white/[0.08]">
                <input
                  type="text"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  placeholder="Họ tên NPC (VD: Tô Hoài Cẩn)"
                  className="min-h-[38px] w-full rounded-lg bg-[#141e30] px-2.5 text-xs text-slate-100 placeholder:text-slate-500 ring-1 ring-inset ring-white/[0.08] focus:outline-none focus:ring-sky-400/50"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newContactRole}
                    onChange={(e) => setNewContactRole(e.target.value)}
                    placeholder="Vai trò (VD: Đạo diễn)"
                    className="min-h-[36px] w-full rounded-lg bg-[#141e30] px-2.5 text-xs text-slate-100 placeholder:text-slate-500 ring-1 ring-inset ring-white/[0.08] focus:outline-none"
                  />
                  <input
                    type="text"
                    value={newContactRelation}
                    onChange={(e) => setNewContactRelation(e.target.value)}
                    placeholder="Quan hệ với MC"
                    className="min-h-[36px] w-full rounded-lg bg-[#141e30] px-2.5 text-xs text-slate-100 placeholder:text-slate-500 ring-1 ring-inset ring-white/[0.08] focus:outline-none"
                  />
                </div>
                <div className="flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAddContactOpen(false)}
                    className="min-h-[34px] rounded-lg px-2.5 text-xs text-slate-400 hover:text-slate-200"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleAddManualContact}
                    className="min-h-[34px] rounded-lg bg-sky-500/24 px-3 text-xs font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/35 hover:bg-sky-500/32"
                  >
                    Lưu liên hệ
                  </button>
                </div>
              </div>
            )}

            {phone.contacts.length === 0 ? (
              <div className="rounded-xl bg-[#0d1524]/80 p-5 text-center ring-1 ring-white/[0.06]">
                <p className="text-xs font-semibold text-slate-200">
                  Chưa có liên hệ nào trong save này
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                  Bấm “Đồng bộ NPC” để kéo đúng các nhân vật đã gặp trong save
                  hiện tại, hoặc thêm thủ công.
                </p>
                <button
                  type="button"
                  onClick={handleSyncSaveNpcs}
                  className="mt-3 inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-sky-500/20 px-3.5 text-xs font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/35 hover:bg-sky-500/28"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Đồng bộ NPC từ save hiện tại</span>
                </button>
              </div>
            ) : (
              <div className="max-h-[420px] space-y-1.5 overflow-y-auto pr-0.5">
                {phone.contacts.map((c) => {
                  const msgs = phone.dmThreads[c.id] || [];
                  const lastMsg = msgs[msgs.length - 1];
                  const active = selectedContact?.id === c.id;
                  return (
                    <div
                      key={c.id}
                      className={`group flex items-center gap-2.5 rounded-xl p-2 transition-colors ${
                        active
                          ? 'bg-sky-500/14 ring-1 ring-inset ring-sky-400/30'
                          : 'bg-[#0e1625]/70 hover:bg-white/[0.05]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedContactId(c.id);
                          setMobileDmThreadOpen(true);
                        }}
                        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                      >
                        <ContactAvatar name={c.name} avatarData={c.avatarData} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="truncate text-xs font-semibold text-slate-100">
                              {c.name}
                            </span>
                            {lastMsg && (
                              <span className="shrink-0 text-[10px] text-slate-400">
                                {formatRelativeTime(lastMsg.createdAt)}
                              </span>
                            )}
                          </div>
                          <p className="truncate text-[11px] text-slate-400">
                            {lastMsg
                              ? `${lastMsg.isMc ? `${mcProfile.name}: ` : ''}${lastMsg.text}`
                              : c.role || c.relation || c.handle}
                          </p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteContact(c)}
                        title="Xóa liên hệ này"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 opacity-75 hover:bg-rose-500/15 hover:text-rose-300 hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active DM Thread column */}
          <div
            className={`flex min-h-[420px] flex-col rounded-2xl bg-[#131d2f]/95 ring-1 ring-white/[0.08] md:col-span-7 ${
              mobileDmThreadOpen && selectedContact ? 'flex' : 'hidden md:flex'
            }`}
          >
            {selectedContact ? (
              <>
                <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] px-3.5 py-2.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setMobileDmThreadOpen(false)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] text-slate-200 md:hidden"
                      aria-label="Quay lại danh bạ"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <ContactAvatar
                      name={selectedContact.name}
                      avatarData={selectedContact.avatarData}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <div className="truncate text-xs font-bold text-slate-100">
                        {selectedContact.name}
                      </div>
                      <div className="truncate text-[11px] text-slate-400">
                        {[selectedContact.role, selectedContact.relation, selectedContact.handle]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                  </div>

                  {selectedDmMessages.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        onUpdatePhone((prev) => ({
                          ...prev,
                          dmThreads: {
                            ...prev.dmThreads,
                            [selectedContact.id]: [],
                          },
                        }))
                      }
                      className="min-h-[32px] rounded-lg px-2 text-[11px] font-medium text-slate-400 hover:bg-white/[0.06] hover:text-rose-300"
                    >
                      Xóa đoạn chat
                    </button>
                  )}
                </div>

                <div className="flex-1 space-y-2.5 overflow-y-auto p-3.5 max-h-[380px]">
                  {selectedDmMessages.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-400">
                      Bắt đầu nhắn tin riêng với{' '}
                      <span className="font-semibold text-slate-200">
                        {selectedContact.name}
                      </span>
                      . Tin nhắn được lưu riêng theo save này.
                    </div>
                  ) : (
                    selectedDmMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${
                          msg.isMc ? 'items-end' : 'items-start'
                        }`}
                      >
                        <div
                          className={`max-w-[84%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed whitespace-pre-wrap break-words ${
                            msg.isMc
                              ? 'bg-sky-500/24 text-sky-50 ring-1 ring-inset ring-sky-400/30'
                              : 'bg-[#0d1524] text-slate-100 ring-1 ring-inset ring-white/[0.08]'
                          }`}
                        >
                          {msg.text}
                        </div>
                        <span className="mt-1 px-1 text-[10px] text-slate-500">
                          {formatRelativeTime(msg.createdAt)}
                        </span>
                      </div>
                    ))
                  )}
                  {dmSending && (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-300" />
                      <span>{selectedContact.name} đang soạn tin...</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-white/[0.08] p-2.5">
                  <div className="flex items-end gap-2">
                    <textarea
                      rows={1}
                      value={dmDraft}
                      onChange={(e) => setDmDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          void handleSendDm();
                        }
                      }}
                      placeholder={`Nhắn cho ${selectedContact.name} với tư cách ${mcProfile.name}...`}
                      className="min-h-[42px] max-h-28 flex-1 resize-none rounded-xl bg-[#0d1524] px-3 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 ring-1 ring-inset ring-white/[0.1] focus:outline-none focus:ring-sky-400/50"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSendDm()}
                      disabled={!dmDraft.trim() || dmSending}
                      className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-sky-500/24 text-sky-100 ring-1 ring-inset ring-sky-400/35 hover:bg-sky-500/32 disabled:opacity-45"
                      aria-label="Gửi tin nhắn riêng"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-xs text-slate-400">
                <MessageSquare className="mb-2 h-7 w-7 text-slate-600" />
                <p>Chọn một NPC bên trái để bắt đầu nhắn tin riêng.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: GROUP CHAT */}
      {activeTab === 'groups' && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          {/* Group list column */}
          <div
            className={`space-y-2.5 rounded-2xl bg-[#131d2f]/95 p-3 ring-1 ring-white/[0.08] md:col-span-5 ${
              mobileGroupOpen && selectedGroup ? 'hidden md:block' : 'block'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-200">
                Nhóm chat ({phone.groups.length})
              </span>
              <button
                type="button"
                onClick={() => setCreateGroupOpen((v) => !v)}
                className="inline-flex min-h-[34px] items-center gap-1 rounded-xl bg-sky-500/18 px-2.5 text-[11px] font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/30 hover:bg-sky-500/26"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Tạo nhóm</span>
              </button>
            </div>

            {createGroupOpen && (
              <div className="space-y-2.5 rounded-xl bg-[#0d1524] p-3 ring-1 ring-white/[0.08]">
                <div className="flex flex-wrap gap-1.5">
                  {GROUP_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.name}
                      type="button"
                      onClick={() => {
                        setNewGroupName(tpl.name);
                        setNewGroupTopic(tpl.topic);
                      }}
                      className="min-h-[30px] rounded-lg bg-white/[0.06] px-2 text-[11px] text-slate-300 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.11]"
                    >
                      {tpl.name}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Tên nhóm (VD: Đoàn phim Khúc Tương Tư)"
                  className="min-h-[38px] w-full rounded-lg bg-[#141e30] px-2.5 text-xs text-slate-100 placeholder:text-slate-500 ring-1 ring-inset ring-white/[0.08] focus:outline-none"
                />
                <input
                  type="text"
                  value={newGroupTopic}
                  onChange={(e) => setNewGroupTopic(e.target.value)}
                  placeholder="Chủ đề nhóm (tùy chọn)"
                  className="min-h-[36px] w-full rounded-lg bg-[#141e30] px-2.5 text-xs text-slate-100 placeholder:text-slate-500 ring-1 ring-inset ring-white/[0.08] focus:outline-none"
                />
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-slate-300">
                    Chọn thành viên từ danh bạ save này:
                  </span>
                  {phone.contacts.length === 0 ? (
                    <p className="text-[11px] text-amber-300">
                      Chưa có NPC trong danh bạ. Hãy bấm “Đồng bộ NPC” ở trên.
                    </p>
                  ) : (
                    <div className="max-h-36 space-y-1 overflow-y-auto pr-1">
                      {phone.contacts.map((c) => {
                        const checked = newGroupMemberIds.includes(c.id);
                        return (
                          <label
                            key={c.id}
                            className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${
                              checked
                                ? 'bg-sky-500/16 text-sky-100'
                                : 'text-slate-300 hover:bg-white/[0.04]'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setNewGroupMemberIds((prev) =>
                                  prev.includes(c.id)
                                    ? prev.filter((id) => id !== c.id)
                                    : [...prev, c.id],
                                )
                              }
                              className="h-3.5 w-3.5 rounded"
                            />
                            <span className="truncate font-medium">{c.name}</span>
                            {c.role && (
                              <span className="truncate text-[10px] text-slate-400">
                                · {c.role}
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCreateGroupOpen(false)}
                    className="min-h-[34px] rounded-lg px-2.5 text-xs text-slate-400"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateGroup}
                    className="min-h-[34px] rounded-lg bg-sky-500/24 px-3 text-xs font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/35"
                  >
                    Tạo nhóm
                  </button>
                </div>
              </div>
            )}

            {phone.groups.length === 0 ? (
              <div className="rounded-xl bg-[#0d1524]/80 p-5 text-center ring-1 ring-white/[0.06]">
                <p className="text-xs font-semibold text-slate-200">
                  Chưa có nhóm chat nào
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Tạo nhóm đoàn phim, hậu trường hoặc hội bạn thân để nhiều NPC
                  cùng tương tác theo tính cách.
                </p>
              </div>
            ) : (
              <div className="max-h-[400px] space-y-1.5 overflow-y-auto">
                {phone.groups.map((grp) => {
                  const lastMsg = grp.messages[grp.messages.length - 1];
                  const active = selectedGroup?.id === grp.id;
                  return (
                    <div
                      key={grp.id}
                      className={`flex items-center gap-2 rounded-xl p-2.5 transition-colors ${
                        active
                          ? 'bg-sky-500/14 ring-1 ring-inset ring-sky-400/30'
                          : 'bg-[#0e1625]/70 hover:bg-white/[0.05]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedGroupId(grp.id);
                          setMobileGroupOpen(true);
                        }}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-semibold text-slate-100">
                            {grp.name}
                          </span>
                          <span className="shrink-0 text-[10px] text-slate-400 tabular-nums">
                            {grp.memberIds.length + 1} TV
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-slate-400">
                          {lastMsg
                            ? `${lastMsg.isMc ? mcProfile.name : lastMsg.senderName}: ${lastMsg.text}`
                            : grp.topic || 'Chưa có tin nhắn'}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteGroup(grp)}
                        title="Xóa nhóm"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-rose-500/15 hover:text-rose-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active Group Room */}
          <div
            className={`flex min-h-[420px] flex-col rounded-2xl bg-[#131d2f]/95 ring-1 ring-white/[0.08] md:col-span-7 ${
              mobileGroupOpen && selectedGroup ? 'flex' : 'hidden md:flex'
            }`}
          >
            {selectedGroup ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] px-3.5 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMobileGroupOpen(false)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] text-slate-200 md:hidden"
                      aria-label="Quay lại danh sách nhóm"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-bold text-slate-100">
                        {selectedGroup.name}
                      </div>
                      <div className="truncate text-[11px] text-slate-400">
                        {selectedGroup.memberIds
                          .map((id) => contactById.get(id)?.name)
                          .filter(Boolean)
                          .join(', ') || 'Chưa có thành viên'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleSendGroupMessage(true)}
                    disabled={groupSending}
                    className="inline-flex min-h-[34px] items-center gap-1.5 rounded-xl bg-white/[0.06] px-2.5 text-[11px] font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.09] hover:bg-white/[0.11] disabled:opacity-45"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                    <span>Gợi chuyện nhóm</span>
                  </button>
                </div>

                <div className="flex-1 space-y-2.5 overflow-y-auto p-3.5 max-h-[380px]">
                  {selectedGroup.messages.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-400">
                      Nhắn tin mở đầu hoặc bấm “Gợi chuyện nhóm” để các thành
                      viên bắt đầu trao đổi.
                    </div>
                  ) : (
                    selectedGroup.messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${
                          msg.isMc ? 'items-end' : 'items-start'
                        }`}
                      >
                        {!msg.isMc && (
                          <span className="mb-0.5 px-1 text-[10px] font-semibold text-sky-300">
                            {msg.senderName}
                          </span>
                        )}
                        <div
                          className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed whitespace-pre-wrap break-words ${
                            msg.isMc
                              ? 'bg-sky-500/24 text-sky-50 ring-1 ring-inset ring-sky-400/30'
                              : 'bg-[#0d1524] text-slate-100 ring-1 ring-inset ring-white/[0.08]'
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    ))
                  )}
                  {groupSending && (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-300" />
                      <span>Các thành viên đang nhắn trong nhóm...</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-white/[0.08] p-2.5">
                  <div className="flex items-end gap-2">
                    <textarea
                      rows={1}
                      value={groupDraft}
                      onChange={(e) => setGroupDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          void handleSendGroupMessage(false);
                        }
                      }}
                      placeholder={`Nhắn vào "${selectedGroup.name}" với tư cách ${mcProfile.name}...`}
                      className="min-h-[42px] max-h-28 flex-1 resize-none rounded-xl bg-[#0d1524] px-3 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 ring-1 ring-inset ring-white/[0.1] focus:outline-none focus:ring-sky-400/50"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSendGroupMessage(false)}
                      disabled={!groupDraft.trim() || groupSending}
                      className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-sky-500/24 text-sky-100 ring-1 ring-inset ring-sky-400/35 hover:bg-sky-500/32 disabled:opacity-45"
                      aria-label="Gửi tin nhắn nhóm"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-xs text-slate-400">
                <Users className="mb-2 h-7 w-7 text-slate-600" />
                <p>Chọn hoặc tạo một nhóm chat bên trái.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: MXH (SOCIAL FEED) */}
      {activeTab === 'social' && (
        <div className="space-y-3">
          {/* MC Post Composer */}
          <div className="space-y-2.5 rounded-2xl bg-[#131d2f]/95 p-3.5 ring-1 ring-white/[0.08]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ContactAvatar
                  name={mcProfile.name}
                  avatarData={mcProfile.avatarData}
                  size="sm"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-100">
                    {mcProfile.name}
                  </span>{' '}
                  <span className="text-slate-400">{mcProfile.handle}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleRefreshNpcFeed()}
                disabled={socialBusy}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-white/[0.06] px-3 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.09] hover:bg-white/[0.11] disabled:opacity-45"
              >
                {socialBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-300" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 text-sky-300" />
                )}
                <span>NPC đăng bài mới</span>
              </button>
            </div>

            <textarea
              rows={2}
              value={postDraft}
              onChange={(e) => setPostDraft(e.target.value)}
              placeholder="Bạn đang nghĩ gì? Đăng status để các NPC trong save vào tương tác..."
              className="w-full resize-none rounded-xl bg-[#0d1524] p-3 text-xs leading-relaxed text-slate-100 placeholder:text-slate-500 ring-1 ring-inset ring-white/[0.09] focus:outline-none focus:ring-sky-400/50"
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-1 flex-wrap gap-2">
                <input
                  type="text"
                  value={postLocation}
                  onChange={(e) => setPostLocation(e.target.value)}
                  placeholder="Địa điểm (tùy chọn)"
                  className="min-h-[36px] flex-1 min-w-[130px] rounded-xl bg-[#0d1524] px-2.5 text-xs text-slate-200 placeholder:text-slate-500 ring-1 ring-inset ring-white/[0.08] focus:outline-none"
                />
                <input
                  type="text"
                  value={postHashtags}
                  onChange={(e) => setPostHashtags(e.target.value)}
                  placeholder="#hashtag (tùy chọn)"
                  className="min-h-[36px] flex-1 min-w-[130px] rounded-xl bg-[#0d1524] px-2.5 text-xs text-slate-200 placeholder:text-slate-500 ring-1 ring-inset ring-white/[0.08] focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={() => void handlePublishMcPost()}
                disabled={!postDraft.trim() || socialBusy}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-sky-500/24 px-4 text-xs font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/35 hover:bg-sky-500/32 disabled:opacity-45"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Đăng bài</span>
              </button>
            </div>
          </div>

          {/* Feed Stream */}
          {phone.posts.length === 0 ? (
            <div className="rounded-2xl bg-[#131d2f]/80 p-6 text-center ring-1 ring-white/[0.07]">
              <p className="text-xs font-semibold text-slate-200">
                Bảng tin MXH của save này đang trống
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                Đăng bài viết đầu tiên của bạn hoặc bấm “NPC đăng bài mới” để
                xem hoạt động hậu trường của các nhân vật đã gặp.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {phone.posts.map((post) => {
                const isReacting = reactingPostId === post.id;
                return (
                  <article
                    key={post.id}
                    className="space-y-2.5 rounded-2xl bg-[#131d2f]/95 p-3.5 ring-1 ring-white/[0.08]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <ContactAvatar
                          name={post.isMc ? mcProfile.name : post.authorName}
                          avatarData={
                            post.isMc
                              ? mcProfile.avatarData || post.authorAvatarData
                              : post.authorAvatarData
                          }
                          size="sm"
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-1.5 text-xs">
                            <span className="font-bold text-slate-100">
                              {post.isMc ? mcProfile.name : post.authorName}
                            </span>
                            <span className="text-slate-400">
                              {post.isMc ? mcProfile.handle : post.authorHandle}
                            </span>
                            {(post.isMc ? mcProfile.role : post.authorRole) && (
                              <>
                                <span className="text-slate-600">·</span>
                                <span className="text-[11px] text-slate-400">
                                  {post.isMc ? mcProfile.role : post.authorRole}
                                </span>
                              </>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {formatRelativeTime(post.createdAt)}
                            {post.locationTag ? ` · ${post.locationTag}` : ''}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeletePost(post.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-white/[0.06] hover:text-rose-300"
                        title="Xóa bài đăng"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <p className="text-xs leading-relaxed whitespace-pre-wrap text-slate-100">
                      {post.content}
                    </p>

                    {post.hashtags && post.hashtags.length > 0 && (
                      <div className="flex flex-wrap gap-x-2 gap-y-1 text-[11px] font-medium text-sky-300">
                        {post.hashtags.map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
                    )}

                    {/* Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.07] pt-2.5">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleLike(post.id)}
                          className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold transition-colors tabular-nums ${
                            post.likedByMc
                              ? 'bg-rose-500/16 text-rose-200 ring-1 ring-inset ring-rose-400/30'
                              : 'bg-white/[0.05] text-slate-300 hover:bg-white/[0.09]'
                          }`}
                        >
                          <Heart
                            className={`h-3.5 w-3.5 ${
                              post.likedByMc ? 'fill-rose-400 text-rose-400' : ''
                            }`}
                          />
                          <span>{post.likes}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleAskMoreReactions(post)}
                          disabled={isReacting}
                          className="inline-flex min-h-[34px] items-center gap-1.5 rounded-xl bg-white/[0.05] px-2.5 text-xs font-medium text-slate-300 hover:bg-white/[0.09] disabled:opacity-45"
                        >
                          {isReacting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-300" />
                          ) : (
                            <MessageCircle className="h-3.5 w-3.5 text-sky-300" />
                          )}
                          <span>Thêm phản ứng ({post.comments.length})</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleBridgePostToStory(post)}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-xl bg-emerald-500/16 px-3 text-xs font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-400/30 transition-colors hover:bg-emerald-500/24"
                      >
                        <ArrowUpRight className="h-3.5 w-3.5" />
                        <span>
                          {post.bridgedToStoryAt
                            ? 'Đưa lại vào truyện'
                            : 'Đưa vào truyện'}
                        </span>
                      </button>
                    </div>

                    {/* Comments */}
                    {post.comments.length > 0 && (
                      <div className="space-y-1.5 rounded-xl bg-[#0d1524]/90 p-2.5 ring-1 ring-white/[0.05]">
                        {post.comments.map((cm) => (
                          <div key={cm.id} className="text-xs leading-relaxed">
                            <span
                              className={`font-semibold ${
                                cm.isMc ? 'text-sky-300' : 'text-slate-100'
                              }`}
                            >
                              {cm.isMc ? mcProfile.name : cm.authorName}
                            </span>
                            <span className="text-slate-500">: </span>
                            <span className="text-slate-300">{cm.text}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Inline MC Comment Input */}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={commentDrafts[post.id] || ''}
                        onChange={(e) =>
                          setCommentDrafts((prev) => ({
                            ...prev,
                            [post.id]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void handleSubmitComment(post);
                          }
                        }}
                        placeholder="Viết bình luận..."
                        className="min-h-[38px] flex-1 rounded-xl bg-[#0d1524] px-3 text-xs text-slate-100 placeholder:text-slate-500 ring-1 ring-inset ring-white/[0.08] focus:outline-none focus:ring-sky-400/50"
                      />
                      <button
                        type="button"
                        onClick={() => void handleSubmitComment(post)}
                        disabled={
                          !(commentDrafts[post.id] || '').trim() || isReacting
                        }
                        className="inline-flex min-h-[38px] items-center justify-center rounded-xl bg-white/[0.07] px-3 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/[0.1] hover:bg-white/[0.12] disabled:opacity-40"
                      >
                        Gửi
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
