import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Personaje, type Pose } from '@/components/asistente/Personaje';
import { personById } from '@/data/mock';
import { ASISTENTE, esActivacion, limpiar, responder, SUGERENCIAS, trato, type AsistenteCtx, type Respuesta } from '@/lib/asistente';
import { callar, escucharSiempre, escucharUna, guardarPref, hablar, leerPref, precargar, puedeEscuchar, puedeHablar, type Escucha } from '@/lib/voz';
import { useMine } from '@/store/AppStore';
import { colors, font, radius, shadow, space, type } from '@/theme';

// «Multi», asistente virtual del profesional de salud: una burbuja flotante con el personaje, que se mueve de vez en cuando.
// Al tocarla (o al decir «Hola Multi» con la activación por voz encendida) abre un panel para preguntarle
// hablando o escribiendo. Responde con los datos de la app (src/lib/asistente.ts) y con voz (src/lib/voz.ts).

interface Msg {
  id: string;
  from: 'yo' | 'multi';
  text: string;
  r?: Respuesta;
}

const BUBBLE = 66;
const TAB_BAR = 62;

function useReduceMotion() {
  const [rm, setRm] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setRm)
      .catch(() => {});
  }, []);
  return rm;
}

/** Parpadeo y boca del personaje (compartido por la burbuja y el panel) */
function useCara(hablando: boolean) {
  const [blink, setBlink] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const ciclo = () => {
      t = setTimeout(
        () => {
          setBlink(true);
          t = setTimeout(() => {
            setBlink(false);
            ciclo();
          }, 130);
        },
        2400 + Math.random() * 2800,
      );
    };
    ciclo();
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!hablando) {
      setOpen(false);
      return;
    }
    const i = setInterval(() => setOpen((o) => !o), 150);
    return () => clearInterval(i);
  }, [hablando]);
  return { blink, open };
}

