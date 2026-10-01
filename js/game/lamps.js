// Leuchtende Materialien (Lampen, Fenster). Bei Nacht leuchten sie stärker.
export const lamps = new Set();

export function lamp(material, day = 0.8, night = 2.6) {
  material.userData.lampDay = day;
  material.userData.lampNight = night;
  material.emissiveIntensity = day;
  lamps.add(material);
  return material;
}
