// Caja de VITYBELL® (Procaps) fotografiada: sus seis caras enderezadas (scripts/vitybell/texturas.py).
// Producto real mostrado con permiso del laboratorio; el modo ficticio (FLORIVA · Bioandes) usa la misma caja
// con el nombre, los logotipos y el fabricante tapados.
import type { ImageSourcePropType } from 'react-native';
import type { BoxTextures } from '@/components/PhotoBox3D';
import type { VitrinaMode } from './coraessens-info';
import { productById } from './mock';
import { VITYBELL_INFO } from './vitybell-info';
import { packColors } from '@/theme';

const tex = (m: VitrinaMode): BoxTextures =>
  m === 'real'
    ? {
        front: require('../../assets/vitybell/frente.jpg'),
        right: require('../../assets/vitybell/derecha.jpg'),
        back: require('../../assets/vitybell/reverso.jpg'),
        left: require('../../assets/vitybell/izquierda.jpg'),
        top: require('../../assets/vitybell/arriba.jpg'),
        bottom: require('../../assets/vitybell/abajo.jpg'),
      }
    : {
        front: require('../../assets/vitybell/ficticio-frente.jpg'),
        right: require('../../assets/vitybell/ficticio-derecha.jpg'),
        back: require('../../assets/vitybell/ficticio-reverso.jpg'),
        left: require('../../assets/vitybell/ficticio-izquierda.jpg'),
        top: require('../../assets/vitybell/ficticio-arriba.jpg'),
        bottom: require('../../assets/vitybell/ficticio-abajo.jpg'),
      };

export const VITYBELL = {
  ...VITYBELL_INFO,
  textures: { real: tex('real'), ficticio: tex('ficticio') } as Record<VitrinaMode, BoxTextures>,
  thumb: { real: require('../../assets/vitybell/frente.jpg'), ficticio: require('../../assets/vitybell/ficticio-frente.jpg') } as Record<VitrinaMode, ImageSourcePropType>,
};

// el producto del catálogo usa las mismas fotos (miniaturas, visor 3D, presentación)
const vit = productById(VITYBELL.id);
if (vit) vit.photo = { textures: VITYBELL.textures.real, dims: VITYBELL.dims, vitrina: '/producto/vit', bg: [packColors.vitybell.pink, packColors.vitybell.rose] };
