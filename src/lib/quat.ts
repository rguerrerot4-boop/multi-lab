// Cuaterniones para los visores 3D (giro libre tipo "trackball" sin bloqueo de ejes).
export type V3 = [number, number, number];
export type Q = [number, number, number, number]; // [w, x, y, z]

export const qAxis = (ax: V3, ang: number): Q => {
  const s = Math.sin(ang / 2);
  return [Math.cos(ang / 2), ax[0] * s, ax[1] * s, ax[2] * s];
};
export const qMul = (a: Q, b: Q): Q => [
  a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
  a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
  a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
  a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
];
export const qNorm = (q: Q): Q => {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
};
export const qRot = (q: Q, v: V3): V3 => {
  const [w, x, y, z] = q;
  const ix = w * v[0] + y * v[2] - z * v[1];
  const iy = w * v[1] + z * v[0] - x * v[2];
  const iz = w * v[2] + x * v[1] - y * v[0];
  const iw = -x * v[0] - y * v[1] - z * v[2];
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
};
export const qSlerp = (a: Q, b: Q, t: number): Q => {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  let bb = b;
  if (d < 0) {
    d = -d;
    bb = [-b[0], -b[1], -b[2], -b[3]];
  }
  if (d > 0.9995) return qNorm([a[0] + (bb[0] - a[0]) * t, a[1] + (bb[1] - a[1]) * t, a[2] + (bb[2] - a[2]) * t, a[3] + (bb[3] - a[3]) * t]);
  const th = Math.acos(d);
  const s1 = Math.sin((1 - t) * th) / Math.sin(th);
  const s2 = Math.sin(t * th) / Math.sin(th);
  return [a[0] * s1 + bb[0] * s2, a[1] * s1 + bb[1] * s2, a[2] * s1 + bb[2] * s2, a[3] * s1 + bb[3] * s2];
};
