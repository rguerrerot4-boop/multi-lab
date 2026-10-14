import { Image, Text } from 'react-native';
import { AppHeader, Card, Screen, logoFull } from '@/components/ui';
import { type } from '@/theme';

export default function Acerca() {
  return (
    <Screen header={<AppHeader title="Acerca de Multi LAB" />}>
      <Card style={{ alignItems: 'center' }}>
        <Image source={logoFull} style={{ width: 200, height: 48 }} resizeMode="contain" accessibilityLabel="Multi LAB" />
        <Text style={[type.bodyMuted, { textAlign: 'center' }]}>
          Experiencia multimedia interactiva para la presentación digital de productos farmacéuticos dirigida a visitadores médicos y
          profesionales de la salud.
        </Text>
      </Card>
      <Card>
        <Text style={type.h3}>Sobre este prototipo</Text>
        <Text style={type.body}>
          Proyecto de titulación de la carrera de Multimedia y Producción Audiovisual. Todas las personas, laboratorios, productos y
          ubicaciones son ficticios y se usan solo para demostrar los recorridos de la aplicación.
        </Text>
        <Text style={type.body}>
          Funciona sin servidor: los datos viven en el dispositivo durante la sesión. Mensajería en tiempo real, documentos autorizados,
          mapa con GPS y vista 3D requerirían integraciones adicionales.
        </Text>
      </Card>
    </Screen>
  );
}
