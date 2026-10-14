import { RoleTabs } from '@/components/RoleTabs';

export default function MedicoLayout() {
  return (
    <RoleTabs
      role="medico"
      tabs={[
        { name: 'index', title: 'Inicio', icon: 'home-outline', iconOn: 'home' },
        { name: 'catalogo', title: 'Catálogo', icon: 'grid-outline', iconOn: 'grid' },
        { name: 'solicitudes', title: 'Solicitudes', icon: 'document-text-outline', iconOn: 'document-text' },
        { name: 'mensajes', title: 'Mensajes', icon: 'chatbubbles-outline', iconOn: 'chatbubbles', badge: 'messages' },
        { name: 'perfil', title: 'Perfil', icon: 'person-circle-outline', iconOn: 'person-circle' },
      ]}
    />
  );
}
