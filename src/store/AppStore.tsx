import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  chats as initialChats,
  DEMO_USER,
  notices as initialNotices,
  personById,
  productById,
  REQUEST_FLOW,
  requests as initialRequests,
  visits as initialVisits,
  type Chat,
  type Notice,
  type RequestItem,
  type RequestType,
  type Role,
  type Visit,
} from '@/data/mock';

// Registro local de eventos de interacción (similar a eventos de GA4).
// Sirve para pruebas controladas de usabilidad; no son métricas reales de producción.
export interface UxEvent {
  name: string;
  detail?: string;
  t: number;
}

interface AppState {
  role: Role | null;
  userId: string | null;
  requests: RequestItem[];
  chats: Chat[];
  visits: Visit[];
  notices: Notice[];
  events: UxEvent[];
  login: (role: Role) => void;
  logout: () => void;
  logEvent: (name: string, detail?: string) => void;
  createRequest: (input: { productId: string; type: RequestType; notes: string; repId?: string }) => string;
  advanceRequest: (id: string) => void;
  cancelRequest: (id: string) => void;
  sendMessage: (chatId: string, text: string, productId?: string) => void;
  markChatRead: (chatId: string) => void;
  chatWith: (otherId: string) => string;
  setVisitStatus: (id: string, status: Visit['status']) => void;
  setVisitNotes: (id: string, notes: string) => void;
  markNoticeRead: (id: string) => void;
  markAllNoticesRead: () => void;
}

const Ctx = createContext<AppState | null>(null);

const nowLabel = () =>
  new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false });

