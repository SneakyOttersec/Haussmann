import { round2 } from '@/lib/round';

export function rendementBrut(loyerAnnuel: number, coutTotalAcquisition: number): number {
  if (coutTotalAcquisition <= 0) return 0;
  return round2((loyerAnnuel / coutTotalAcquisition) * 100);
}

export function rendementNet(
  loyerAnnuelNet: number,
  chargesAnnuelles: number,
  coutTotalAcquisition: number,
): number {
  if (coutTotalAcquisition <= 0) return 0;
  return round2(((loyerAnnuelNet - chargesAnnuelles) / coutTotalAcquisition) * 100);
}

export function rendementNetNet(
  loyerAnnuelNet: number,
  chargesAnnuelles: number,
  impotAnnuel: number,
  coutTotalAcquisition: number,
): number {
  if (coutTotalAcquisition <= 0) return 0;
  return round2(((loyerAnnuelNet - chargesAnnuelles - impotAnnuel) / coutTotalAcquisition) * 100);
}
