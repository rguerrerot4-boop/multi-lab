import { useLocalSearchParams } from 'expo-router';
import { AppHeader, EmptyState, Screen } from '@/components/ui';
import { productById } from '@/data/mock';
import Ficha from '@/screens/Ficha';
import FichaPancreogen from '@/screens/FichaPancreogen';

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
  // el frasco 360° tiene su propio catálogo (distinto de la ficha de la caja)
  if (p.bottle) return <FichaPancreogen key={p.id} product={p} initialMode={modo === 'ficticio' ? 'ficticio' : 'real'} />;
  return <Ficha key={p.id} product={p} initialMode={modo === 'ficticio' ? 'ficticio' : 'real'} />;
}