export function AppProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role | null>(null);
  const [requests, setRequests] = useState(initialRequests);
  const [chats, setChats] = useState(initialChats);
  const [visits, setVisits] = useState(initialVisits);
  const [notices, setNotices] = useState(initialNotices);
  const [events, setEvents] = useState<UxEvent[]>([]);

  const userId = role ? DEMO_USER[role] : null;

  const logEvent = useCallback((name: string, detail?: string) => {
    setEvents((e) => [...e, { name, detail, t: Date.now() }]);
  }, []);

  const pushNotice = useCallback((n: Omit<Notice, 'id' | 'read' | 'at'>) => {
    setNotices((list) => [{ ...n, id: `n${Date.now()}${Math.random()}`, read: false, at: 'Ahora' }, ...list]);
  }, []);

  const login = useCallback(
    (r: Role) => {
      setRole(r);
      logEvent('login', r);
    },
    [logEvent],
  );

  const logout = useCallback(() => setRole(null), []);

  const createRequest: AppState['createRequest'] = useCallback(
    ({ productId, type, notes, repId = 'v1' }) => {
      const id = `r${Date.now()}`;
      const code = `SOL-${String(146 + Math.floor(Math.random() * 800)).padStart(4, '0')}`;
      const item: RequestItem = {
        id,
        code,
        productId,
        type,
        notes,
        doctorId: userId ?? 'm1',
        repId,
        status: 'Pendiente',
        history: [{ status: 'Pendiente', at: 'Ahora' }],
        createdAt: 'Ahora',
      };
      setRequests((r) => [item, ...r]);
      const product = productById(productId);
      pushNotice({
        forRole: 'visitador',
        kind: 'solicitud',
        title: `Nueva solicitud de ${personById(item.doctorId).name}`,
        body: `${type} · ${product?.name ?? ''}`,
        href: `/solicitud/${id}`,
      });
      logEvent('solicitud_creada', type);
      return id;
    },
    [userId, pushNotice, logEvent],
  );

  const advanceRequest = useCallback(
    (id: string) => {
      const r = requests.find((x) => x.id === id);
      if (!r) return;
      const i = REQUEST_FLOW.indexOf(r.status);
      if (i < 0 || i === REQUEST_FLOW.length - 1) return;
      const next = REQUEST_FLOW[i + 1];
      setRequests((list) =>
        list.map((x) =>
          x.id === id ? { ...x, status: next, history: [...x.history, { status: next, at: 'Ahora' }] } : x,
        ),
      );
      pushNotice({
        forRole: 'medico',
        kind: 'solicitud',
        title: `Solicitud ${r.code}: ${next}`,
        body: 'Su solicitud cambió de estado.',
        href: `/solicitud/${r.id}`,
      });
      logEvent('solicitud_estado', next);
    },
    [requests, pushNotice, logEvent],
  );

  const cancelRequest = useCallback((id: string) => {
    setRequests((list) =>
      list.map((r) =>
        r.id === id
          ? { ...r, status: 'Cancelada', history: [...r.history, { status: 'Cancelada', at: 'Ahora' }] }
          : r,
      ),
    );
  }, []);

  const sendMessage = useCallback(
    (chatId: string, text: string, productId?: string) => {
      if (!userId) return;
      setChats((list) =>
        list.map((c) =>
          c.id === chatId
            ? {
                ...c,
                messages: [...c.messages, { id: `${chatId}-${Date.now()}`, from: userId, text, at: nowLabel(), productId }],
              }
            : c,
        ),
      );
      logEvent(productId ? 'ficha_compartida' : 'mensaje_enviado');
    },
    [userId, logEvent],
  );

  const markChatRead = useCallback(
    (chatId: string) => {
      if (!userId) return;
      setChats((list) =>
        list.map((c) => (c.id === chatId ? { ...c, unreadFor: { ...c.unreadFor, [userId]: 0 } } : c)),
      );
    },
    [userId],
  );

  const chatWith = useCallback(
    (otherId: string) => {
      const me = userId ?? 'm1';
      const existing = chats.find((c) => c.members.includes(me) && c.members.includes(otherId));
      if (existing) return existing.id;
      const id = `c${Date.now()}`;
      setChats((list) => [...list, { id, members: [me, otherId], messages: [], unreadFor: { [me]: 0, [otherId]: 0 } }]);
      return id;
    },
    [chats, userId],
  );

  const setVisitStatus = useCallback(
    (id: string, status: Visit['status']) => {
      setVisits((list) => list.map((v) => (v.id === id ? { ...v, status } : v)));
      logEvent('visita_estado', status);
    },
    [logEvent],
  );

  const setVisitNotes = useCallback((id: string, notes: string) => {
    setVisits((list) => list.map((v) => (v.id === id ? { ...v, notes } : v)));
  }, []);

  const markNoticeRead = useCallback((id: string) => {
    setNotices((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllNoticesRead = useCallback(() => {
    setNotices((list) => list.map((n) => (n.forRole === role || n.forRole === 'all' ? { ...n, read: true } : n)));
  }, [role]);

  const value = useMemo<AppState>(
    () => ({
      role,
      userId,
      requests,
      chats,
      visits,
      notices,
      events,
      login,
      logout,
      logEvent,
      createRequest,
      advanceRequest,
      cancelRequest,
      sendMessage,
      markChatRead,
      chatWith,
      setVisitStatus,
      setVisitNotes,
      markNoticeRead,
      markAllNoticesRead,
    }),
    [role, userId, requests, chats, visits, notices, events, login, logout, logEvent, createRequest, advanceRequest, cancelRequest, sendMessage, markChatRead, chatWith, setVisitStatus, setVisitNotes, markNoticeRead, markAllNoticesRead],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp debe usarse dentro de AppProvider');
  return ctx;
}

/** Datos derivados para el usuario actual */
export function useMine() {
  const app = useApp();
  const me = app.userId;
  const myRequests = app.requests.filter((r) => (app.role === 'medico' ? r.doctorId === me : r.repId === me));
  const myChats = app.chats.filter((c) => me && c.members.includes(me));
  const myNotices = app.notices.filter((n) => n.forRole === app.role || n.forRole === 'all');
  const unreadNotices = myNotices.filter((n) => !n.read).length;
  const unreadMessages = myChats.reduce((s, c) => s + (me ? c.unreadFor[me] ?? 0 : 0), 0);
  const myVisits = app.visits.filter((v) => (app.role === 'medico' ? v.doctorId === me : true));
  return { ...app, myRequests, myChats, myNotices, unreadNotices, unreadMessages, myVisits };
}
