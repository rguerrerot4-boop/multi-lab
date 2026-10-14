import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { ReturnCard } from '@/components/ReturnCard';
import { AppHeader, Button, EmptyState, Screen, Segmented } from '@/components/ui';
import type { ReturnItem } from '@/data/mock';
import { useMine } from '@/store/AppStore';
import { space } from '@/theme';

const isOpen = (r: ReturnItem) => r.status !== 'Resuelta' && r.status !== 'Cancelada';

// Lista de devoluciones de material (el médico ve las suyas; el visitador, las de sus médicos)
export default function Devoluciones() {
  const { returns, role, userId } = useMine();
  const isRep = role === 'visitador';
  const mine = returns.filter((r) => (isRep ? r.repId === userId : r.doctorId === userId));
  const [tab, setTab] = useState<'abiertas' | 'cerradas'>('abiertas');
  const list = mine.filter((r) => (tab === 'abiertas' ? isOpen(r) : !isOpen(r)));

  return (
    <Screen
      header={<AppHeader title="Devoluciones" subtitle={isRep ? 'Reportes de material de tus médicos' : 'Material recibido en mal estado'} />}
      footer={!isRep ? <Button label="Reportar material" icon="add" onPress={() => router.push('/devolucion/nueva')} /> : undefined}
    >
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'abiertas', label: `Abiertas · ${mine.filter(isOpen).length}` },
          { value: 'cerradas', label: 'Cerradas' },
        ]}
      />
      {list.length ? (
        <View style={{ gap: space.sm }}>
          {list.map((r) => (
            <ReturnCard key={r.id} r={r} forRep={isRep} />
          ))}
        </View>
      ) : (
        <EmptyState
          icon="arrow-undo-outline"
          title={tab === 'abiertas' ? 'Sin devoluciones abiertas' : 'Sin devoluciones cerradas'}
          body={isRep ? 'Cuando un médico reporte material en mal estado, aparecerá aquí.' : 'Si alguna muestra o material llega en mal estado, repórtalo con el botón de abajo.'}
        />
      )}
    </Screen>
  );
}