export function Asistente() {
  const insets = useSafeAreaInsets();
  const rm = useReduceMotion();
  const { userId, myVisits, myRequests, myChats, myNotices, needs, returns, doctorStatus, setMyStatus, logEvent } = useMine();
  const me = personById(userId ?? 'm1');

  const [abierto, setAbierto] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [texto, setTexto] = useState('');
  const [hablando, setHablando] = useState(false);
  const [oyendo, setOyendo] = useState(false); // micrófono de una frase
  const [parcial, setParcial] = useState('');
  const [aviso, setAviso] = useState('');
  const [sonido, setSonido] = useState(() => leerPref('sonido', true));
  const [porVoz, setPorVoz] = useState(() => puedeEscuchar && leerPref('voz', false));
  const [vozActiva, setVozActiva] = useState(false);
  const [globo, setGlobo] = useState('');

  const ctx: AsistenteCtx = useMemo(
    () => ({
      me,
      visits: myVisits,
      requests: myRequests,
      chats: myChats,
      notices: myNotices,
      needs: needs.filter((n) => n.doctorId === me.id),
      returns: returns.filter((x) => x.doctorId === me.id),
      status: doctorStatus[me.id],
    }),
    [me, myVisits, myRequests, myChats, myNotices, needs, returns, doctorStatus],
  );
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const sonidoRef = useRef(sonido);
  sonidoRef.current = sonido;
  const siempre = useRef<ReturnType<typeof escucharSiempre> | null>(null);
  const una = useRef<Escucha | null>(null);
  const lista = useRef<ScrollView>(null);

  const saludo = `Hola, ${trato(me)}. Soy Multi, su asistente. ¿En qué le puedo ayudar?`;
  const escucho = `¿Sí, ${trato(me)}? Le escucho.`;
  useEffect(() => precargar([saludo, escucho]), [saludo, escucho]);

  // ---------- decir ----------
  const decir = useCallback((t: string, alTerminar?: () => void) => {
    if (!sonidoRef.current || !puedeHablar) {
      alTerminar?.();
      return;
    }
    siempre.current?.pausa(true); // que no se escuche a sí mismo
    setHablando(true);
    hablar(t, () => {
      setHablando(false);
      if (alTerminar) alTerminar();
      else siempre.current?.pausa(false);
    });
  }, []);

  const preguntar = useCallback(
    (q: string, alTerminar?: () => void) => {
      const pregunta = limpiar(q) || q.trim();
      if (!pregunta) return;
      const r = responder(pregunta, ctxRef.current);
      if (r.setStatus) setMyStatus({ state: r.setStatus });
      logEvent('asistente_pregunta', pregunta.slice(0, 60));
      setMsgs((m) => [...m, { id: `q${Date.now()}`, from: 'yo', text: pregunta }, { id: `a${Date.now()}`, from: 'multi', text: r.text, r }]);
      decir(r.text, alTerminar);
    },
    [decir, logEvent, setMyStatus],
  );

  // ---------- escuchar una frase (botón del micrófono o después de «Hola Multi») ----------
  const escuchar = useCallback(() => {
    if (!puedeEscuchar) return;
    callar();
    setHablando(false);
    siempre.current?.pausa(true);
    setAviso('');
    setParcial('');
    setOyendo(true);
    una.current = escucharUna(setParcial, (t, error) => {
      una.current = null;
      setOyendo(false);
      setParcial('');
      if (t) preguntar(t);
      else {
        if (error === 'not-allowed' || error === 'service-not-allowed') setAviso('Permita el micrófono en el navegador para hablarle a Multi.');
        else if (error && error !== 'no-speech' && error !== 'aborted') setAviso('No pude usar el micrófono. Puede escribirme.');
        siempre.current?.pausa(false);
      }
    });
  }, [preguntar]);

  const dejarDeEscuchar = () => una.current?.stop();

  // ---------- activación por voz: «Hola Multi» ----------
  const alOir = useRef<(f: string) => void>(() => {});
  alOir.current = (f: string) => {
    if (!esActivacion(f)) return;
    logEvent('asistente_voz');
    setAbierto(true);
    const resto = limpiar(f.replace(/^.*?\b(hola|ola|oye|hey)\b/i, '$1'));
    if (resto.replace(/[^a-záéíóúñ]/gi, '').length > 3) preguntar(resto);
    else {
      setMsgs((m) => [...m, { id: `a${Date.now()}`, from: 'multi', text: escucho }]);
      decir(escucho, escuchar);
    }
  };
  useEffect(() => {
    if (!porVoz) return;
    const s = escucharSiempre(
      (f) => alOir.current(f),
      (activo, error) => {
        setVozActiva(activo);
        if (error === 'sin-permiso') {
          setPorVoz(false);
          setAviso('Permita el micrófono en el navegador para activar a Multi con la voz.');
        }
      },
    );
    siempre.current = s;
    return () => {
      s.stop();
      siempre.current = null;
    };
  }, [porVoz]);

  const cambiarPorVoz = () => {
    const v = !porVoz;
    setAviso('');
    setPorVoz(v);
    guardarPref('voz', v);
    if (v) setGlobo('Diga «Hola Multi»');
  };
  const cambiarSonido = () => {
    const v = !sonido;
    setSonido(v);
    guardarPref('sonido', v);
    if (!v) {
      callar();
      setHablando(false);
      siempre.current?.pausa(false);
    }
  };

  const abrir = () => {
    setGlobo('');
    setAbierto(true);
    logEvent('asistente_abierto');
    if (!msgs.length) {
      setMsgs([{ id: 'hola', from: 'multi', text: saludo, r: { text: saludo, chips: SUGERENCIAS } }]);
      decir(saludo);
    }
  };
  const cerrar = () => {
    dejarDeEscuchar();
    callar();
    setHablando(false);
    siempre.current?.pausa(false);
    setAbierto(false);
  };
  const enviar = () => {
    const q = texto.trim();
    if (!q) return;
    setTexto('');
    preguntar(q);
  };
  const ir = (href: string) => {
    cerrar();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.push(href as any);
  };

  useEffect(() => {
    const t = setTimeout(() => lista.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [msgs, parcial, oyendo]);
  useEffect(
    () => () => {
      callar();
      una.current?.stop();
    },
    [],
  );

  // ---------- la burbuja se mueve de vez en cuando ----------
  const cara = useCara(hablando);
  const [pose, setPose] = useState<Pose>({});
  const salto = useRef(new Animated.Value(0)).current;
  const paso = useRef(new Animated.Value(0)).current;
  const entrada = useRef(new Animated.Value(0)).current;
  const globoA = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(entrada, { toValue: 1, useNativeDriver: true, stiffness: 180, damping: 14, delay: 500 }).start();
    const t = setTimeout(() => setGlobo(`¿Le ayudo, ${trato(me)}?`), 1600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!globo) return;
    Animated.timing(globoA, { toValue: 1, duration: 260, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true }).start();
    const t = setTimeout(() => Animated.timing(globoA, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setGlobo('')), 4200);
    return () => clearTimeout(t);
  }, [globo, globoA]);

  useEffect(() => {
    if (rm || abierto) return;
    const ts: ReturnType<typeof setTimeout>[] = [];
    const luego = (ms: number, fn: () => void) => ts.push(setTimeout(fn, ms));
    const saltar = (n = 2) =>
      Animated.sequence(
        Array.from({ length: n }, () => [
          Animated.timing(salto, { toValue: -11, duration: 170, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(salto, { toValue: 0, duration: 190, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]).flat(),
      ).start();
    const gestos = [
      () => {
        // saluda con la mano
        setPose({ wave: true, happy: true });
        saltar(1);
        luego(1500, () => setPose({}));
      },
      () => saltar(2),
      () => {
        // mira a los lados
        setPose({ look: -1 });
        luego(650, () => setPose({ look: 1 }));
        luego(1300, () => setPose({}));
      },
      () => {
        // da unos pasos a un lado y vuelve
        const pasos = [1, 2, 1, 2, 1, 2] as const;
        pasos.forEach((s, i) => luego(i * 150, () => setPose({ step: s, look: -1 })));
        Animated.timing(paso, { toValue: -26, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }).start();
        luego(1250, () => {
          pasos.forEach((s, i) => luego(i * 150, () => setPose({ step: s, look: 1 })));
          Animated.timing(paso, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }).start();
        });
        luego(2250, () => setPose({}));
      },
    ];
    let n = 0;
    const ciclo = () =>
      luego(5200 + Math.random() * 4800, () => {
        gestos[n++ % gestos.length]();
        ciclo();
      });
    luego(2600, gestos[0]);
    ciclo();
    return () => {
      ts.forEach(clearTimeout);
      setPose({});
    };
  }, [rm, abierto, salto, paso]);

  const estado = oyendo ? 'Le escucho…' : hablando ? 'Hablando…' : vozActiva ? 'Diga «Hola Multi» o escriba' : 'Asistente virtual';
  const ultimo = msgs[msgs.length - 1];
  const chips = !oyendo && ultimo?.from === 'multi' ? (ultimo.r?.chips ?? []) : [];

  return (
    <>
      {/* burbuja flotante */}
      <Animated.View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          right: space.lg,
          bottom: TAB_BAR + insets.bottom + 30,
          alignItems: 'flex-end',
          opacity: abierto ? 0 : entrada,
          transform: [{ translateX: paso }, { scale: entrada.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
        }}
      >
        {globo ? (
          <Animated.View
            style={{
              marginBottom: 8,
              backgroundColor: colors.surface,
              borderWidth: 1.5,
              borderColor: colors.primary,
              borderRadius: radius.md,
              borderBottomRightRadius: 4,
              paddingHorizontal: 12,
              paddingVertical: 8,
              opacity: globoA,
              transform: [{ scale: globoA.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }, { translateY: globoA.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
              ...shadow.card,
            }}
          >
            <Text style={{ fontFamily: font.semibold, fontSize: 13, color: colors.ink }}>{globo}</Text>
          </Animated.View>
        ) : null}
        <Animated.View style={{ transform: [{ translateY: salto }] }}>
          <Pressable
            onPress={abrir}
            disabled={abierto}
            accessibilityRole="button"
            accessibilityLabel={`Abrir a ${ASISTENTE.name}, su asistente virtual`}
            style={({ pressed }) => ({
              width: BUBBLE,
              height: BUBBLE,
              borderRadius: BUBBLE / 2,
              backgroundColor: colors.surface,
              borderWidth: 3,
              borderColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              transform: [{ scale: pressed ? 0.94 : 1 }],
              shadowColor: colors.ink,
              shadowOpacity: 0.22,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 6 },
              elevation: 6,
            })}
          >
            <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: BUBBLE * 0.36, backgroundColor: colors.primarySoft }} />
            <View style={{ marginTop: 6 }}>
              <Personaje size={50} {...pose} blink={cara.blink} open={cara.open} />
            </View>
          </Pressable>
          {vozActiva ? (
            <View
              style={{ position: 'absolute', right: -2, top: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.success, borderWidth: 2, borderColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="mic" size={11} color={colors.white} />
            </View>
          ) : null}
        </Animated.View>
      </Animated.View>

      {/* panel */}
      <Modal visible={abierto} transparent animationType="fade" onRequestClose={cerrar} statusBarTranslucent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.overlay }} onPress={cerrar} accessibilityLabel="Cerrar el asistente" />
          <View
            style={{
              backgroundColor: colors.bg,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              maxHeight: '84%',
              minHeight: 380,
              paddingBottom: insets.bottom + space.sm,
              width: '100%',
              maxWidth: 560,
              alignSelf: 'center',
            }}
          >
            {/* cabecera */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm }}>
              <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: colors.primarySoft, borderWidth: 2, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                <View style={{ marginTop: 5 }}>
                  <Personaje size={44} blink={cara.blink} open={cara.open} wave={oyendo} happy={oyendo} />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={type.h2}>{ASISTENTE.name}</Text>
                <Text style={[type.caption, oyendo || hablando ? { color: colors.primary } : null]}>{estado}</Text>
              </View>
              {puedeHablar ? (
                <Pressable onPress={cambiarSonido} hitSlop={8} accessibilityRole="switch" accessibilityState={{ checked: sonido }} accessibilityLabel="Voz de Multi" style={{ padding: 8 }}>
                  <Ionicons name={sonido ? 'volume-high-outline' : 'volume-mute-outline'} size={22} color={sonido ? colors.primary : colors.inkSubtle} />
                </Pressable>
              ) : null}
              <Pressable onPress={cerrar} hitSlop={8} accessibilityRole="button" accessibilityLabel="Cerrar" style={{ padding: 8 }}>
                <Ionicons name="close" size={24} color={colors.ink} />
              </Pressable>
            </View>

            {/* activación por voz */}
            {puedeEscuchar ? (
              <Pressable
                onPress={cambiarPorVoz}
                accessibilityRole="switch"
                accessibilityState={{ checked: porVoz }}
                style={{
                  marginHorizontal: space.lg,
                  marginBottom: space.sm,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.sm,
                  backgroundColor: porVoz ? colors.successSoft : colors.surface,
                  borderWidth: 1,
                  borderColor: porVoz ? colors.success : colors.border,
                  borderRadius: radius.md,
                  paddingHorizontal: space.md,
                  paddingVertical: 10,
                }}
              >
                <Ionicons name={porVoz ? 'ear' : 'ear-outline'} size={18} color={porVoz ? colors.success : colors.inkMuted} />
                <Text style={[type.label, { flex: 1, color: porVoz ? colors.success : colors.ink }]}>{porVoz ? 'Activado: diga «Hola Multi»' : 'Activar con la voz: «Hola Multi»'}</Text>
                <Ionicons name={porVoz ? 'toggle' : 'toggle-outline'} size={30} color={porVoz ? colors.success : colors.inkSubtle} />
              </Pressable>
            ) : (
              <Text style={[type.caption, { marginHorizontal: space.lg, marginBottom: space.sm }]}>En este dispositivo Multi funciona por texto. La voz está disponible en la versión web (Chrome o Safari).</Text>
            )}
            {aviso ? <Text style={[type.caption, { marginHorizontal: space.lg, marginBottom: space.sm, color: colors.warning }]}>{aviso}</Text> : null}

            {/* conversación */}
            <ScrollView ref={lista} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: space.lg, paddingVertical: space.sm, gap: space.sm }} keyboardShouldPersistTaps="handled">
              {msgs.map((m) =>
                m.from === 'yo' ? (
                  <View key={m.id} style={{ alignSelf: 'flex-end', maxWidth: '86%', backgroundColor: colors.primary, borderRadius: radius.lg, borderBottomRightRadius: 4, paddingHorizontal: 14, paddingVertical: 10 }}>
                    <Text style={[type.body, { color: colors.white }]}>{m.text}</Text>
                  </View>
                ) : (
                  <View key={m.id} style={{ alignSelf: 'flex-start', maxWidth: '92%', gap: 6 }}>
                    <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, borderBottomLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 10 }}>
                      <Text style={type.body}>{m.text}</Text>
                    </View>
                    {m.r?.href ? (
                      <Pressable
                        onPress={() => ir(m.r!.href!)}
                        accessibilityRole="link"
                        style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 }}
                      >
                        <Text style={[type.label, { color: colors.primary }]}>{m.r.hrefLabel ?? 'Abrir'}</Text>
                        <Ionicons name="arrow-forward" size={14} color={colors.primary} />
                      </Pressable>
                    ) : null}
                  </View>
                ),
              )}
              {oyendo ? (
                <View style={{ alignSelf: 'flex-end', maxWidth: '86%', backgroundColor: colors.primarySoft, borderRadius: radius.lg, borderBottomRightRadius: 4, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <Ionicons name="mic" size={16} color={colors.primary} />
                  <Text style={[type.body, { color: colors.primary, flexShrink: 1 }]}>{parcial || 'Hable ahora…'}</Text>
                </View>
              ) : null}
            </ScrollView>

            {/* sugerencias */}
            {chips.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.sm, paddingVertical: space.sm }} keyboardShouldPersistTaps="handled">
                {chips.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => preguntar(c)}
                    accessibilityRole="button"
                    style={{ borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 }}
                  >
                    <Text style={[type.label, { color: colors.primary }]}>{c}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}

            {/* escribir o hablar */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.xs }}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 16, minHeight: 48 }}>
                <TextInput
                  value={texto}
                  onChangeText={setTexto}
                  onSubmitEditing={enviar}
                  placeholder="Escriba su pregunta"
                  placeholderTextColor={colors.inkSubtle}
                  returnKeyType="send"
                  accessibilityLabel="Mensaje para Multi"
                  style={[{ flex: 1, fontFamily: font.regular, fontSize: 15, color: colors.ink, paddingVertical: 10 }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
                />
              </View>
              {texto.trim() || !puedeEscuchar ? (
                <Pressable
                  onPress={enviar}
                  accessibilityRole="button"
                  accessibilityLabel="Enviar"
                  style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: texto.trim() ? colors.primary : colors.borderStrong, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="send" size={20} color={colors.white} />
                </Pressable>
              ) : (
                <Pressable
                  onPress={oyendo ? dejarDeEscuchar : escuchar}
                  accessibilityRole="button"
                  accessibilityLabel={oyendo ? 'Dejar de escuchar' : 'Hablar con Multi'}
                  style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: oyendo ? colors.danger : colors.primary, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name={oyendo ? 'stop' : 'mic'} size={22} color={colors.white} />
                </Pressable>
              )}
            </View>
            <Text style={[type.caption, { textAlign: 'center', marginTop: space.sm, paddingHorizontal: space.lg }]}>Multi responde con los datos de esta app y con el texto del empaque. No da consejo médico.</Text>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
