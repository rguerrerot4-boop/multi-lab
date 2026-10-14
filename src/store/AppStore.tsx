import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  chats as initialChats,
  DEMO_USER,
  emptyReport,
  deliveredTotal,
  INITIAL_KIT,
  initialDoctorStatus,
  initialNeeds,
  initialReturns,
  RETURN_FLOW,
  type ReturnItem,
  matchProducts,
  type DoctorStatus,
  type NeedUrgency,
  type ProductNeed,
  type DeliveryKind,
  type VisitReport,
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
  kit: Record<string, Record<DeliveryKind, number>>;
  activeVisitId: string | null;
  startVisit: (id: string) => void;
  addUnscheduledVisit: (doctorId: string) => string;
  updateReport: (id: string, fn: (r: VisitReport) => VisitReport) => void;
  finishVisit: (id: string, patch?: Partial<VisitReport>) => void;
  discardVisit: (id: string) => void;
  doctorStatus: Record<string, DoctorStatus>;
  setMyStatus: (status: Omit<DoctorStatus, 'at'>) => void;
  needs: ProductNeed[];
  createNeed: (input: { keywords: string[]; note: string; urgency: NeedUrgency }) => string;
  markNeedSeen: (id: string) => void;
  respondNeed: (id: string, response: string) => void;
  returns: ReturnItem[];
  createReturn: (input: Omit<ReturnItem, 'id' | 'code' | 'doctorId' | 'repId' | 'status' | 'history' | 'createdAt'>) => string;
  advanceReturn: (id: string, note?: string) => void;
  cancelReturn: (id: string) => void;
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
  const [kit, setKit] = useState(INITIAL_KIT);
  const [activeVisitId, setActiveVisitId] = useState<string | null>(null);
  const [doctorStatus, setDoctorStatus] = useState(initialDoctorStatus);
  const [needs, setNeeds] = useState(initialNeeds);
  const [returns, setReturns] = useState(initialReturns);

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

  const logout = useCallback(() => {
    setRole(null);
  }, []);

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

  // ---------- Visita en curso ----------
  const startVisit = useCallback(
    (id: string) => {
      setVisits((list) =>
        list.map((v) =>
          v.id === id
            ? { ...v, status: 'En curso', report: v.report && !v.report.endedAt ? v.report : emptyReport(v.productIds) }
            : v,
        ),
      );
      setActiveVisitId(id);
      logEvent('visita_iniciada', id);
    },
    [logEvent],
  );

  const addUnscheduledVisit = useCallback((doctorId: string) => {
    const doc = personById(doctorId);
    const id = `vs${Date.now()}`;
    const now = nowLabel();
    setVisits((list) => [
      ...list,
      {
        id,
        doctorId,
        dayOffset: 0,
        time: now,
        place: doc.org.replace(' (ficticio)', ''),
        address: `${doc.city} (dirección ficticia)`,
        status: 'Programada',
        productIds: [],
        notes: 'Visita sin cita previa.',
        lat: -2.17,
        lon: -79.92,
      },
    ]);
    return id;
  }, []);

  const updateReport = useCallback((id: string, fn: (r: VisitReport) => VisitReport) => {
    setVisits((list) => list.map((v) => (v.id === id && v.report ? { ...v, report: fn(v.report) } : v)));
  }, []);

  const finishVisit = useCallback(
    (id: string, patch?: Partial<VisitReport>) => {
      const v = visits.find((x) => x.id === id);
      if (!v?.report) return;
      const report: VisitReport = { ...v.report, ...patch, endedAt: Date.now() };
      setVisits((list) =>
        list.map((x) =>
          x.id === id
            ? { ...x, status: 'Realizada', report, productIds: Array.from(new Set([...x.productIds, ...report.presented, ...Object.keys(report.deliveries)])) }
            : x,
        ),
      );
      setKit((k) => {
        const next = { ...k };
        for (const [pid, d] of Object.entries(report.deliveries)) {
          const cur = next[pid];
          if (!cur) continue;
          next[pid] = {
            muestra: Math.max(0, cur.muestra - (d.muestra ?? 0)),
            impreso: Math.max(0, cur.impreso - (d.impreso ?? 0)),
            digital: cur.digital,
          };
        }
        return next;
      });
      setActiveVisitId((a) => (a === id ? null : a));
      const total = deliveredTotal(report);
      pushNotice({
        forRole: 'medico',
        kind: 'visita',
        title: 'Visita registrada',
        body: `${personById('v1').name} registró la visita${total ? ` y ${total} ${total === 1 ? 'material entregado' : 'materiales entregados'}` : ''}. Firmaste el acuse de recibo.`,
        href: `/visita/${id}`,
      });
      logEvent('visita_finalizada', `${id} · ${total} entregados`);
    },
    [visits, pushNotice, logEvent],
  );

  const discardVisit = useCallback(
    (id: string) => {
      setVisits((list) => list.map((v) => (v.id === id ? { ...v, status: 'Programada', report: undefined } : v)));
      setActiveVisitId((a) => (a === id ? null : a));
      logEvent('visita_descartada', id);
    },
    [logEvent],
  );

  // ---------- Estado del médico y necesidades de producto ----------
  const setMyStatus = useCallback(
    (st: Omit<DoctorStatus, 'at'>) => {
      const me = userId ?? 'm1';
      setDoctorStatus((m) => ({ ...m, [me]: { ...st, at: Date.now() } }));
      logEvent('estado_medico', st.state);
    },
    [userId, logEvent],
  );

  const createNeed = useCallback(
    ({ keywords, note, urgency }: { keywords: string[]; note: string; urgency: NeedUrgency }) => {
      const doctorId = userId ?? 'm1';
      const id = `nd${Date.now()}`;
      setNeeds((list) => [{ id, doctorId, keywords, note, urgency, status: 'Enviada', createdAt: Date.now() }, ...list]);
      const matches = matchProducts(keywords);
      pushNotice({
        forRole: 'visitador',
        kind: 'producto',
        title: `${personById(doctorId).name} solicita un producto`,
        body: matches.length
          ? `Palabras clave: “${keywords.join(', ')}”. Coincide con tu producto ${matches[0].product.name}${matches.length > 1 ? ` y ${matches.length - 1} más` : ''}.`
          : `Palabras clave: “${keywords.join(', ')}”. No coincide con tus productos.`,
        href: `/necesidad/${id}`,
      });
      logEvent('necesidad_creada', keywords.join(', '));
      return id;
    },
    [userId, pushNotice, logEvent],
  );

  const markNeedSeen = useCallback((id: string) => {
    setNeeds((list) => list.map((n) => (n.id === id && n.status === 'Enviada' ? { ...n, status: 'Vista' } : n)));
  }, []);

  const respondNeed = useCallback(
    (id: string, response: string) => {
      const need = needs.find((n) => n.id === id);
      setNeeds((list) => list.map((n) => (n.id === id ? { ...n, status: 'Atendida', response, respondedAt: Date.now() } : n)));
      if (need) {
        pushNotice({
          forRole: 'medico',
          kind: 'producto',
          title: `${personById('v1').name} respondió tu solicitud`,
          body: `“${need.keywords.join(', ')}”: ${response}`,
          href: `/necesidad/${id}`,
        });
      }
      logEvent('necesidad_atendida', response);
    },
    [needs, pushNotice, logEvent],
  );

  // ---------- Devoluciones de material ----------
  const createReturn: AppState['createReturn'] = useCallback(
    (input) => {
      const doctorId = userId ?? 'm1';
      const id = `dv${Date.now()}`;
      const code = `DEV-${String(8 + Math.floor(Math.random() * 900)).padStart(4, '0')}`;
      const now = Date.now();
      setReturns((list) => [{ ...input, id, code, doctorId, repId: 'v1', status: 'Reportada', history: [{ status: 'Reportada', at: now }], createdAt: now }, ...list]);
      pushNotice({
        forRole: 'visitador',
        kind: 'solicitud',
        title: `Devolución ${code} de ${personById(doctorId).name}`,
        body: `${input.reason} · ${input.qty} ${input.material.toLowerCase()} de ${productById(input.productId)?.name ?? ''}`,
        href: `/devolucion/${id}`,
      });
      logEvent('devolucion_creada', input.reason);
      return id;
    },
    [userId, pushNotice, logEvent],
  );

  const advanceReturn = useCallback(
    (id: string, note?: string) => {
      const r = returns.find((x) => x.id === id);
      if (!r) return;
      const i = RETURN_FLOW.indexOf(r.status);
      if (i < 0 || i === RETURN_FLOW.length - 1) return;
      const next = RETURN_FLOW[i + 1];
      setReturns((list) => list.map((x) => (x.id === id ? { ...x, status: next, history: [...x.history, { status: next, at: Date.now(), note }] } : x)));
      pushNotice({
        forRole: 'medico',
        kind: 'solicitud',
        title: `Devolución ${r.code}: ${next}`,
        body: note || 'Tu reporte de material cambió de estado.',
        href: `/devolucion/${id}`,
      });
      logEvent('devolucion_estado', next);
    },
    [returns, pushNotice, logEvent],
  );

  const cancelReturn = useCallback((id: string) => {
    setReturns((list) => list.map((x) => (x.id === id ? { ...x, status: 'Cancelada', history: [...x.history, { status: 'Cancelada', at: Date.now() }] } : x)));
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
      kit,
      activeVisitId,
      startVisit,
      addUnscheduledVisit,
      updateReport,
      finishVisit,
      discardVisit,
      doctorStatus,
      setMyStatus,
      needs,
      createNeed,
      markNeedSeen,
      respondNeed,
      returns,
      createReturn,
      advanceReturn,
      cancelReturn,
    }),
    [returns, createReturn, advanceReturn, cancelReturn, doctorStatus, setMyStatus, needs, createNeed, markNeedSeen, respondNeed, kit, activeVisitId, startVisit, addUnscheduledVisit, updateReport, finishVisit, discardVisit, role, userId, requests, chats, visits, notices, events, login, logout, logEvent, createRequest, advanceRequest, cancelRequest, sendMessage, markChatRead, chatWith, setVisitStatus, setVisitNotes, markNoticeRead, markAllNoticesRead],
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
