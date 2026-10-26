// Vitrina 3D: productos fotografiados en la sesión de fotos, con sus caras como textura.
//
// CORAESSENS® es un producto REAL de Nutrabiotics que se muestra con permiso del laboratorio.
// Todo el contenido está transcrito del empaque (muestra médica). No se agregan indicaciones,
// estudios ni afirmaciones que no estén impresas en la caja.
// El modo "ficticio" usa el mismo empaque con el nombre y el laboratorio alterados (KARDENSA · Bioandes).
import type { ImageSourcePropType } from 'react-native';
import type { BoxTextures } from '@/components/PhotoBox3D';
import { CORAESSENS_INFO, vitrinaCards, type VitrinaMode } from './coraessens-info';
import { productById } from './mock';

export { vitrinaCards };
export type { InfoRow, VitrinaCard, VitrinaMode, VitrinaNames } from './coraessens-info';


const tex = (m: VitrinaMode): BoxTextures =>
  m === 'real'
    ? {
        front: require('../../assets/coraessens/front.jpg'),
        right: require('../../assets/coraessens/right.jpg'),
        back: require('../../assets/coraessens/back.jpg'),
        left: require('../../assets/coraessens/left.jpg'),
        top: require('../../assets/coraessens/top.jpg'),
        bottom: require('../../assets/coraessens/bottom.jpg'),
      }
    : {
        front: require('../../assets/coraessens/ficticio-front.jpg'),
        right: require('../../assets/coraessens/ficticio-right.jpg'),
        back: require('../../assets/coraessens/ficticio-back.jpg'),
        left: require('../../assets/coraessens/ficticio-left.jpg'),
        top: require('../../assets/coraessens/ficticio-top.jpg'),
        bottom: require('../../assets/coraessens/ficticio-bottom.jpg'),
      };

export const CORAESSENS = {
  ...CORAESSENS_INFO,
  textures: { real: tex('real'), ficticio: tex('ficticio') } as Record<VitrinaMode, BoxTextures>,
  thumb: require('../../assets/coraessens/front.jpg') as ImageSourcePropType,
  thumbFicticio: require('../../assets/coraessens/ficticio-front.jpg') as ImageSourcePropType,
};

// El producto del catálogo usa las mismas fotos (ficha, visor 3D, presentación, tarjetas)
const cor = productById(CORAESSENS.id);
if (cor) cor.photo = { textures: CORAESSENS.textures.real, dims: CORAESSENS.dims, vitrina: '/vitrina/cor' };
