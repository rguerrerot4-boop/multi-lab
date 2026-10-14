import { RoleTabs } from '@/components/RoleTabs';

export default function VisitadorLayout() {
  return (
    <RoleTabs
      role="visitador"
      tabs={[
        { name: 'index', title: 'Inicio', icon: 'home-outline', iconOn: 'home' },
        { name: 'agenda', title: 'Agenda', icon: 'calendar-outline', iconOn: 'calendar' },
        { name: 'catalogo', title: 'Catálogo', icon: 'grid-outline', iconOn: 'grid' },
        { name: 'mensajes', title: 'Mensajes', icon: 'chatbubbles-outline', iconOn: 'chatbubbles', badge: 'messages' },
        { name: 'perfil', title: 'Perfil', icon: 'person-circle-outline', iconOn: 'person-circle' },
      ]}
    />
  );
}
