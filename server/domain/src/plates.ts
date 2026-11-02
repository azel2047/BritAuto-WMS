/** FR-DM-04, FR-DM-05, BR-01 */
export const normalizePlate = (p: string): string => p.replace(/[\s.-]/g, '').toUpperCase();
export interface VehiclePlates { vehicleId: string; plates: string[] }
export function findVehicleByPlate(vehicles: VehiclePlates[], query: string): string | undefined {
  const q = normalizePlate(query);
  return vehicles.find(v => v.plates.some(p => normalizePlate(p) === q))?.vehicleId;
}
