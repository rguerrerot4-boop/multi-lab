import { View } from 'react-native';
import { Asistente } from '@/components/asistente/Asistente';
import { RoleTabs } from '@/components/RoleTabs';
import { useMine } from '@/store/AppStore';

export default function MedicoLayout() {
  const { role } = useMine();
  return (
    <View style={{ flex: 1 }}>
      <RoleTabs
        role="medico"
        tabs={[
          { name: 'index', title: 'Inicio', icon: 'home-outline', iconOn: 'home' },
          { name: 'solicitudes', title: 'Solicitudes', icon: 'document-text-outline', iconOn: 'document-text' },
          { name: 'mensajes', title: 'Mensajes', icon: 'chatbubbles-outline', iconOn: 'chatbubbles', badge: 'messages' },
          { name: 'perfil', title: 'Perfil', icon: 'person-circle-outline', iconOn: 'person-circle' },
        ]}
      />
      {/* «Multi», el asistente virtual: burbuja flotante sobre todas las pestañas del profesional */}
      {role === 'medico' ? <Asistente /> : null}
    </View>
  );
}
