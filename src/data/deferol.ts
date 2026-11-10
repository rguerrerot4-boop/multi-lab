// Caja de DEFEROL® (Procaps) fotografiada: sus seis caras enderezadas (scripts/deferol/texturas.py).
// Producto real mostrado con permiso del laboratorio; el modo ficticio (SOLDEVA · Bioandes) usa la misma caja
// con el nombre, los logotipos y el fabricante tapados.
import type { ImageSourcePropType } from 'react-native';
import type { BoxTextures } from '@/components/PhotoBox3D';
import type { VitrinaMode } from './coraessens-info';
import { DEFEROL_INFO } from './deferol-info';
import { productById } from './mock';
import { packColors } from '@/theme';

const tex = (m: VitrinaMode): BoxTextures =>
  m === 'real'
    ? {
        front: require('../../assets/deferol/frente.jpg'),
        right: require('../../assets/deferol/derecha.jpg'),
        back: require('../../assets/deferol/reverso.jpg'),
        left: require('../../assets/deferol/izquierda.jpg'),
        top: require('../../assets/deferol/arriba.jpg'),
        bottom: require('../../assets/deferol/abajo.jpg'),
      }
    : {
        front: require('../../assets/deferol/ficticio-frente.jpg'),
        right: require('../../assets/deferol/ficticio-derecha.jpg'),
        back: require('../../assets/deferol/ficticio-reverso.jpg'),
        left: require('../../assets/deferol/ficticio-izquierda.jpg'),
        top: require('../../assets/deferol/ficticio-arriba.jpg'),
        bottom: require('../../assets/deferol/ficticio-abajo.jpg'),
      };

export const DEFEROL = {
  ...DEFEROL_INFO,
  textures: { real: tex('real'), ficticio: tex('ficticio') } as Record<VitrinaMode, BoxTextures>,
  thumb: { real: require('../../assets/deferol/frente.jpg'), ficticio: require('../../assets/deferol/ficticio-frente.jpg') } as Record<VitrinaMode, ImageSourcePropType>,
};

// el producto del catálogo usa las mismas fotos (miniaturas, visor 3D, presentación)
const def = productById(DEFEROL.id);
if (def) def.photo = { textures: DEFEROL.textures.real, dims: DEFEROL.dims, vitrina: '/producto/def', bg: [packColors.deferol.aqua, packColors.deferol.deep] };
