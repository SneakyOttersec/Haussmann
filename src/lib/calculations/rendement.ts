export function rendementBrut(loyerAnnuel: number, coutTotalAcquisition: number): number {
  if (coutTotalAcquisition <= 0) return 0;
  return (loyerAnnuel / coutTotalAcquisition) * 100;
}

export function rendementNet(
  loyerAnnuelNet: number,
  chargesAnnuelles: number,
  coutTotalAcquisition: number,
): number {
  if (coutTotalAcquisition <= 0) return 0;
  return ((loyerAnnuelNet - chargesAnnuelles) / coutTotalAcquisition) * 100;
}

export function rendementNetNet(
  loyerAnnuelNet: number,
  chargesAnnuelles: number,
  impotAnnuel: number,
  coutTotalAcquisition: number,
): number {
  if (coutTotalAcquisition <= 0) return 0;
  return ((loyerAnnuelNet - chargesAnnuelles - impotAnnuel) / coutTotalAcquisition) * 100;
}
