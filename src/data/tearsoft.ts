// Caja de TEARSOFT® (Procaps) fotografiada: sus caras enderezadas (scripts/tearsoft/texturas.py).
// Producto real mostrado con permiso del laboratorio; el modo ficticio (LUBRAVIS · Bioandes) usa la misma caja
// con el nombre, los logotipos y el laboratorio tapados.
import type { ImageSourcePropType } from 'react-native';
import type { BoxTextures } from '@/components/PhotoBox3D';
import type { VitrinaMode } from './coraessens-info';
import { productById } from './mock';
import { TEARSOFT_INFO } from './tearsoft-info';
import { packColors } from '@/theme';

// la caja no tiene foto de frente del otro costado ni del reverso: el reverso es el frente (sin el braille en
// relieve) y los dos costados son iguales; las dos tapas también
const tex = (m: VitrinaMode): BoxTextures =>
  m === 'real'
    ? {
        front: require('../../assets/tearsoft/frente.jpg'),
        right: require('../../assets/tearsoft/costado.jpg'),
        back: require('../../assets/tearsoft/frente.jpg'),
        left: require('../../assets/tearsoft/costado.jpg'),
        top: require('../../assets/tearsoft/tapa.jpg'),
        bottom: require('../../assets/tearsoft/tapa.jpg'),
      }
    : {
        front: require('../../assets/tearsoft/ficticio-frente.jpg'),
        right: require('../../assets/tearsoft/ficticio-costado.jpg'),
        back: require('../../assets/tearsoft/ficticio-frente.jpg'),
        left: require('../../assets/tearsoft/ficticio-costado.jpg'),
        top: require('../../assets/tearsoft/ficticio-tapa.jpg'),
        bottom: require('../../assets/tearsoft/ficticio-tapa.jpg'),
      };

export const TEARSOFT = {
  ...TEARSOFT_INFO,
  textures: { real: tex('real'), ficticio: tex('ficticio') } as Record<VitrinaMode, BoxTextures>,
  thumb: { real: require('../../assets/tearsoft/frente.jpg'), ficticio: require('../../assets/tearsoft/ficticio-frente.jpg') } as Record<VitrinaMode, ImageSourcePropType>,
};

// el producto del catálogo usa las mismas fotos (miniaturas, visor 3D, presentación)
const tea = productById(TEARSOFT.id);
if (tea) tea.photo = { textures: TEARSOFT.textures.real, dims: TEARSOFT.dims, vitrina: '/producto/tea', bg: [packColors.tearsoft.sky, packColors.tearsoft.navy] };
