import { Redirect, useLocalSearchParams } from 'expo-router';

// La vitrina 3D ahora es la ficha del producto: se mantiene la ruta para los enlaces ya compartidos
export default function Vitrina() {
  const { id, modo } = useLocalSearchParams<{ id: string; modo?: string }>();
  return <Redirect href={{ pathname: '/producto/[id]', params: { id, ...(modo ? { modo } : {}) } }} />;
}
