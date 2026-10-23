import { useLocalSearchParams } from 'expo-router';
import { AppHeader, EmptyState, Screen } from '@/components/ui';
import { productById } from '@/data/mock';
import Ficha from '@/screens/Ficha';

// Ficha del producto (diseño en src/screens/Ficha.tsx)
export default function Producto() {
  const { id, modo } = useLocalSearchParams<{ id: string; modo?: string }>();
  const p = productById(id);
  if (!p) {
    return (
      <Screen header={<AppHeader title="Producto" />}>
        <EmptyState icon="alert-circle-outline" title="Producto no encontrado" body="Es posible que ya no esté en el catálogo." />
      </Screen>
    );
  }
  return <Ficha key={p.id} product={p} initialMode={modo === 'ficticio' ? 'ficticio' : 'real'} />;
}
